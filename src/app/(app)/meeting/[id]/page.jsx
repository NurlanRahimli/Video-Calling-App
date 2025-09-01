// app/meeting/[id]/page.jsx
"use client";

import { Info, Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff } from "lucide-react";
import InvitePanel from "@/components/InvitePanel";
import { useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/firebaseConfig";
import { useAuth } from "@/app/auth-provider";
import { getDailyCall, destroyDailyCall } from "@/lib/daily";
import { useParams, useRouter } from "next/navigation";
import { signInAnonymously } from "firebase/auth";



// Resolve a good photoURL for the current user (auth → users doc → generated fallback)
async function resolvePhotoURL({ nameHint } = {}) {
    const uid = auth.currentUser?.uid || null;
    const authPhoto = auth.currentUser?.photoURL || null;
    if (authPhoto) return authPhoto;

    // Try users/{uid}.photoURL if you keep profile docs
    if (uid) {
        try {
            const snap = await getDoc(doc(db, "users", uid));
            const fromUsers = snap.exists() ? snap.get("photoURL") : null;
            if (fromUsers) return fromUsers;
        } catch { }
    }

    // Last resort: generate a deterministic avatar (so your list shows a circle, not empty)
    const seed = uid || nameHint || "guest";
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
        seed
    )}&backgroundType=gradientLinear`;
}


export default function MeetingRoom() {
    const { id } = useParams(); // meetingId
    const router = useRouter();

    const [meeting, setMeeting] = useState(null);
    const [muted, setMuted] = useState(true);
    const [camera, setCamera] = useState(false);
    const { user, loading } = useAuth();
    const [showInvite, setShowInvite] = useState(false);
    const [remoteCount, setRemoteCount] = useState(0);
    const [isRecording, setIsRecording] = useState(false);

    // NEW: screen-share state
    const [hasScreen, setHasScreen] = useState(false);
    const [isSharing, setIsSharing] = useState(false);

    const localVideoRef = useRef(null);
    const remoteGridRef = useRef(null);
    const callRef = useRef(null);
    const activeSpeakerRef = useRef(null);

    // NEW: main "stage" where we show the shared screen if present
    const screenStageRef = useRef(null);

    const gridCols = remoteCount > 0 ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "grid-cols-1";

    // ---------- helpers ----------
    const currentUid = () => auth.currentUser?.uid || null;
    const isHost = !!meeting?.createdBy?.uid && meeting.createdBy.uid === currentUid();

    function getPlayable(trackInfo) {
        if (!trackInfo) return null;
        return trackInfo.state === "playable"
            ? trackInfo.persistentTrack || trackInfo.track || null
            : null;
    }

    function getPlayableLocalVideoTrack(call) {
        const v = call?.participants()?.local?.tracks?.video;
        return getPlayable(v);
    }

    function attachLocalVideoIfPlayable() {
        const call = callRef.current;
        const el = localVideoRef.current;
        if (!call || !el) return;

        const track = getPlayableLocalVideoTrack(call);
        if (track) {
            el.srcObject = new MediaStream([track]);
            const play = () => el.play?.().catch(() => { });
            if (el.readyState >= 2) play();
            else el.onloadedmetadata = play;
        } else {
            el.srcObject = null;
        }
    }

    // NEW: look for any active screen share (remote first, then local) and render it on the stage
    function attachScreenStage() {
        const call = callRef.current;
        const stage = screenStageRef.current;
        if (!call || !stage) return;

        let screenTrack = null;
        const participants = call.participants() || {};

        // Prefer rendering a remote screen if present; otherwise render local
        for (const p of Object.values(participants)) {
            const t = getPlayable(p?.tracks?.screenVideo);
            if (t) {
                screenTrack = t;
                break;
            }
        }

        if (screenTrack) {
            stage.srcObject = new MediaStream([screenTrack]);
            stage.onloadedmetadata = () => stage.play?.().catch(() => { });
            setHasScreen(true);
        } else {
            stage.srcObject = null;
            setHasScreen(false);
        }
    }

    // ---------- remote tiles (skip screenshares here; they go to stage) ----------
    function renderRemotes() {
        const call = callRef.current;
        const grid = remoteGridRef.current;
        if (!call || !grid) return;

        const participants = call.participants() || {};
        grid.innerHTML = "";
        let count = 0;

        const chooseVideoTrack = (p) => {
            const screenV = getPlayable(p?.tracks?.screenVideo);
            if (screenV) return { track: screenV, isScreen: true };
            const camV = getPlayable(p?.tracks?.video);
            if (camV) return { track: camV, isScreen: false };
            return { track: null, isScreen: false };
        };

        const chooseAudioTrack = (p, isScreen) => {
            const screenA = getPlayable(p?.tracks?.screenAudio);
            const micA = getPlayable(p?.tracks?.audio);
            return isScreen ? (screenA || micA) : micA || screenA || null;
        };

        Object.values(participants).forEach((p) => {
            if (p.local) return; // only REMOTE users here

            const { track: videoTrack, isScreen } = chooseVideoTrack(p);
            const audioTrack = chooseAudioTrack(p, isScreen);

            const isActive = !!activeSpeakerRef.current && p.session_id === activeSpeakerRef.current;
            const glow = isActive
                ? "ring-2 ring-amber-400 shadow-[0_0_1rem_rgba(251,191,36,0.55)]"
                : "";

            // --- wrapper
            const wrap = document.createElement("div");
            wrap.className = "relative w-fit place-self-start";
            wrap.dataset.sid = p.session_id;

            let bodyEl;
            if (videoTrack || audioTrack) {
                bodyEl = document.createElement("video");
                bodyEl.autoplay = true;
                bodyEl.playsInline = true;
                bodyEl.muted = false; // play remote audio
                bodyEl.className = `block w-40 h-40 md:w-60 md:h-36 rounded-xl bg-black/60 ${isScreen ? "object-contain" : "object-cover"} ${glow}`;
                const streamTracks = [];
                if (videoTrack) streamTracks.push(videoTrack);
                if (audioTrack) streamTracks.push(audioTrack);
                bodyEl.srcObject = new MediaStream(streamTracks);
                bodyEl.onloadedmetadata = () => bodyEl.play?.().catch(() => { });
            } else {
                bodyEl = document.createElement("div");
                const name = p.user_name || p.user_id || "Guest";
                const initials = name.trim().slice(0, 1).toUpperCase();
                bodyEl.className = `grid w-40 h-40 text-xl text-white md:w-60 md:h-36 rounded-xl place-items-center bg-black/50 ring-1 ring-white/10 ${glow}`;
                bodyEl.textContent = initials;
            }
            wrap.appendChild(bodyEl);

            // --- badge for admins (optional visual hint)
            const targetIsAdmin = !!p.owner;
            if (targetIsAdmin) {
                const badge = document.createElement("div");
                badge.className = "absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/90 text-black";
                badge.textContent = "ADMIN";
                wrap.appendChild(badge);
            }

            // --- HOST-ONLY three-dots menu (guests only; NOT admins)
            if (isHost && !targetIsAdmin) {
                // button
                const btn = document.createElement("button");
                btn.title = "More";
                btn.className = "absolute top-1.5 right-1.5 h-8 w-8 grid place-items-center rounded-full bg-black/60 text-white hover:bg-black/80";
                btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
        </svg>
      `;
                wrap.appendChild(btn);

                // menu
                const menu = document.createElement("div");
                menu.className = "absolute right-0 z-10 hidden w-40 overflow-hidden bg-white border shadow-lg top-10 rounded-xl dark:bg-neutral-800";
                menu.innerHTML = `
        <button data-action="mute" class="w-full px-4 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10">Turn off mic</button>
        <button data-action="kick" class="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Kick out</button>
      `;
                wrap.appendChild(menu);

                const closeMenu = (e) => {
                    if (!wrap.contains(e.target)) menu.classList.add("hidden");
                };

                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    menu.classList.toggle("hidden");
                    document.addEventListener("click", closeMenu, { once: true });
                });

                // actions
                menu.addEventListener("click", async (e) => {
                    const target = e.target.closest("button");
                    if (!target) return;
                    menu.classList.add("hidden");

                    try {
                        if (target.dataset.action === "mute") {
                            await call.updateParticipant(p.session_id, { setAudio: false }); // mute guest
                        } else if (target.dataset.action === "kick") {
                            // inform guest, then eject, then mark banned (so token route can block rejoin)
                            call.sendAppMessage({ type: "kicked", reason: "Removed by host" }, p.session_id);
                            await call.updateParticipant(p.session_id, { eject: true });
                            await setDoc(
                                doc(db, "meetings", meeting.id, "participants", p.user_id),
                                { banned: true, bannedAt: serverTimestamp() },
                                { merge: true }
                            );
                        }
                    } catch (err) {
                        console.error("[host action failed]", err);
                    }
                });
            }

            grid.appendChild(wrap);
            count++;
        });

        setRemoteCount(count);
    }


    // --- tiny toast helper (no deps)
    function toast(msg, { ms = 2800 } = {}) {
        const hostId = "__toasts";
        let host = document.getElementById(hostId);
        if (!host) {
            host = document.createElement("div");
            host.id = hostId;
            host.className = "fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] space-y-2 pointer-events-none";
            document.body.appendChild(host);
        }
        const el = document.createElement("div");
        el.className =
            "px-3 py-2 text-sm text-white rounded-lg shadow-lg pointer-events-auto bg-black/80 ring-1 ring-white/15 " +
            "transition-opacity duration-300 opacity-0";
        el.textContent = msg;
        host.appendChild(el);
        // fade in -> out
        requestAnimationFrame(() => (el.style.opacity = "1"));
        setTimeout(() => {
            el.style.opacity = "0";
            el.addEventListener("transitionend", () => el.remove(), { once: true });
        }, ms);
    }

    const displayNameOf = (p) => (p?.user_name || p?.user_id || "Guest");

    // ---------- participants sync (write ONLY your own doc) ----------
    async function upsertParticipant(
        meetingId,
        dailyParticipant,
        { status, setJoinedAt = false } = {}
    ) {
        const uid = currentUid();
        if (!meetingId || !uid) return;

        const payload = {
            uid,
            displayName: dailyParticipant?.user_name || auth.currentUser?.displayName || "Guest",
            role: meeting?.createdBy?.uid === uid ? "host" : "guest",
            device: {
                kind: "web",
                ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
            },
            sessionId: dailyParticipant?.session_id || null,
        };
        if (status) payload.status = status;
        if (setJoinedAt) payload.joinedAt = serverTimestamp();

        // NEW: ensure we store a photoURL for this participant
        payload.photoURL =
            dailyParticipant?.userData?.photoURL || // if you add this to Daily token (optional)
            (await resolvePhotoURL({ nameHint: payload.displayName }));

        const ref = doc(db, "meetings", meetingId, "participants", uid);
        await setDoc(ref, payload, { merge: true });
    }

    async function markLeft(meetingId) {
        const uid = currentUid();
        if (!meetingId || !uid) return;
        const ref = doc(db, "meetings", meetingId, "participants", uid);
        await setDoc(ref, { status: "left", leftAt: serverTimestamp() }, { merge: true });
    }

    // ---------- 1) load meeting doc ----------
    useEffect(() => {
        if (loading || !id) return;
        if (!user) {
            signInAnonymously(auth).catch((e) => console.warn("[anon sign-in]", e));
        }
        (async () => {
            try {
                const snap = await getDoc(doc(db, "meetings", id));
                if (snap.exists()) setMeeting({ id: snap.id, ...snap.data() });
            } catch (e) {
                console.error("[meeting:load]", e);
            }
        })();
    }, [id, loading]); // eslint-disable-line react-hooks/exhaustive-deps


    // ---------- 2) join Daily room + wire events ----------
    useEffect(() => {
        if (!meeting || meeting.provider !== "daily" || !meeting.daily?.roomUrl) return;

        const call = getDailyCall();
        callRef.current = call;

        // ---- Recording events
        const onRecStarted = () => setIsRecording(true);
        const onRecStopped = () => setIsRecording(false);
        const onRecError = (e) => {
            console.error("[recording:error]", e);
            setIsRecording(false);
        };
        call.on("recording-started", onRecStarted);
        call.on("recording-stopped", onRecStopped);
        call.on("recording-error", onRecError);

        // const onJoinedMeeting = async () => {
        //     try {
        //         const me = call.participants().local;
        //         await upsertParticipant(meeting.id, me, { status: "connected", setJoinedAt: true });
        //     } catch (e) {
        //         console.error("[participants:joined-meeting]", e);
        //     }
        //     attachLocalVideoIfPlayable();
        //     attachScreenStage();
        //     renderRemotes();
        // };


        const onParticipantUpdated = async (ev) => {
            try {
                if (ev?.participant?.local) {
                    await upsertParticipant(meeting.id, ev.participant, { status: "connected" });
                }
            } catch (e) {
                console.error("[participants:updated]", e);
            }
            attachLocalVideoIfPlayable();
            attachScreenStage();
            renderRemotes();
        };

        const onParticipantLeft = async (ev) => {
            try {
                if (ev?.participant?.local) {
                    await markLeft(meeting.id);
                } else {
                    // show small alert for others leaving
                    toast(`${displayNameOf(ev?.participant)} left the meeting`);
                }
            } catch (e) {
                console.error("[participants:left]", e);
            }
            attachScreenStage();
            renderRemotes();
        };

        const onTrackStarted = () => {
            attachLocalVideoIfPlayable();
            attachScreenStage();
            renderRemotes();
        };
        const onTrackStopped = () => {
            attachLocalVideoIfPlayable();
            attachScreenStage();
            renderRemotes();
        };

        const onActiveSpeakerChange = (ev) => {
            const sid =
                ev?.activeSpeaker?.session_id ||
                ev?.activeSpeaker?.peerId ||
                ev?.session_id ||
                ev?.participant?.session_id ||
                null;
            activeSpeakerRef.current = sid;
            renderRemotes();
        };


        const onSelfJoinedMeeting = async () => {
            try {
                const me = call.participants().local;
                await upsertParticipant(meeting.id, me, { status: "connected", setJoinedAt: true });
            } catch (e) {
                console.error("[participants:joined-meeting]", e);
            }
            attachLocalVideoIfPlayable();
            attachScreenStage();
            renderRemotes();
        };

        const onParticipantJoined = async (ev) => {
            try {
                if (ev?.participant?.local) {
                    await upsertParticipant(meeting.id, ev.participant, { status: "connected" });
                } else {
                    // show small alert for others joining
                    toast(`${displayNameOf(ev?.participant)} joined the meeting`);
                }
            } catch (e) {
                console.error("[participants:joined]", e);
            }
            attachLocalVideoIfPlayable();
            attachScreenStage();
            renderRemotes();
        };



        call.on("active-speaker-change", onActiveSpeakerChange);
        call.on("joined-meeting", onSelfJoinedMeeting);
        call.on("participant-joined", onParticipantJoined);
        call.on("participant-updated", onParticipantUpdated);
        call.on("participant-left", onParticipantLeft);
        call.on("track-started", onTrackStarted);
        call.on("track-stopped", onTrackStopped);
        const onAppMessage = (ev) => {
            const msg = ev?.data;
            if (msg?.type === "kicked") {
                alert(msg.reason || "You were removed by the host.");
                try { call.leave?.(); } catch { }
                router.replace("/dashboard"); // or a “removed” page
            }
        };
        call.on("app-message", onAppMessage);



        (async () => {
            try {
                // Are *you* the host of this meeting according to your Firestore doc?
                const iAmHost =
                    !!meeting?.createdBy?.uid &&
                    meeting.createdBy.uid === (auth.currentUser?.uid || null);

                // Extract roomName from the Daily room URL
                let roomName = "";
                try {
                    const u = new URL(meeting.daily.roomUrl);
                    const parts = u.pathname.split("/").filter(Boolean);
                    // Daily URLs are often /rooms/<name> or /<name>; take the last segment
                    roomName = parts[parts.length - 1];
                } catch {
                    roomName = meeting.daily.roomName || meeting.id;
                }

                // Ask your new API for a meeting token
                const tokenRes = await fetch("/api/daily/token", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        roomName,
                        userName: auth.currentUser?.displayName || "Guest",
                        isOwner: iAmHost, // host => true, guest => false
                    }),
                });
                const { token, error } = await tokenRes.json();
                if (error) throw new Error(error);

                // Join with token (this is what gives you owner powers)
                await call.join({ url: meeting.daily.roomUrl, token });


                // optional sanity check:
                // console.log("Am I owner?", call.participants().local?.owner);

                await call.setLocalAudio(!muted);
                await call.setLocalVideo(camera);

                attachLocalVideoIfPlayable();
                attachScreenStage();
                renderRemotes();

            } catch (e) {
                console.error("[daily:join]", e);
            }
        })();


        return () => {
            call.off("joined-meeting", onSelfJoinedMeeting);
            call.off("participant-joined", onParticipantJoined);
            call.off("participant-updated", onParticipantJoined);
            call.off("participant-left", onParticipantLeft);
            call.off("track-started", onTrackStarted);
            call.off("track-stopped", onTrackStopped);
            call.off("active-speaker-change", onActiveSpeakerChange);

            call.off("recording-started", onRecStarted);
            call.off("recording-stopped", onRecStopped);
            call.off("recording-error", onRecError);

            // in cleanup:
            call.off("app-message", onAppMessage);

            try {
                call.leave?.();
            } catch { }
            destroyDailyCall();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meeting]);

    // ---------- controls ----------
    async function toggleMic() {
        const call = callRef.current;
        if (!call) return;
        const next = !muted;
        setMuted(next);
        try {
            await call.setLocalAudio(!next);
        } catch (e) {
            console.error("[mic]", e);
        }
    }

    async function toggleCam() {
        const call = callRef.current;
        if (!call) return;
        const next = !camera;
        setCamera(next);
        try {
            await call.setLocalVideo(next);
            attachLocalVideoIfPlayable();
        } catch (e) {
            console.error("[camera]", e);
        }
    }

    // NEW: toggle screen share
    async function toggleScreenShare() {
        const call = callRef.current;
        if (!call) return;

        try {
            if (isSharing) {
                await call.stopScreenShare();
                setIsSharing(false);
            } else {
                // turn off camera while presenting
                await call.setLocalVideo(false);
                setCamera(false);

                await call.startScreenShare();
                setIsSharing(true);
            }
        } catch (e) {
            console.error("[screenshare]", e);
        } finally {
            renderRemotes(); // refresh tiles so your small card switches to the screen
        }
    }

    // NEW: toggle recording (host only)
    async function toggleRecording() {
        const call = callRef.current;
        if (!call) return;
        if (!isHost) return;

        try {
            if (!isRecording) {
                // Cloud recording: default layout includes video + screenshare automatically
                await call.startRecording({
                    audioOnly: false,       // <- ensures video stream is recorded
                });
            } else {
                await call.stopRecording();
            }
        } catch (e) {
            console.error("[recording:toggle]", e);
        }
    }


    async function leaveCall() {
        const call = callRef.current;
        try {
            await markLeft(meeting?.id);
            await call?.leave();
        } catch (e) {
            console.error(e);
        } finally {
            destroyDailyCall();
            router.replace("/dashboard");
        }
    }

    // ---------- ui ----------
    return (
        <main className="p-2 min-h-dvh bg-neutral-900 md:p-3 lg:p-4">
            <div className="relative mx-auto h-[calc(100dvh-1rem)] md:h-[calc(100dvh-1.5rem)] lg:h-[calc(100dvh-2rem)] w-full max-w-[1400px] overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-[#230606] via-[#3a1620] to-[#180a0b] ring-1 ring-white/10">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(255,255,255,0.06),transparent_60%)]" />

                {/* top-right mic pill */}
                <button
                    onClick={toggleMic}
                    className="absolute grid text-white rounded-full right-3 top-3 md:right-4 md:top-4 h-9 w-9 md:h-10 md:w-10 place-items-center bg-black/30 ring-1 ring-white/15 backdrop-blur"
                    title={muted ? "Mic off" : "Mic on"}
                >
                    {muted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                {/* CENTER STAGE: screenshare if present; else local video/avatar */}
                <div className="absolute inset-0 grid place-items-center">
                    {hasScreen ? (
                        <video
                            ref={screenStageRef}
                            autoPlay
                            playsInline
                            muted
                            className="object-contain w-full h-full bg-black/70"
                        />
                    ) : camera ? (
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="h-40 w-70 md:h-120 md:w-150 rounded-xl bg-black/70"
                        />
                    ) : (
                        <div className="grid w-20 h-20 overflow-hidden rounded-full shadow-xl md:h-24 md:w-24 place-items-center ring-4 ring-white/80">
                            <span className="text-2xl font-bold md:text-3xl">You</span>
                        </div>
                    )}
                </div>

                {/* remote grid (excludes screenshare tiles) */}
                <div ref={remoteGridRef} className={`absolute inset-x-4 top-20 grid gap-3 ${gridCols} justify-items-start`} />

                {/* bottom controls */}
                <div className="absolute inset-x-0 bottom-4 mx-auto w-[calc(100%-1.5rem)] sm:w-fit rounded-2xl bg-black/80 px-2 md:px-3 py-2 text-white shadow-2xl ring-1 ring-white/10">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleMic}
                                className="grid h-9 w-9 md:h-10 md:w-10 place-items-center rounded-xl bg-[#5f2126] hover:bg-[#70262b] ring-1 ring-white/10"
                                title={muted ? "Unmute" : "Mute"}
                            >
                                {muted ? <MicOff size={18} /> : <Mic size={18} />}
                            </button>

                            <button
                                onClick={toggleCam}
                                className="grid h-9 w-9 md:h-10 md:w-10 place-items-center rounded-xl bg-[#5f2126] hover:bg-[#70262b] ring-1 ring-white/10"
                                title={camera ? "Turn camera off" : "Turn camera on"}
                            >
                                {camera ? <Video size={18} /> : <VideoOff size={18} />}
                            </button>

                            <button
                                onClick={toggleScreenShare}
                                className={`grid h-9 w-9 md:h-10 md:w-10 place-items-center rounded-xl ${isSharing ? "bg-green-700 hover:bg-green-600" : "bg-neutral-700 hover:bg-neutral-600"
                                    } ring-1 ring-white/10`}
                                title={isSharing ? "Stop presenting" : "Present now"}
                            >
                                <MonitorUp size={18} />
                            </button>

                            {/* Recording (host only) */}
                            {isHost && (
                                <button
                                    onClick={toggleRecording}
                                    className={`grid h-9 w-9 md:h-10 md:w-10 place-items-center rounded-xl ${isRecording ? "bg-red-700 hover:bg-red-600" : "bg-neutral-700 hover:bg-neutral-600"
                                        } ring-1 ring-white/10 relative`}
                                    title={isRecording ? "Stop recording" : "Start recording"}
                                >
                                    <span
                                        className={`inline-block h-2.5 w-2.5 rounded-full ${isRecording ? "bg-white" : "bg-white/80"
                                            }`}
                                    />
                                    {isRecording && (
                                        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-black/60" />
                                    )}
                                </button>
                            )}
                        </div>

                        <div className="w-px mx-1 h-9 md:h-10 bg-white/10" />

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowInvite(true)}
                                className="grid h-9 w-9 md:h-10 md:w-10 place-items-center rounded-xl bg-neutral-700 hover:bg-neutral-600 ring-1 ring-white/10"
                                title="Invite info"
                            >
                                <Info size={18} />
                            </button>
                        </div>

                        <div className="w-px mx-1 h-9 md:h-10 bg-white/10" />

                        <button
                            onClick={leaveCall}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-2.5 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium hover:bg-red-500"
                            title="Leave call"
                        >
                            <PhoneOff size={18} />
                            <span className="hidden sm:inline">Leave</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Invite slide-in */}
            <InvitePanel
                open={showInvite}
                onClose={() => setShowInvite(false)}
                meetingId={meeting?.id}
                roomUrl={meeting?.daily?.roomUrl || ""}
            />
        </main>
    );
}
