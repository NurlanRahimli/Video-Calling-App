"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, waitForAppCheck } from "@/firebaseConfig";
import { loginWithGoogle, loginWithGithub, completeRedirectLogin } from "@/lib/firebaseService";

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let unsub = () => { };

        (async () => {
            // ensure App Check token is ready before anything
            await waitForAppCheck();

            // finish redirect sign-in (mobile)
            await completeRedirectLogin();

            // now listen and navigate when signed in (works for popup & redirect)
            unsub = onAuthStateChanged(auth, (user) => {
                if (user) router.replace("/dashboard");
            });
        })();

        return () => unsub();
    }, [router]);

    async function handle(providerFn, key) {
        try {
            setError("");
            if (loading) return;
            setLoading(key);

            // For popup this returns a user; for redirect it returns null
            const user = await providerFn();
            if (!user) return; // redirect flow continues after reload; auth listener will navigate
        } catch (e) {
            if (e?.code === "auth/popup-closed-by-user" || e?.code === "auth/cancelled-popup-request") {
                setLoading(null);
                return;
            }
            if (e?.code === "auth/popup-blocked") {
                try {
                    await providerFn({ useRedirect: true }); // fallback for mobile
                    setLoading(null);
                    return;
                } catch (e2) {
                    console.error(e2);
                }
            }
            console.error(e);
            setError(e?.message || e?.code || "Sign-in failed");
        } finally {
            setLoading(null);
        }
    }

    return (
        <section className="w-full max-w-md mx-auto">
            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
            <button onClick={() => handle(loginWithGoogle, "google")}>Google</button>
            <button onClick={() => handle(loginWithGithub, "github")}>GitHub</button>
        </section>
    );
}
