// app/(auth)/verify-email/page.jsx
import { Suspense } from "react";

export const dynamic = "force-dynamic"; // avoid SSG/prerender for this page

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div className="p-6 text-white/80">Verifying your email…</div>}>
            <VerifyEmailClient />
        </Suspense>
    );
}
