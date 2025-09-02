// app/(auth)/register/page.js
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUpWithEmailAndUsername } from "@/lib/emailAuth";
import Swal from "sweetalert2";

export default function RegisterPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [username, setUsername] = useState(""); // NEW
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");

    async function onSubmit(e) {
        e.preventDefault();
        if (loading) return;

        try {
            setError("");
            if (password !== confirm) {
                setError("Passwords do not match");
                return;
            }
            setLoading(true);

            const actionCodeSettings = {
                url: `${window.location.origin}/login`,
                handleCodeInApp: true,
            };

            const { verificationSent } = await signUpWithEmailAndUsername({
                email: email.trim(),
                password,
                username,             // required & unique
                actionCodeSettings,
            });

            await Swal.fire({
                icon: "success",
                title: verificationSent ? "Confirmation link sent" : "Account created",
                text: verificationSent
                    ? "We sent a confirmation link to your email. Please check your inbox."
                    : "Your account was created.",
                confirmButtonText: "OK",
            });

            // You can keep them here or send them to login
            // router.push("/login");
        } catch (e) {
            console.error(e);
            setError(e?.message ?? e?.code ?? "Registration failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <section className="w-full max-w-md mx-auto">
            <div className="p-6 border shadow-2xl rounded-3xl border-white/20 bg-white/10 backdrop-blur-md sm:p-8">
                <div className="mb-6 text-center">
                    <h1 className="mt-2 text-2xl font-semibold text-white">Create account</h1>
                    {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
                </div>

                <form onSubmit={onSubmit} className="space-y-3">
                    <div>
                        <label className="block mb-1 text-xs text-white/70">Username</label>
                        <input
                            value={username}
                            required
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-3 py-2 text-white border outline-none rounded-xl bg-white/10 border-white/25 focus:ring focus:ring-white/30 placeholder:text-white/50"
                            placeholder="your_handle"
                        />
                        <p className="mt-1 text-[11px] text-white/60">
                            3–20 chars, letters/numbers/underscore.
                        </p>
                    </div>

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

                    <div>
                        <label className="block mb-1 text-xs text-white/70">Confirm password</label>
                        <input
                            type="password"
                            required
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            className="w-full px-3 py-2 text-white border outline-none rounded-xl bg-white/10 border-white/25 focus:ring focus:ring-white/30 placeholder:text-white/50"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 rounded-xl bg-white/90 text-black font-medium hover:bg-white disabled:opacity-60"
                    >
                        {loading ? "Creating account…" : "Create account"}
                    </button>

                    <p className="text-xs text-center text-white/70">
                        Already have an account?{" "}
                        <a href="/login" className="underline hover:no-underline">Log in</a>
                    </p>
                </form>
            </div>
        </section>
    );
}
