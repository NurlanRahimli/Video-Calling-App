// app/(app)/layout.js
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth-provider";
import { Menu } from "lucide-react";
import Sidebar from "@/components/dashboard/Sidebar";

export default function AppLayout({ children }) {
    const { user, loading } = useAuth();
    const [open, setOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) router.replace("/login");
    }, [loading, user, router]);

    if (loading || !user) return null; // no flash of protected UI
    return <>{children}</>;
}
