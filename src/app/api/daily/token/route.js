export const runtime = "nodejs";

import { getApps, initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function initAdmin() {
    if (getApps().length) return;

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    try {
        if (raw && raw.trim().startsWith("{")) {
            console.log("[token] using FIREBASE_SERVICE_ACCOUNT env (JSON, len=%d)", raw.length);
            initializeApp({ credential: cert(JSON.parse(raw)) });
        } else {
            console.log("[token] using GOOGLE_APPLICATION_CREDENTIALS file (ADC)");
            initializeApp({ credential: applicationDefault() });
        }
    } catch (e) {
        console.error("[token] Firebase Admin init failed:", e);
        throw new Error("admin_init_failed");
    }
}
let adminDb;
try {
    initAdmin();
    adminDb = getFirestore();
} catch { /* handled in POST */ }

export async function POST(req) {
    try {
        const key = process.env.DAILY_API_KEY;
        if (!key) {
            return new Response(JSON.stringify({ error: "Missing DAILY_API_KEY" }), { status: 500 });
        }

        const body = await req.json().catch(() => ({}));
        const { roomName, userName, isOwner, userId, meetingId } = body || {};
        if (!roomName) {
            return new Response(JSON.stringify({ error: "roomName required" }), { status: 400 });
        }

        // Optional: ban check (only if Firestore/Admin initialized)
        if (adminDb && meetingId && userId) {
            try {
                const snap = await adminDb.doc(`meetings/${meetingId}/participants/${userId}`).get();
                if (snap.exists && snap.data()?.banned) {
                    return new Response(JSON.stringify({ error: "banned" }), { status: 403 });
                }
            } catch (e) {
                console.warn("[token] ban check skipped:", e?.message || e);
            }
        }

        const resp = await fetch("https://api.daily.co/v1/meeting-tokens", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                properties: {
                    room_name: roomName,
                    user_name: userName || "Guest",
                    is_owner: !!isOwner,
                    user_id: userId || undefined,
                },
            }),
        });

        const text = await resp.text();
        if (!resp.ok) {
            console.error("[token] Daily error %s: %s", resp.status, text);
            return new Response(JSON.stringify({ error: text }), { status: resp.status });
        }
        return new Response(text, { status: 200, headers: { "content-type": "application/json" } });
    } catch (e) {
        console.error("[token] route crashed:", e);
        return new Response(JSON.stringify({ error: String(e?.message || e) }), {
            status: 500,
            headers: { "content-type": "application/json" },
        });
    }
}
