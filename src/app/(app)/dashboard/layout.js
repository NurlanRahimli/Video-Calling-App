"use client";
import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "@/components/dashboard/Sidebar";

export default function DashboardLayout({ children }) {


    const [open, setOpen] = useState(false);
    return (
        <div className="relative min-h-dvh">
            {/* Background behind EVERYTHING */}
            <div className="absolute inset-0 bg-[url('/images/login-bgImage.png')] bg-cover bg-center" />
            {/* overlay tint for readable glass UI (same brand color) */}
            <div className="absolute inset-0 bg-[#230606]/80" />

            {/* Foreground */}
            <div className="relative z-10 flex min-h-dvh">
                {/* Sidebar: drawer (<lg) + rail (lg+) */}
                <Sidebar open={open} onClose={() => setOpen(false)} />

                {/* Main column */}
                <div className="flex-1 overflow-y-auto">
                    {/* Top bar only on <lg */}
                    <div className="sticky top-0 z-20 flex items-center gap-3 p-3 text-white border-b border-white/10 bg-white/10 backdrop-blur lg:hidden">
                        <button
                            onClick={() => setOpen(true)}
                            className="px-3 py-2 border rounded-xl border-white/20 bg-white/10 hover:bg-white/20"
                            aria-label="Open menu"
                        >
                            <Menu size={18} />
                        </button>
                        <div className="font-semibold">Dashboard</div>
                    </div>

                    {/* Page content */}
                    <div className="p-6 md:p-8">{children}</div>

                    {/* safe area bottom spacing on mobile */}
                    <div style={{ height: "env(safe-area-inset-bottom)" }} />
                </div>
            </div>
        </div>
    );
}
