// components/InvitePanel.jsx
"use client";
import { X, Copy, Users } from "lucide-react";
import { useEffect, useState } from "react";

export default function InvitePanel({ open, onClose, meetingId, roomUrl }) {
    if (!open) return null;
    const [copied, setCopied] = useState(false);

    const appLink =
        typeof window !== "undefined" && meetingId
            ? `${window.location.origin}/meeting/${meetingId}`
            : "";

    async function copy(text) {
        try {
            await navigator.clipboard.writeText(text || "");
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch { }
    }

    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose?.();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <>
            <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <aside role="dialog" aria-modal="true"
                className="fixed left-0 top-0 z-[100] h-dvh w-[92vw] max-w-sm
                   bg-neutral-900/95 text-white shadow-2xl ring-1 ring-white/10
                   transform transition-transform duration-300 translate-x-0">
                <div className="relative p-4">
                    <button onClick={onClose}
                        className="absolute grid rounded-full right-3 top-3 h-9 w-9 place-items-center bg-white/10 hover:bg-white/20">
                        <X size={18} />
                    </button>

                    <div className="flex items-center gap-2 mt-1">
                        <div className="grid rounded-full h-9 w-9 place-items-center bg-blue-500/20 ring-1 ring-white/10">
                            <Users size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold">Everything is ready for the meeting.</h3>
                            <p className="text-sm text-white/70">Share the link below.</p>
                        </div>
                    </div>

                    <div className="mt-4 space-y-3">
                        {/* Primary: your app link */}
                        <div>
                            <label className="block mb-1 text-xs font-medium text-white/70">Share this app link</label>
                            <div className="flex items-center gap-2">
                                <input readOnly value={appLink} className="w-full px-3 py-2 text-sm outline-none rounded-xl bg-neutral-800 ring-1 ring-white/10" />
                                <button onClick={() => copy(appLink)}
                                    className="px-3 py-2 text-sm rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/10">
                                    <Copy size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Optional: advanced (Daily) */}
                        <div>
                            <label className="block mb-1 text-xs font-medium text-white/70">Daily room (optional)</label>
                            <div className="flex items-center gap-2">
                                <input readOnly value={roomUrl || ""} className="w-full px-3 py-2 text-sm outline-none rounded-xl bg-neutral-800 ring-1 ring-white/10" />
                                <button onClick={() => copy(roomUrl || "")}
                                    className="px-3 py-2 text-sm rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/10">
                                    <Copy size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="p-3 mt-2 text-xs rounded-lg bg-white/5 text-white/70 ring-1 ring-white/10">
                            Guests using the app link will appear in participants and tiles.
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}
