// src/lib/userProfile.js
import { doc, runTransaction, serverTimestamp, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebaseConfig";

export function normalizeUsername(raw) {
    const u = (raw || "").trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(u)) {
        throw new Error("Username must be 3–20 chars (letters, numbers, underscore).");
    }
    return u;
}

export async function createUserProfileWithUsername(user, rawUsername, extra = {}) {
    const username = normalizeUsername(rawUsername);
    const unameRef = doc(db, "usernames", username);
    const userRef = doc(db, "users", user.uid);

    await runTransaction(db, async (tx) => {
        const taken = await tx.get(unameRef);
        if (taken.exists()) throw new Error("Username is already taken");
        tx.set(unameRef, { uid: user.uid, createdAt: serverTimestamp() });
        tx.set(userRef, {
            uid: user.uid,
            username,
            email: user.email ?? null,
            photoURL: user.photoURL ?? null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...extra,
        }, { merge: true });
    });

    return username;
}

// OPTIONAL: create a basic users/{uid} doc for OAuth users
export async function ensureUserDoc(user) {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(ref, {
            uid: user.uid,
            email: user.email ?? null,
            name: user.displayName ?? null,
            photoURL: user.photoURL ?? null,
            providerIds: (user.providerData || []).map(p => p.providerId),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        }, { merge: true });
        return { created: true, hasUsername: false };
    }
    const hasUsername = !!snap.data()?.username;
    await setDoc(ref, { updatedAt: serverTimestamp() }, { merge: true });
    return { created: false, hasUsername };
}
