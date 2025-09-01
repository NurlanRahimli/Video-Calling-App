// src/app/(app)/recordings/cloud/page.js
"use client";

import { useEffect, useState } from "react";
import { MoreVertical, Trash2 } from "lucide-react";
import { useAuth } from "@/app/auth-provider";
import Swal from "sweetalert2";

/* ---------- helpers ---------- */
const fmtUTC = (ms) =>
    ms
        ? new Intl.DateTimeFormat(undefined, {
            timeZone: "UTC",
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        }).format(ms)
        : "—";

const computeTitle = (it) =>
    it?.room ? `${it.room} – ${String(it.id).slice(0, 6)}` : `Recording ${String(it.id).slice(0, 6)}`;

const escapeHtml = (s = "") =>
    s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

/* ---------- row actions (kebab) ---------- */
function KebabMenu({ onDownload, onDelete }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative hidden md:inline-block">
            <button
                onClick={() => setOpen((v) => !v)}
                className="p-2 border rounded-lg border-white/15 bg-white/10 hover:bg-white/20"
                aria-label="Open actions"
            >
                <MoreVertical size={16} />
            </button>

            {open && (
                <div
                    className="absolute right-0 z-20 w-48 mt-2 overflow-hidden border shadow-2xl rounded-2xl border-white/15 bg-white/10 backdrop-blur-xl"
                    onMouseLeave={() => setOpen(false)}
                >
                    <button
                        onClick={() => {
                            setOpen(false);
                            onDownload?.();
                        }}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-white/10"
                    >
                        Download to Library
                    </button>

                    {/* Divider */}
                    <div className="h-px my-1 bg-white/10" />

                    <button
                        onClick={() => {
                            setOpen(false);
                            onDelete?.();
                        }}
                        className="flex items-center w-full gap-2 px-3 py-2 text-sm text-left text-red-300 hover:bg-white/10"
                    >
                        <Trash2 size={14} />
                        Delete from Daily
                    </button>
                </div>
            )}
        </div>
    );
}

/* ---------- page ---------- */
export default function CloudRecordingsPage() {
    const { user } = useAuth();

    const [items, setItems] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);

    async function load(c) {
        setLoading(true);
        const url = new URL("/api/daily/recordings/list", window.location.origin);
        if (c) url.searchParams.set("cursor", c);
        const r = await fetch(url, { cache: "no-store" });
        const json = await r.json();
        if (json.ok) {
            setItems(json.items || []);
            setCursor(json.nextCursor || null);
        } else {
            await Swal.fire({ icon: "error", title: "Load failed", text: json.error || "Failed to load recordings" });
        }
        setLoading(false);
    }

    useEffect(() => {
        load();
    }, []);

    async function ingest(item) {
        if (!user) return Swal.fire({ icon: "warning", title: "Please sign in" });
        setBusyId(item.id);
        try {
            const idToken = await user.getIdToken();
            const r = await fetch(`/api/daily/recordings/${item.id}/ingest`, {
                method: "POST",
                headers: { Authorization: `Bearer ${idToken}` },
            });
            const json = await r.json();
            if (!json.ok) throw new Error(json.error || "Ingest failed");

            const title = json.title || computeTitle(item);
            await Swal.fire({
                icon: "success",
                title: "Saved to Library",
                html: `You have downloaded <b>${escapeHtml(title)}</b>.`,
                footer: '<a href="/recordings/library" style="text-decoration:underline">Go to /recordings/library</a>',
                confirmButtonText: "OK",
            });
        } catch (e) {
            await Swal.fire({ icon: "error", title: "Download failed", text: e.message || "Something went wrong." });
        } finally {
            setBusyId(null);
        }
    }

    async function deleteFromDaily(item) {
        if (!user) return Swal.fire({ icon: "warning", title: "Please sign in" });

        const { isConfirmed } = await Swal.fire({
            icon: "warning",
            title: "Delete recording?",
            html: `This will permanently delete <b>${escapeHtml(item.id)}</b> from Daily.`,
            showCancelButton: true,
            confirmButtonText: "Delete",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#ef4444",
        });
        if (!isConfirmed) return;

        setBusyId(item.id);
        try {
            const idToken = await user.getIdToken();
            const r = await fetch(`/api/daily/recordings/${item.id}/delete`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${idToken}` },
            });
            const json = await r.json();
            if (!json.ok) throw new Error(json.error || "Delete failed");

            setItems((prev) => prev.filter((x) => x.id !== item.id));
            await Swal.fire({ icon: "success", title: "Deleted", text: "Recording removed from Daily." });
        } catch (e) {
            await Swal.fire({ icon: "error", title: "Delete failed", text: e.message || "Something went wrong." });
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header card */}
            <div className="mb-6 rounded-[30px] border border-white/20 bg-white/10 p-6 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,.35)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Recordings</h1>
                        <p className="mt-1 text-white/80">
                            These live on Daily. Use <span className="font-semibold">Download to Library</span> to save &amp; watch
                            in-app.
                        </p>
                    </div>
                    <span className="px-3 py-1 text-xs border rounded-full border-white/20 bg-white/10">Cloud (Daily)</span>
                </div>
            </div>

            {/* Desktop table (md+) */}
            <div className="hidden overflow-hidden rounded-[30px] border border-white/20 bg-white/10 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,.35)] md:block">
                <table className="w-full text-sm text-left">
                    <thead className="border-b border-white/15 text-white/85">
                        <tr>
                            <th className="px-5 py-3 font-medium">Recording ID</th>
                            <th className="px-5 py-3 font-medium text-right">Date created (UTC)</th>
                            <th className="w-20 px-5 py-3 font-medium text-right"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td className="px-5 py-6" colSpan={3}>
                                    Loading…
                                </td>
                            </tr>
                        ) : items.length === 0 ? (
                            <tr>
                                <td className="px-5 py-6" colSpan={3}>
                                    No recordings found.
                                </td>
                            </tr>
                        ) : (
                            items.map((it, idx) => (
                                <tr
                                    key={it.id}
                                    className={idx % 2 === 1 ? "border-b border-white/10 bg-white/[0.03]" : "border-b border-white/10"}
                                >
                                    <td className="px-5 py-4 align-top">
                                        <div className="font-mono text-sm truncate">{it.id}</div>
                                        <div className="text-xs text-white/70">Room: {it.room ?? "—"}</div>
                                    </td>
                                    <td className="px-5 py-4 text-sm text-right align-middle text-white/90">{fmtUTC(it.createdAt)}</td>
                                    <td className="px-5 py-4 text-right align-middle ">
                                        <KebabMenu onDownload={() => ingest(it)} onDelete={() => deleteFromDaily(it)} />
                                        {busyId === it.id && <span className="ml-2 text-xs opacity-80">Working…</span>}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pager */}
                <div className="flex items-center justify-end gap-3 p-3">
                    <button
                        onClick={() => load(cursor)}
                        disabled={!cursor || loading}
                        className="rounded-xl border border-white/20 bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25 disabled:opacity-60"
                    >
                        Next Page
                    </button>
                </div>
            </div>

            {/* Mobile cards (< md) */}
            <div className="space-y-3 md:hidden">
                {loading ? (
                    <div className="p-4 text-sm border rounded-2xl border-white/20 bg-white/10">Loading…</div>
                ) : items.length === 0 ? (
                    <div className="p-4 text-sm border rounded-2xl border-white/20 bg-white/10">No recordings found.</div>
                ) : (
                    items.map((it) => (
                        <div
                            key={it.id}
                            className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,.35)]"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-mono text-xs truncate">{it.id}</div>
                                    <div className="mt-1 text-[11px] text-white/70">Room: {it.room ?? "—"}</div>
                                </div>
                                <KebabMenu onDownload={() => ingest(it)} onDelete={() => deleteFromDaily(it)} />
                            </div>

                            <div className="mt-3 text-xs text-right text-white/85">{fmtUTC(it.createdAt)}</div>

                            {/* inline buttons for small screens */}
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={() => ingest(it)}
                                    className="flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
                                >
                                    Download to Library
                                </button>
                                <button
                                    onClick={() => deleteFromDaily(it)}
                                    className="flex-1 rounded-xl border border-red-300/40 bg-red-300/10 px-3 py-1.5 text-sm text-red-200 hover:bg-red-300/20"
                                >
                                    Delete
                                </button>
                            </div>

                            {busyId === it.id && <div className="mt-2 text-right text-[11px] opacity-80">Working…</div>}
                        </div>
                    ))
                )}

                {/* Mobile pager */}
                <div className="flex justify-end">
                    <button
                        onClick={() => load(cursor)}
                        disabled={!cursor || loading}
                        className="rounded-xl border border-white/20 bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25 disabled:opacity-60"
                    >
                        Next Page
                    </button>
                </div>
            </div>
        </div>
    );
}
