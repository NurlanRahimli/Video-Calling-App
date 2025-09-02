"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { applyActionCode, getAuth, sendEmailVerification } from "firebase/auth";
import Swal from "sweetalert2";
import { app } from "@/firebaseConfig";

export default function VerifyEmailPage() {
    const router = useRouter();
    const sp = useSearchParams();
    const oobCode = sp.get("oobCode");
    const auth = getAuth(app);
    const ran = useRef(false);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;

        (async () => {
            try {
                if (!oobCode) {
                    // No code → guide the user
                    await Swal.fire({
                        icon: "info",
                        title: "Open the link from your email",
                        text: "The verification link includes a code. Please open the link directly from your email.",
                    });
                    return;
                }

                await applyActionCode(auth, oobCode);
                await auth.currentUser?.reload?.();

                await Swal.fire({
                    icon: "success",
                    title: "Email verified",
                    text: "Redirecting…",
                    timer: 1600,
                    showConfirmButton: false,
                });

                if (!auth.currentUser) router.replace("/login?verified=1");
                else router.replace("/dashboard");
            } catch (e) {
                console.error(e);
                await Swal.fire({
                    icon: "error",
                    title: "Verification failed",
                    text: e?.message ?? "Invalid or expired link.",
                });
                router.replace("/login");
            }
        })();
    }, [oobCode, auth, router]);

    // Optional: allow resend if user somehow landed here without code
    async function resend() {
        if (!auth.currentUser || cooldown > 0) return;
        try {
            await sendEmailVerification(auth.currentUser, {
                url: `${window.location.origin}/login`,
                handleCodeInApp: true,
            });
            setCooldown(90);
            const t = setInterval(() => {
                setCooldown((s) => {
                    if (s <= 1) { clearInterval(t); return 0; }
                    return s - 1;
                });
            }, 1000);
            await Swal.fire({ icon: "success", title: "Sent", text: "Check your inbox." });
        } catch (e) {
            await Swal.fire({ icon: "error", title: "Couldn’t resend", text: e?.message ?? "Try again later." });
        }
    }

    return (
        <div className="p-6 text-white/80">
            Verifying your email…
            {!oobCode && (
                <button
                    onClick={resend}
                    disabled={cooldown > 0}
                    className="px-3 py-1 ml-3 text-black rounded bg-white/90 disabled:opacity-60"
                >
                    {cooldown ? `Resend (${cooldown}s)` : "Resend verification"}
                </button>
            )}
        </div>
    );
}
