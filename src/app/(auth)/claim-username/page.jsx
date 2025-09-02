// app/claim-username/page.jsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import Swal from "sweetalert2";
import { app, db } from "@/firebaseConfig";
import { createUserProfileWithUsername, normalizeUsername } from "@/lib/userProfile";

export default function ClaimUsernamePage() {
    const router = useRouter();
    const auth = getAuth(app);
    const [user, setUser] = useState(null);
    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    // Require auth; if already has username, skip this page
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (!u) { router.replace("/login"); return; }
            setUser(u);
            // check profile
            try {
                const snap = await getDoc(doc(db, "users", u.uid));
                const hasUsername = snap.exists() && !!snap.data()?.username;
                if (hasUsername) router.replace("/dashboard");
            } finally {
                setLoading(false);
            }
        });
        return () => unsub();
    }, [auth, router]);

    async function onSubmit(e) {
        e.preventDefault();
        if (!user || submitting) return;
        try {
            setError("");
            setSubmitting(true);
            const handle = normalizeUsername(username);
            await createUserProfileWithUsername(user, handle);
            await Swal.fire({ icon: "success", title: "Username saved", timer: 1200, showConfirmButton: false });
            router.replace("/dashboard");
        } catch (e2) {
            setError(e2?.message ?? "Could not save username");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) return <div className="p-6 text-white/80">Loading…</div>;

    return (
        <section className="w-full max-w-md mx-auto">
            <div className="p-6 border shadow-2xl rounded-3xl border-white/20 bg-white/10 backdrop-blur-md sm:p-8">
                <h1 className="mb-2 text-2xl font-semibold text-white">Choose a username</h1>
                {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

                <form onSubmit={onSubmit} className="space-y-3">
                    <div>
                        <label className="block mb-1 text-xs text-white/70">Username</label>
                        <input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="w-full px-3 py-2 text-white border outline-none rounded-xl bg-white/10 border-white/25 focus:ring focus:ring-white/30 placeholder:text-white/50"
                            placeholder="your_handle"
                        />
                        <p className="mt-1 text-[11px] text-white/60">
                            3–20 chars, letters/numbers/underscore.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-2.5 rounded-xl bg-white/90 text-black font-medium hover:bg-white disabled:opacity-60"
                    >
                        {submitting ? "Saving…" : "Save username"}
                    </button>
                </form>
            </div>
        </section>
    );
}
