export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_BASE = "https://api.daily.co/v1";

function toMs(raw) {
    if (!raw && raw !== 0) return null;
    if (typeof raw === "number") return raw < 1e12 ? raw * 1000 : raw; // seconds → ms
    if (typeof raw === "string") {
        const t = Date.parse(raw);
        return Number.isNaN(t) ? null : t;
    }
    return null;
}

export async function GET(req) {
    try {
        if (!DAILY_API_KEY) {
            return NextResponse.json({ ok: false, error: "Missing DAILY_API_KEY" }, { status: 500 });
        }

        const { searchParams } = new URL(req.url);
        const limit = searchParams.get("limit") || "20";
        const cursor = searchParams.get("cursor");

        const url = new URL(`${DAILY_API_BASE}/recordings`);
        url.searchParams.set("limit", limit);
        if (cursor) url.searchParams.set("starting_after", cursor);

        const resp = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
            cache: "no-store",
        });

        const text = await resp.text();
        if (!resp.ok) {
            return NextResponse.json({ ok: false, error: `Daily ${resp.status}: ${text}` }, { status: 500 });
        }

        const json = JSON.parse(text);
        let items = (json.data || []).map((it) => {
            // Try a bunch of possibilities from Daily responses
            const raw =
                it.created_at ?? it.createdAt ?? it.created ??
                it.start_time ?? it.start ?? it.start_ts ?? null;

            return {
                id: it.id,
                room: it.room?.name || it.room_name || "—",
                createdAt: toMs(raw),        // may still be null
                duration: it.duration ?? null,
                size: it.size ?? null,
            };
        });

        // Hydrate missing dates by hitting the detail endpoint
        const missing = items.filter((x) => !x.createdAt);
        if (missing.length) {
            // limit concurrency to avoid bursts
            const MAX_CONCURRENCY = 3;
            const q = [...missing];
            const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, q.length) }, async () => {
                while (q.length) {
                    const row = q.shift();
                    try {
                        const r = await fetch(`${DAILY_API_BASE}/recordings/${row.id}`, {
                            headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
                            cache: "no-store",
                        });
                        if (r.ok) {
                            const d = await r.json();
                            const rawDetail =
                                d.created_at ?? d.createdAt ?? d.created ??
                                d.start_time ?? d.start ?? d.start_ts ?? null;
                            row.createdAt = toMs(rawDetail);
                        }
                    } catch { }
                }
            });
            await Promise.all(workers);
        }

        const nextCursor = json?.paging?.next?.starting_after || null;
        return NextResponse.json({ ok: true, items, nextCursor });
    } catch (e) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
