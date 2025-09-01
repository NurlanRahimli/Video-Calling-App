"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Video, FolderOpen, X } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/firebaseConfig";


const navLinks = [
    { href: "/dashboard", label: "Home", icon: Home },
    { href: "/meeting/meetings", label: "Previous", icon: FolderOpen },
    { href: "/recordings/cloud", label: "Recordings", icon: Video },
];

function NavItem({ href, label, icon: Icon, active, onClick }) {
    return (
        <Link
            href={href}
            onClick={onClick}
            aria-current={active ? "page" : undefined}
            className={[
                "flex items-center gap-3 rounded-xl px-3 py-2 transition",
                "border border-white/15 bg-white/10 backdrop-blur-md shadow-sm",
                active ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/15 hover:text-white",
            ].join(" ")}
        >
            <Icon size={18} />
            <span className="text-sm font-medium">{label}</span>
        </Link>
    );
}

export default function Sidebar({ open = false, onClose = () => { } }) {
    const pathname = usePathname();
    const router = useRouter();
    const [loggingOut, setLoggingOut] = useState(false);

    async function handleLogout() {
        setLoggingOut(true);
        try {
            await signOut(auth);
            router.replace("/login");
        } catch (e) {
            console.error(e);
            alert("Failed to log out. Try again.");
        } finally {
            setLoggingOut(false);
        }
    }

    return (
        <>
            {/* ===== Drawer: visible only on < lg (mobile & tablets). Closed by default. ===== */}
            <div
                className={[
                    "fixed inset-0 z-50 lg:hidden",
                    open ? "pointer-events-auto" : "pointer-events-none",
                ].join(" ")}
            >
                {/* Backdrop (only when drawer is open) */}
                <div
                    onClick={onClose}
                    className={[
                        "absolute inset-0 bg-black/40 transition-opacity",
                        open ? "opacity-100" : "opacity-0",
                    ].join(" ")}
                />

                {/* Sliding panel */}
                <aside
                    className={[
                        "absolute left-0 top-0 h-full w-72 p-4 text-white",
                        "bg-white/10 backdrop-blur-lg border-r border-white/15 shadow-2xl",
                        "transition-transform duration-300",
                        // slide on mobile/tablets; stays hidden when open=false
                        open ? "translate-x-0" : "-translate-x-full",
                    ].join(" ")}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="text-lg font-semibold tracking-tight">Yoom</div>
                        <button
                            onClick={onClose}
                            className="p-1 border rounded-full border-white/20 bg-white/10 hover:bg-white/20"
                            aria-label="Close menu"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <nav className="flex flex-col gap-3">
                        {navLinks.map(({ href, label, icon }) => (
                            <NavItem
                                key={href}
                                href={href}
                                label={label}
                                icon={icon}
                                onClick={onClose} // close on link click (mobile/tablet)
                                active={
                                    pathname === href ||
                                    (href !== "/dashboard" && pathname?.startsWith(href))
                                }
                            />
                        ))}
                        <button
                            onClick={handleLogout}
                            disabled={loggingOut}
                            className="rounded-xl text-start px-3 py-1.5 text-sm font-medium bg-white/15 hover:bg-white/25 border border-white/20 disabled:opacity-60"
                            title="Sign out"
                        >
                            {loggingOut ? "Logging out..." : "Log out"}
                        </button>
                    </nav>
                </aside>
            </div>

            {/* ===== Pinned rail: always visible on lg+ ===== */}
            <aside className="sticky top-0 flex-shrink-0 hidden w-64 p-4 text-white h-dvh lg:block">
                <div className="mb-6 text-lg font-semibold tracking-tight">Yoom</div>
                <nav className="flex flex-col gap-3">
                    {navLinks.map(({ href, label, icon }) => (
                        <NavItem
                            key={href}
                            href={href}
                            label={label}
                            icon={icon}
                            active={
                                pathname === href ||
                                (href !== "/dashboard" && pathname?.startsWith(href))
                            }
                        />
                    ))}
                    <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="rounded-xl px-3 py-1.5 text-sm font-medium bg-white/15 hover:bg-white/25 border border-white/20 disabled:opacity-60 cursor-pointer"
                        title="Sign out"
                    >
                        {loggingOut ? "Logging out..." : "Log out"}
                    </button>
                </nav>
            </aside>
        </>
    );
}
