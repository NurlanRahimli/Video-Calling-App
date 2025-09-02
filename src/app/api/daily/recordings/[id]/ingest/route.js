// app/api/daily/recordings/[id]/ingest/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-init";
import { getStorage } from "firebase-admin/storage";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_BASE = "https://api.daily.co/v1";

// Normalize Daily's room field (snake_case / nested)
function resolveRoom(meta) {
    return meta?.room_name ?? meta?.roomName ?? meta?.room?.name ?? null;
}

export async function POST(req, { params }) {
    const { id } = params || {};
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    if (!DAILY_API_KEY) return NextResponse.json({ ok: false, error: "Missing DAILY_API_KEY" }, { status: 500 });

    try {
        const admin = getAdmin();

        // ---- Storage bucket sanity
        const bucketName = admin.app().options.storageBucket;
        if (!bucketName) {
            throw new Error("Missing storage bucket on Admin app.");
        }

        // ---- Auth (Firebase ID token in Authorization: Bearer <idToken>)
        const authHeader = req.headers.get("authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!token) return NextResponse.json({ ok: false, error: "Missing idToken" }, { status: 401 });

        const decoded = await admin.auth().verifyIdToken(token);
        const ownerId = decoded.uid;

        const db = admin.firestore();

        // ---- If we already ingested this recording for this user, return early
        const existing = await db.collection("recordings").doc(id).get();
        if (existing.exists) {
            const d = existing.data();
            if (d?.ownerId === ownerId && d?.storagePath && d?.status === "ready") {
                return NextResponse.json({
                    ok: true,
                    storagePath: d.storagePath,
                    room: d.room ?? null,
                    title: d.title ?? `Recording ${id.slice(0, 6)}`,
                    already: true,
                });
            }
        }

        // ---- Optional monthly limit
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfMonthTs = admin.firestore.Timestamp.fromDate(startOfMonth);

        const monthSnap = await db
            .collection("recordings")
            .where("ownerId", "==", ownerId)
            .where("createdAt", ">=", startOfMonthTs)
            .get();
        if (monthSnap.size >= 100) {
            return NextResponse.json({ ok: false, error: "Monthly limit reached" }, { status: 403 });
        }

        // ---- Daily metadata
        const metaResp = await fetch(`${DAILY_API_BASE}/recordings/${id}`, {
            headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
            cache: "no-store",
        });
        if (!metaResp.ok) {
            const t = await metaResp.text().catch(() => "");
            return NextResponse.json({ ok: false, error: `meta failed: ${t || metaResp.status}` }, { status: 502 });
        }
        const metaJson = await metaResp.json();

        // ---- One-time access link
        const linkResp = await fetch(`${DAILY_API_BASE}/recordings/${id}/access-link`, {
            headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
            cache: "no-store",
            // If Daily expects POST for this endpoint in your plan, uncomment:
            // method: "POST",
        });
        if (!linkResp.ok) {
            const t = await linkResp.text().catch(() => "");
            return NextResponse.json({ ok: false, error: `access-link failed: ${t || linkResp.status}` }, { status: 502 });
        }
        const linkJson = await linkResp.json();
        const downloadUrl = linkJson?.download_link || linkJson?.link || linkJson?.url;
        if (!downloadUrl) return NextResponse.json({ ok: false, error: "No download URL" }, { status: 500 });

        // ---- Stream from Daily to GCS
        const fileResp = await fetch(downloadUrl, { cache: "no-store" });
        if (!fileResp.ok || !fileResp.body) {
            const t = await fileResp.text().catch(() => "");
            return NextResponse.json({ ok: false, error: `fetch failed: ${t || fileResp.status}` }, { status: 502 });
        }

        const contentType = fileResp.headers.get("content-type") || "video/mp4";
        const bucket = getStorage(admin.app()).bucket(); // <-- no arg, uses default
        const storagePath = `recordings/${ownerId}/${id}/source.mp4`;
        const file = bucket.file(`recordings/${ownerId}/${id}/source.mp4`);
        console.log("[ingest] using bucket:", bucket.name);

        await pipeline(
            Readable.fromWeb(fileResp.body),
            file.createWriteStream({ contentType, resumable: false, validation: false })
        );

        // fetch metadata (size) after upload
        const [gcsMeta] = await file.getMetadata().catch(() => [{ size: null }]);

        // ---- Save Firestore doc
        const roomResolved = resolveRoom(metaJson);
        const title = roomResolved ? `${roomResolved} – ${id.slice(0, 6)}` : `Recording ${id.slice(0, 6)}`;

        await db.collection("recordings").doc(id).set(
            {
                ownerId,
                title,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                durationSec: metaJson?.duration ?? null,
                sizeBytes: gcsMeta?.size ? Number(gcsMeta.size) : null,
                storagePath,
                playbackType: "mp4",
                status: "ready",
                room: roomResolved,
            },
            { merge: true }
        );

        return NextResponse.json({ ok: true, storagePath, room: roomResolved, title });
    } catch (e) {
        console.error("[ingest] error:", e);
        return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
    }
}

// Optional: handle preflight/stray OPTIONS
export async function OPTIONS() {
    return new Response(null, { status: 204 });
}
