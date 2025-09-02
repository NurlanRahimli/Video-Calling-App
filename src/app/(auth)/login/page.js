"use client";
// ✅ React hooks come from 'react'
import { useEffect, useRef, useState } from "react";

// ✅ Only router comes from 'next/navigation'
import { useRouter } from "next/navigation";
import { loginWithGoogle, loginWithGithub, completeRedirectLogin } from "@/lib/firebaseService";
import { signInWithEmail } from "@/lib/emailAuth"; // make sure this returns { user, hasProfile } OR just user; see note below
import { sendEmailVerification } from "firebase/auth";
import { ensureUserDoc } from "@/lib/userProfile"; // <-- use the helper we added

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(null);
    const [error, setError] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const didCheckRef = useRef(false);

    async function postSignInRoute(user) {
        // 1) Upsert users/{uid} for OAuth or first-time email users
        const { hasUsername } = await ensureUserDoc(user);

        // 2) If you require verified email:
        if (!user.emailVerified && user.providerData.some(p => p.providerId === "password")) {
            setError("Please verify your email. We can resend the link.");
            try {
                await sendEmailVerification(user, {
                    url: `${window.location.origin}/verify-email`,
                    handleCodeInApp: true,
                });
                // optionally show a toast/alert here
            } catch { }
            return; // stop routing until they verify
        }

        // 3) Route based on whether a username exists
        router.replace(hasUsername ? "/dashboard" : "/claim-username");
    }

    async function handle(providerFn, key) {
        try {
            setError("");
            if (loading) return;
            setLoading(key);

            const user = await providerFn(); // if your fn redirects, it may return null
            if (!user) return; // redirect flow continues elsewhere
            await postSignInRoute(user);
        } catch (e) {
            if (e?.code === "auth/popup-closed-by-user" || e?.code === "auth/cancelled-popup-request") {
                setLoading(null);
                return;
            }
            if (e?.code === "auth/popup-blocked" || e?.code === "auth/operation-not-supported-in-this-environment") {
                // Fallback to redirect if your provider supports it
                try {
                    await providerFn({ useRedirect: true });
                } catch (e2) {
                    console.error(e2);
                    setError(e2?.message ?? e2?.code ?? "Sign-in failed");
                } finally {
                    setLoading(null);
                }
                return;
            }
            console.error(e);
            setError(e?.message ?? e?.code ?? "Sign-in failed");
        } finally {
            setLoading(null);
        }
    }

    async function handleEmailLogin(e) {
        e.preventDefault();
        try {
            setError("");
            if (loading) return;
            setLoading("email");

            // IMPORTANT: what does your helper return?
            // If it returns { user, hasProfile }: destructure it.
            // If it returns just user: keep your original line.
            const result = await signInWithEmail(email.trim(), password);

            const user = result?.user ?? result; // supports both shapes
            if (!user) throw new Error("Email sign-in failed.");
            await postSignInRoute(user);
        } catch (e) {
            console.error(e);
            setError(e?.message ?? e?.code ?? "Email sign-in failed");
        } finally {
            setLoading(null);
        }
    }


    //NEW
    useEffect(() => {
        if (didCheckRef.current) return;
        didCheckRef.current = true;

        (async () => {
            const user = await completeRedirectLogin();
            if (user) {
                // reuse your post-sign-in logic
                await postSignInRoute(user);
            }
        })();
    }, []);

    return (
        <section className="w-full max-w-md mx-auto">
            <div className="p-6 border shadow-2xl rounded-3xl border-white/20 bg-white/10 backdrop-blur-md sm:p-8">
                <div className="mb-6 text-center">
                    <h1 className="mt-2 text-2xl font-semibold text-white">Login</h1>
                    {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
                </div>

                {/* ===== Email / Password form ===== */}
                <form onSubmit={handleEmailLogin} className="space-y-3">
                    <div>
                        <label className="block mb-1 text-xs text-white/70">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 text-white border outline-none rounded-xl bg-white/10 border-white/25 focus:ring focus:ring-white/30 placeholder:text-white/50"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div>
                        <label className="block mb-1 text-xs text-white/70">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 text-white border outline-none rounded-xl bg-white/10 border-white/25 focus:ring focus:ring-white/30 placeholder:text-white/50"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading === "email"}
                        className="w-full py-2.5 rounded-xl bg-white/90 text-black font-medium hover:bg-white disabled:opacity-60"
                    >
                        {loading === "email" ? "Signing in…" : "Sign in with Email"}
                    </button>

                    <p className="text-xs text-center text-white/70">
                        Don&apos;t have an account?{" "}
                        <a href="/register" className="underline hover:no-underline">Create one</a>
                    </p>
                </form>

                {/* Divider */}
                <div className="items-center hidden gap-3 my-5 md:flex">
                    <div className="flex-1 h-px bg-white/20" />
                    <span className="text-xs text-white/70">Or continue with</span>
                    <div className="flex-1 h-px bg-white/20" />
                </div>

                {/* ===== Social buttons (unchanged) ===== */}
                <div className="items-center justify-center hidden gap-3 md:flex ">
                    {/* Google */}
                    <button
                        type="button" aria-label="Google"
                        onClick={() => handle(loginWithGoogle, "google")}
                        className="flex items-center justify-center w-10 h-10 border rounded-xl border-white/25 bg-white/10 backdrop-blur hover:bg-white/20 disabled:opacity-60"
                    >
                        <svg width="20" height="20" viewBox="0 0 48 48">
                            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.621 32.91 29.19 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.155 7.957 3.043l5.657-5.657C33.915 6.026 29.189 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z" />
                            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.814C14.57 16.27 18.918 12 24 12c3.059 0 5.842 1.155 7.957 3.043l5.657-5.657C33.915 6.026 29.189 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                            <path fill="#4CAF50" d="M24 44c5.123 0 9.787-1.953 13.317-5.146l-6.146-5.199C29.199 35.891 26.715 37 24 37c-5.164 0-9.578-3.07-11.292-7.457l-6.534 5.034C9.466 39.561 16.227 44 24 44z" />
                            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.088 3.093-3.57 5.575-6.647 6.646l.001.002 6.146 5.199C33.609 41.797 40 37.5 40 24c0-1.341-.138-2.651-.389-3.917z" />
                        </svg>
                    </button>

                    <button
                        type="button" aria-label="GitHub"
                        onClick={() => handle(loginWithGithub, "github")}
                        className="flex items-center justify-center w-10 h-10 border rounded-xl border-white/25 bg-white/10 backdrop-blur hover:bg-white/20 disabled:opacity-60"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <path d="M12 .5C5.73.5.98 5.24.98 11.5c0 4.85 3.14 8.96 7.5 10.41.55.1.75-.24.75-.53 0-.26-.01-1.12-.02-2.03-3.05.66-3.7-1.3-3.7-1.3-.5-1.28-1.22-1.62-1.22-1.62-.99-.67.08-.66.08-.66 1.1.08 1.68 1.14 1.68 1.14.98 1.68 2.57 1.19 3.2.91.1-.71.38-1.19.7-1.47-2.43-.28-4.98-1.21-4.98-5.37 0-1.19.43-2.16 1.14-2.92-.11-.28-.49-1.42.11-2.96 0 0 .92-.29 3.02 1.12.88-.24 1.82-.35 2.76-.36.94.01 1.88.12 2.76.36 2.1-1.41 3.02-1.12 3.02-1.12.6 1.54.22 2.68.11 2.96.71.76 1.14 1.73 1.14 2.92 0 4.17-2.56 5.08-5 5.36.39.34.74 1.02.74 2.06 0 1.49-.01 2.69-.01 3.06 0 .29.2.64.76.53 4.35-1.45 7.49-5.56 7.49-10.41C23.02 5.24 18.27.5 12 .5z" />
                        </svg>
                    </button>
                </div>
            </div>
        </section>
    );
}
