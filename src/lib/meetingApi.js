// src/lib/meetingApi.js
"use client";
import { auth, db } from "@/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import {
    addDoc,
    collection,
    serverTimestamp,
    updateDoc,
    doc as fsDoc,
    setDoc,
} from "firebase/firestore";

function waitForAuthUser() {
    return new Promise((resolve) => {
        if (auth.currentUser) return resolve(auth.currentUser);
        const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u || null); });
    });
}

/**
 * Creates a Daily room, then a meeting doc, then the host's participant doc.
 * Returns: { meetingId, roomUrl, roomName }
 */
export async function createMeetingClient(topic = "Instant Meeting", opts = {}) {
    // Step-by-step logging to see exactly which write fails
    const step = (label) => (e) => {
        console.error(`[createMeetingClient:${label}]`, e);
        throw e;
    };

    try {
        // 0) Require auth (rules need request.auth)
        const user = await waitForAuthUser();
        if (!user) throw new Error("Not signed in");

        // 1) Create Daily room (server route should use DAILY_API_KEY)
        let roomUrl, roomName;
        try {
            const res = await fetch("/api/daily/room", { method: "POST" });
            const data = await res.json();
            if (!res.ok || !data?.roomUrl) throw new Error(data?.error || "Failed to create Daily room");
            roomUrl = data.roomUrl;
            roomName = data.roomName || null;
        } catch (e) { step("daily-room")(e); }

        // 2) Create meeting doc (must include createdBy.uid, members OR joinOpen)
        const meetingData = {
            createdAt: serverTimestamp(),
            createdBy: {
                uid: user.uid, // <-- rules check this against request.auth.uid
                name: user.displayName || "Unknown",
                email: user.email || null,
                photoURL: user.photoURL || null,
            },

            // IMPORTANT for participants rules:
            members: [user.uid],            // include host
            joinOpen: true,                 // allow link-based joins (optional but convenient)

            state: "open",
            topic,
            provider: "daily",
            daily: { roomUrl, roomName },
            joinPolicy: {
                allowAnonymous: true,
                guestNameRequired: true,
                waitingRoom: false,
                earlyJoinMinutes: 0,
            },
            security: {
                inviteToken: Math.random().toString(36).substring(2, 10),
                passcode: null,
                bannedUids: [],
                bannedFingerprints: [],
            },
            settings: {
                maxParticipants: opts.maxParticipants || 12,
                recordingEnabled: false,
                chatEnabled: true,
                screenShareEnabled: true,
            },
            expiresAt: null,
        };

        let docRef;
        try {
            docRef = await addDoc(collection(db, "meetings"), meetingData);
        } catch (e) { step("meetings.addDoc")(e); }

        // 3) Store meetingId back into the doc (allowed only for the creator)
        try {
            await updateDoc(fsDoc(db, "meetings", docRef.id), { meetingId: docRef.id });
        } catch (e) { step("meetings.updateDoc(meetingId)")(e); }

        // 4) Create the host participant doc NOW (creates the subcollection)
        try {
            const hostPartRef = fsDoc(db, "meetings", docRef.id, "participants", user.uid);
            await setDoc(hostPartRef, {
                uid: user.uid,  // MUST == request.auth.uid per rules
                displayName: user.displayName || "Host",
                role: "host",
                status: "waiting", // not connected to Daily yet
                joinedAt: serverTimestamp(),
                device: { kind: "web", ua: typeof navigator !== "undefined" ? navigator.userAgent : "" },
                sessionId: null,
            }, { merge: true });
        } catch (e) { step("participants.setDoc(host)")(e); }

        return { meetingId: docRef.id, roomUrl, roomName };
    } catch (err) {
        console.error("[createMeetingClient]", err);
        throw err;
    }
}
