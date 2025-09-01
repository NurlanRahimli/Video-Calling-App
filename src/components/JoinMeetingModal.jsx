"use client";
import { X, Link2, LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/firebaseConfig";
import { collection, getDocs, limit, query, where } from "firebase/firestore";

export default function JoinMeetingModal({ open, onClose }) {
    if (!open) return null;

    const [value, setValue] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose?.();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    function parseInput(raw) {
        const s = (raw || "").trim();

        // Try URL parsing
        try {
            const u = new URL(s);

            // App link: .../meeting/{id}
            const appMatch = u.pathname.match(/\/meeting\/([^/?#]+)/i);
            if (appMatch?.[1]) return { kind: "meetingId", meetingId: appMatch[1] };

            // Any Daily URL: host can be anything, e.g. foo.daily.co
            const isDaily = /\.daily\.co$/i.test(u.hostname);
            if (isDaily) {
                const parts = u.pathname.split("/").filter(Boolean);
                const roomName = parts[parts.length - 1] || "";
                return { kind: "dailyUrl", url: s, roomName };
            }
        } catch {
            // not a URL → fall through
        }

        // Plain token: could be a meeting id in your app, or a Daily room name
        if (/^[A-Za-z0-9_-]+$/.test(s)) {
            return { kind: "token", token: s };
        }

        return { kind: "unknown" };
    }

    async function resolveMeetingId(parsed) {
        // If we already have the app meeting id, done
        if (parsed.kind === "meetingId") return parsed.meetingId;

        // If we got a full Daily URL, try exact match on roomUrl first
        if (parsed.kind === "dailyUrl" && parsed.url) {
            const q1 = query(
                collection(db, "meetings"),
                where("daily.roomUrl", "==", parsed.url),
                limit(1)
            );
            const s1 = await getDocs(q1);
            if (!s1.empty) return s1.docs[0].id;

            // fallback: match by roomName
            if (parsed.roomName) {
                const q2 = query(
                    collection(db, "meetings"),
                    where("daily.roomName", "==", parsed.roomName),
                    limit(1)
                );
                const s2 = await getDocs(q2);
                if (!s2.empty) return s2.docs[0].id;
            }
            return null;
        }

        // If it's a plain token, try as meeting id first…
        if (parsed.kind === "token") {
            // quick existence check by id (optional; you can just navigate)
            // but if you want to verify via roomName too:
            const byRoom = query(
                collection(db, "meetings"),
                where("daily.roomName", "==", parsed.token),
                limit(1)
            );
            const s = await getDocs(byRoom);
            if (!s.empty) return s.docs[0].id;

            // assume it's already a meeting id and navigate (your page will 404 if not found)
            return parsed.token;
        }

        return null;
    }

    async function join() {
        setError("");
        const parsed = parseInput(value);
        const meetingId = await resolveMeetingId(parsed);
        if (!meetingId) {
            setError("Couldn’t find a meeting for that link or code.");
            return;
        }
        router.push(`/meeting/${meetingId}`);
        onClose?.();
    }

    return (
        <>
            <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed inset-0 z-[100] grid place-items-center">
                <div className="relative w-[92vw] max-w-md rounded-2xl bg-neutral-900 text-white ring-1 ring-white/10 shadow-2xl">
                    <button
                        onClick={onClose}
                        className="absolute grid rounded-full cursor-pointer right-3 top-3 h-9 w-9 place-items-center bg-white/10 hover:bg-white/20"
                        title="Close"
                    >
                        <X size={18} />
                    </button>

                    <div className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="grid rounded-lg h-9 w-9 place-items-center bg-white/10">
                                <Link2 size={16} />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold leading-tight">Join Meeting</h3>
                                <p className="text-sm text-white/70">
                                    Paste an app link, a Daily link, or a meeting/room code
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder="http://localhost:3000/meeting/abc123 • https://your.daily.co/room • abc123"
                                className="w-full px-3 py-2 text-sm outline-none rounded-xl bg-neutral-800 ring-1 ring-white/10 placeholder:text-white/40"
                            />
                            <button
                                onClick={join}
                                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border cursor-pointer bg-white/15 hover:bg-white/25 border-white/20 disabled:opacity-60 rounded-xl"
                            >
                                <LogIn size={16} />
                                Join
                            </button>
                        </div>

                        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
                    </div>
                </div>
            </div>
        </>
    );
}
