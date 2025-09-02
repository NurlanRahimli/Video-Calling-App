// src/app/(app)/recordings/library/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import {
    collection,
    onSnapshot,
    query,
    where,
    updateDoc,
    doc,
} from "firebase/firestore";
import { ref, getDownloadURL, listAll } from "firebase/storage";
import { db, storage } from "@/firebaseConfig";
import { useAuth } from "@/app/auth-provider";
import { MoreVertical, Pencil, Trash2, X } from "lucide-react";

/* ---------- utils ---------- */
function fmtDuration(sec = 0) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function resolveRoom(data = {}) {
    return (
        data.room ||
        data.roomName ||
        data.room_id ||
        data.roomId ||
        data?.room?.name ||
        data?.metadata?.room ||
        data?.metadata?.roomName ||
        null
    );
}

/** Try to resolve the correct Storage path for a recording and persist it.
 *  Strategy:
 *   1) Try existing data.storagePath (if present)
 *   2) Try canonical guess: recordings/${ownerId}/${docId}/source.mp4
 *   3) List the folder and pick a reasonable file (source.*, *.mp4, *.webm)
 *  Returns: { url, path } where url may be null if not found.
 */
// helpers to compare paths without hitting the network
function pathLooksLike(path, ownerId, docId) {
    if (!path) return false;
    const parts = path.split("/");
    // recordings/<ownerId>/<docId>/...
    return parts[0] === "recordings" && parts[1] === ownerId && parts[2] === docId && parts.length >= 4;
}

// Always derive from folder and persist the exact fullPath.
// No probing => no 404 noise.
async function resolveUrlAndFixPath(d, data) {
    const ownerId = data.ownerId;
    const docId = d.id;

    if (!ownerId || !docId) {
        console.warn("Missing ownerId or docId on", docId);
        return { url: null, path: data.storagePath ?? null };
    }

    try {
        const folder = `recordings/${ownerId}/${docId}`;
        const { items } = await listAll(ref(storage, folder));

        // Choose a best file
        const pick =
            items.find(i => i.name.startsWith("source.")) ||
            items.find(i => i.name.endsWith(".mp4")) ||
            items.find(i => i.name.endsWith(".webm")) ||
            items[0];

        if (!pick) {
            console.warn("No files under", folder);
            return { url: null, path: null };
        }

        const url = await getDownloadURL(pick);

        // Persist correct path if needed
        if (pick.fullPath !== data.storagePath) {
            try {
                await updateDoc(fsDoc(db, "recordings", docId), { storagePath: pick.fullPath });
            } catch (e) {
                console.error("Failed to persist fixed storagePath:", e);
            }
        }

        return { url, path: pick.fullPath };
    } catch (e) {
        console.error("Failed to list/resolve folder:", e);
        return { url: null, path: data.storagePath ?? null };
    }
}

/* ---------- Edit Modal ---------- */
function EditTitleModal({ open, initialTitle, onClose, onSave, busy }) {
    const [title, setTitle] = useState(initialTitle || "");
    useEffect(() => {
        if (open) setTitle(initialTitle || "");
    }, [open, initialTitle]);

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            {/* dialog */}
            <div className="relative w-full max-w-md p-5 text-white border rounded-2xl border-white/20 bg-white/10">
                <button
                    className="absolute p-1 border rounded-lg right-3 top-3 border-white/20 bg-white/10 hover:bg-white/20"
                    onClick={onClose}
                    aria-label="Close"
                >
                    <X size={16} />
                </button>
                <h3 className="mb-3 text-lg font-semibold">Edit title</h3>
                <input
                    className="w-full px-3 py-2 border outline-none rounded-xl border-white/20 bg-white/10 placeholder:text-white/50"
                    placeholder="Enter title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
                <div className="flex justify-end gap-2 mt-4">
                    <button
                        className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 hover:bg-white/20"
                        onClick={onClose}
                        disabled={busy}
                    >
                        Cancel
                    </button>
                    <button
                        className="rounded-xl border border-white/30 bg-white/20 px-3 py-1.5 font-medium hover:bg-white/30 disabled:opacity-60"
                        onClick={() => onSave(title.trim())}
                        disabled={busy || !title.trim()}
                    >
                        {busy ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ---------- card ---------- */
function Card({ item, onEdited, onDeleted }) {
    const { user } = useAuth(); // ✅ bring user into scope
    const [menuOpen, setMenuOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const handleSaveTitle = async (newTitle) => {
        setBusy(true);
        try {
            await updateDoc(doc(db, "recordings", item.id), { title: newTitle });
            onEdited?.(item.id, { title: newTitle });
            setEditOpen(false);
        } catch (e) {
            console.error(e);
            alert("Failed to save title.");
        } finally {
            setBusy(false);
        }
    };

    // in Card.handleDelete
    const handleDelete = async () => {
        const yes = confirm("Delete this recording from your Library? This cannot be undone.");
        if (!yes) return;
        setBusy(true);
        try {
            const idToken = await user?.getIdToken?.();
            if (!idToken) throw new Error("Not signed in");

            const res = await fetch(`/api/recordings/${item.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${idToken}` },
            });

            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                throw new Error(txt || "Delete failed");
            }

            // Optimistic UI; onSnapshot will also remove it soon
            onDeleted?.(item.id);
        } catch (e) {
            console.error(e);
            alert("Failed to delete recording.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="group overflow-hidden rounded-[22px] border border-white/20 bg-white/10 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,.35)]">
            <div className="relative overflow-hidden aspect-video">
                {item.thumb ? (
                    <img src={item.thumb} alt={item.title} className="object-cover w-full h-full" />
                ) : (
                    <div className="h-full w-full bg-gradient-to-br from-[#3b0e22] via-[#511430] to-[#1b0711]" />
                )}

                {!!item.durationSec && (
                    <span className="absolute bottom-3 left-3 rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur-md">
                        {fmtDuration(item.durationSec)}
                    </span>
                )}

                <div className="absolute right-2 top-2">
                    <button
                        className="p-2 border rounded-lg border-white/20 bg-white/10 hover:bg-white/20"
                        onClick={() => setMenuOpen((v) => !v)}
                    >
                        <MoreVertical size={16} />
                    </button>

                    {menuOpen && (
                        <div className="absolute right-0 w-40 mt-2 overflow-hidden text-sm border shadow-xl rounded-xl border-white/20 bg-white/10 backdrop-blur-xl">
                            <button
                                className="flex items-center w-full gap-2 px-3 py-2 hover:bg-white/10"
                                onClick={() => {
                                    setMenuOpen(false);
                                    setEditOpen(true);
                                }}
                            >
                                <Pencil size={14} />
                                Edit title
                            </button>
                            <button
                                className="flex items-center w-full gap-2 px-3 py-2 text-red-300 hover:bg-white/10"
                                onClick={() => {
                                    setMenuOpen(false);
                                    handleDelete();
                                }}
                                disabled={busy}
                            >
                                <Trash2 size={14} />
                                Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4">
                <div className="text-base font-semibold leading-snug md:text-lg line-clamp-1">
                    {item.title || `Recording ${item.id.slice(0, 6)}`}
                </div>
                <div className="mt-1 text-xs">
                    <span className="text-white/60">Room:&nbsp;</span>
                    <span className="text-white/90">{item.roomResolved || "—"}</span>
                </div>

                <div className="flex items-center gap-2 mt-4">
                    {item.url && (
                        <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
                        >
                            Play
                        </a>
                    )}
                </div>
            </div>

            <EditTitleModal
                open={editOpen}
                initialTitle={item.title || ""}
                onClose={() => setEditOpen(false)}
                onSave={handleSaveTitle}
                busy={busy}
            />
        </div>
    );
}

/* ---------- page ---------- */
export default function LibraryRecordingsPage() {
    const { user } = useAuth();
    const [items, setItems] = useState([]);

    useEffect(() => {
        if (!user) return;

        const q = query(collection(db, "recordings"), where("ownerId", "==", user.uid));

        const unsub = onSnapshot(q, async (snap) => {
            const out = [];

            for (const d of snap.docs) {
                const data = d.data();
                let url = null;

                try {
                    const res = await resolveUrlAndFixPath(d, data);
                    url = res.url; // may be null if not found/authorized
                } catch (err) {
                    // Keep UI alive; show no "Play" button if we couldn't resolve
                    console.error("Failed to resolve URL for", d.id, err);
                }

                out.push({
                    id: d.id,
                    ...data,
                    url,
                    roomResolved: resolveRoom(data),
                });
            }

            out.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
            setItems(out);
        });

        return () => unsub();
    }, [user]);

    console.log("auth.uid", user?.uid);
    const list = useMemo(() => items, [items]);

    const applyEdit = (id, patch) =>
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    const applyDelete = (id) => setItems((prev) => prev.filter((it) => it.id !== id));

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-6 rounded-[30px] border border-white/20 bg-white/10 p-6 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,.35)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">My Library</h1>
                        <p className="mt-1 text-white/80">Watch recordings you’ve saved from Daily.</p>
                    </div>
                    <span className="px-3 py-1 text-xs border rounded-full border-white/20 bg-white/10">
                        Stored in Firebase
                    </span>
                </div>
            </div>

            {list.length === 0 ? (
                <div className="text-white/80">No recordings yet. Go to Cloud and “Download to Library”.</div>
            ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {list.map((it) => (
                        <Card key={it.id} item={it} onEdited={applyEdit} onDeleted={applyDelete} />
                    ))}
                </div>
            )}
        </div>
    );
}
