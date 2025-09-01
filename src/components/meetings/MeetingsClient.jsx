// app/.../MeetingsClient.jsx (or wherever your component lives)
"use client";
import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import MeetingItem from "@/components/meetings/MeetingItem";
import {
    listMyMeetingsPage,        // <-- new
    fetchParticipantsPreview,
} from "@/lib/firestore/meetings";
import { db } from "@/firebaseConfig";

export default function MeetingsClient() {
    const [rows, setRows] = useState([]);
    const [cursor, setCursor] = useState(null);           // participant-doc cursor
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [authReady, setAuthReady] = useState(false);
    const [err, setErr] = useState(null);

    const PAGE_SIZE = 10;

    // 0) Ensure we're authenticated
    useEffect(() => {
        const auth = getAuth();
        const unsub = onAuthStateChanged(auth, async (u) => {
            try {
                if (!u) {
                    await signInAnonymously(auth);
                    return; // wait for the next onAuthStateChanged with a real user
                }
                // we have a user now
                setAuthReady(true);
            } catch (e) {
                console.error("[auth] signInAnonymously failed", e);
                setErr(e?.message || "Auth error");
                setAuthReady(false);
            }
        });
        return () => unsub();
    }, []);

    // helper to attach participants preview for avatars
    const hydrateParticipants = useCallback(async (meetings) => {
        const previews = await Promise.all(
            meetings.map((m) => fetchParticipantsPreview(m.id, 5).catch(() => []))
        );
        return meetings.map((m, i) => ({ ...m, participants: previews[i] }));
    }, []);

    const loadFirst = useCallback(async () => {
        if (!authReady) return;
        setLoading(true);
        setErr(null);
        try {
            // @ts-ignore internal field
            console.log("[firestore] project:", db.app?.options?.projectId);

            const auth = getAuth();
            const uid = auth.currentUser?.uid;
            if (!uid) throw new Error("No current user");

            // Only meetings the user participated in
            const { items, nextCursor } = await listMyMeetingsPage({
                uid,
                pageSize: PAGE_SIZE,
                endedOnly: false, // or true if you only want finished meetings
            });

            const hydrated = await hydrateParticipants(items);
            setRows(hydrated);
            setCursor(nextCursor);
        } catch (e) {
            console.error("[/meetings] loadFirst error:", e);
            setErr(e?.message || "Failed to load meetings");
        } finally {
            setLoading(false);
        }
    }, [authReady, hydrateParticipants]);

    const loadMore = useCallback(async () => {
        if (!cursor) return;
        setLoadingMore(true);
        try {
            const auth = getAuth();
            const uid = auth.currentUser?.uid;
            if (!uid) throw new Error("No current user");

            const { items, nextCursor } = await listMyMeetingsPage({
                uid,
                pageSize: PAGE_SIZE,
                cursor,           // <-- participant-doc cursor from previous page
                endedOnly: false,
            });

            const hydrated = await hydrateParticipants(items);
            setRows((prev) => [...prev, ...hydrated]);
            setCursor(nextCursor);
        } catch (e) {
            console.error("[/meetings] loadMore error:", e);
            setErr(e?.message || "Failed to load more");
        } finally {
            setLoadingMore(false);
        }
    }, [cursor, hydrateParticipants]);

    useEffect(() => {
        loadFirst();
    }, [loadFirst]);

    return (
        <main className="max-w-3xl px-4 py-6 mx-auto sm:py-8">
            <h1 className="mb-4 text-xl font-bold sm:text-2xl text-slate-100">
                Previous Meetings
            </h1>

            {err && (
                <div className="px-3 py-2 mb-4 text-sm text-red-200 border bg-red-900/40 border-red-700/40 rounded-xl">
                    {err}
                </div>
            )}

            {loading ? (
                // ... your skeleton UI (unchanged) ...
                <div className="space-y-3 sm:space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div
                            key={i}
                            className="rounded-3xl p-5 bg-white/10 backdrop-blur-md border border-white/20 ring-1 ring-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                        >
                            <div className="flex items-center justify-between">
                                <div className="w-40 h-5 rounded bg-white/20 animate-pulse" />
                                <div className="w-16 h-4 rounded bg-white/20 animate-pulse" />
                            </div>
                            <div className="w-56 h-4 mt-3 rounded bg-white/20 animate-pulse" />
                            <div className="flex mt-4 -space-x-2">
                                {[...Array(5)].map((__, j) => (
                                    <div
                                        key={j}
                                        className="rounded-full h-7 w-7 bg-white/20 ring-2 ring-white/30 animate-pulse"
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : rows.length === 0 ? (
                <div className="p-8 text-center border rounded-3xl bg-white/5 border-white/10 text-white/70">
                    No past meetings yet.
                </div>
            ) : (
                <>
                    <div className="grid gap-3 sm:gap-4">
                        {rows.map((m, i) => (
                            <MeetingItem key={m.id} meeting={m} index={i} />
                        ))}
                    </div>
                    <div className="flex justify-center mt-5">
                        <button
                            disabled={!cursor || loadingMore}
                            onClick={loadMore}
                            className="px-4 py-2 text-white rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur hover:bg-white/15 disabled:opacity-50"
                        >
                            {loadingMore ? "Loading…" : cursor ? "Load more" : "No more"}
                        </button>
                    </div>
                </>
            )}
        </main>
    );
}
