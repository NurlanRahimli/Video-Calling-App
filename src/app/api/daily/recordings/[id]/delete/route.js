export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-init";

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_BASE = "https://api.daily.co/v1";

export async function DELETE(req, { params }) {
    const id = params?.id;
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    if (!DAILY_API_KEY) return NextResponse.json({ ok: false, error: "Missing DAILY_API_KEY" }, { status: 500 });

    try {
        // Require Firebase auth so only signed-in users can delete via your app
        const admin = getAdmin();
        const authHeader = req.headers.get("authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!token) return NextResponse.json({ ok: false, error: "Missing idToken" }, { status: 401 });
        await admin.auth().verifyIdToken(token);

        // Delete on Daily
        const resp = await fetch(`${DAILY_API_BASE}/recordings/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
        });

        if (!resp.ok) {
            const t = await resp.text().catch(() => "");
            return NextResponse.json(
                { ok: false, error: t || `Daily delete failed (${resp.status})` },
                { status: 502 }
            );
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("[daily delete] error:", e);
        return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
    }
}

export async function OPTIONS() {
    return NextResponse.json({}, { status: 204 });
}
