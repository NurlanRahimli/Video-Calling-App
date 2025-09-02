// src/app/(dashboard)/dashboard/page.js
"use client";

import Image from "next/image";
import { Calendar, Video, FolderOpen, UserPlus } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMeetingClient } from "@/lib/meetingApi";
import { auth } from "@/firebaseConfig";
import { useAuth } from "@/app/auth-provider";

import JoinMeetingModal from "@/components/JoinMeetingModal";
import { useUserDoc } from "@/lib/useUserDoc";


function GlassTile({ icon: Icon, title, subtitle, className, onClick }) {
    return (
        <div
            className={
                "rounded-2xl border border-white/15 bg-white/10 p-5 text-white shadow-xl backdrop-blur-md hover:bg-white/15 transition-colors " +
                className
            }
            role="button"
            onClick={onClick}
        >
            <div className="flex items-center gap-3">
                <div className="grid w-10 h-10 border place-items-center rounded-xl border-white/20 bg-white/10">
                    <Icon size={20} />
                </div>
                <div>
                    <div className="text-lg font-semibold leading-tight">{title}</div>
                    <div className="text-sm text-white/80">{subtitle}</div>
                </div>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const router = useRouter();
    const [creating, setCreating] = useState(false);
    const { user, loading } = useAuth();
    const [openJoin, setOpenJoin] = useState(false);
    const { profile, loading: profileLoading } = useUserDoc(user?.uid); // Firestore profile

    const now = new Date();
    const time = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
    }).format(now);
    const date = new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    }).format(now);

    async function handleNewMeeting() {
        if (loading) return; // still resolving auth
        if (!user || !auth.currentUser) {
            alert("Please sign in first");
            return;
        }
        if (creating) return;

        try {
            setCreating(true);
            const m = await createMeetingClient("Instant Meeting");
            if (!m?.meetingId) throw new Error("No meetingId returned");
            router.replace(`/meeting/${m.meetingId}`);
        } catch (err) {
            console.error(err);
            alert(err?.message || "Failed to create meeting. Please try again.");
        } finally {
            setCreating(false);
        }
    }


    const handleClick = () => {
        router.push('/recordings/library');
    };


    return (
        <div className="mx-auto text-white max-w-7xl">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">

                {/* Header spans all columns */}
                <div className="p-6 text-center border shadow-xl md:col-span-2 xl:col-span-3 rounded-3xl border-white/15 bg-white/10 backdrop-blur-md">
                    {user ? (
                        <>
                            {/* <span className="inline-block px-3 py-1 text-xs rounded-full bg-white/15">
                                Signed in with {user.providerData[0]?.providerId || "Unknown"}
                            </span> */}
                            {/* Provider(s) — prefer Firestore providerIds if present */}
                            {(() => {
                                const provs =
                                    profile?.providerIds ??
                                    (user?.providerData || []).map(p => p.providerId) ??
                                    [];
                                const label = (p) =>
                                    p === "google.com" ? "Google" :
                                        p === "github.com" ? "GitHub" :
                                            p === "password" ? "Email" : p;
                                return (
                                    <span className="inline-block px-3 py-1 text-xs rounded-full bg-white/15">
                                        Signed in with {provs.length ? provs.map(label).join(", ") : "Unknown"}
                                    </span>
                                );
                            })()}
                            {/* Avatar */}
                            <div className="flex justify-center mt-4">
                                {(profile?.photoURL || user.photoURL) ? (
                                    <img
                                        src={profile?.photoURL || user.photoURL}
                                        alt="User Avatar"
                                        className="w-20 h-20 border-2 rounded-full shadow-md border-white/20"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center w-20 h-20 text-3xl font-bold rounded-full shadow-md bg-white/20">
                                        {(profile?.username?.[0] || profile?.email?.[0] || user?.email?.[0] || "U").toUpperCase()}
                                    </div>
                                )}
                            </div>

                            {/* Username + Email */}
                            <div className="mt-3 text-2xl font-bold tracking-tight">
                                {profile?.username || profile?.name || user?.displayName || "No username set"}
                            </div>
                            <p className="text-lg text-white/90">{profile?.email || user?.email}</p>
                        </>
                    ) : (
                        <span className="inline-block px-3 py-1 text-xs rounded-full bg-white/15">
                            Loading user...
                        </span>
                    )}

                    {/* Keep your date + time under user info */}
                    <div className="mt-4 text-5xl font-extrabold tracking-tight">{time}</div>
                    <p className="text-lg text-white/90">{date}</p>
                </div>


                {/* Tiles */}
                <GlassTile
                    icon={Video}
                    title="New Meeting"
                    subtitle={creating ? "Creating..." : "Start an instant meeting"}
                    onClick={creating ? undefined : handleNewMeeting}
                    className={`w-full min-h-[140px] ${creating ? "pointer-events-none opacity-60" : ""}`}
                />
                <GlassTile
                    icon={FolderOpen}
                    title="View Recordings"
                    subtitle="Check out your recordings"
                    className="w-full min-h-[140px]"
                    onClick={handleClick}
                />
                <GlassTile
                    icon={UserPlus}
                    onClick={() => setOpenJoin(true)}
                    title="Join Meeting"
                    subtitle="via invitation link"
                    className="w-full min-h-[140px]"
                />
                <JoinMeetingModal open={openJoin} onClose={() => setOpenJoin(false)} />

            </div>
        </div>
    );
}
