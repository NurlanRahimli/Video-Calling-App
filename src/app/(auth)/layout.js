// src/app/(auth)/layout.js
export default function AuthLayout({ children }) {
    return (
        <main className="relative grid overflow-hidden min-h-dvh place-items-center">
            {/* background image */}
            <div className="absolute inset-0 bg-[url('/images/login-bgImage.png')] bg-cover bg-center" />
            {/* dark vignette/overlay for contrast */}
            <div className="absolute inset-0 bg-[#230606]/80" />
            {/* content */}
            <div className="relative z-10 w-full px-4">{children}</div>
        </main>
    );
}
