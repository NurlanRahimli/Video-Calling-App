// src/lib/emailAuth.js
import {
    getAuth,
    setPersistence,
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    sendEmailVerification,
    deleteUser,
} from "firebase/auth";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { app, db } from "@/firebaseConfig";

const auth = getAuth(app);
// optional but nice for web
setPersistence(auth, browserLocalPersistence).catch(() => { });

// same regex you already use
function normalizeUsername(raw) {
    const u = (raw || "").trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(u)) {
        throw new Error("Username must be 3–20 chars (letters, numbers, underscore).");
    }
    return u;
}

/**
 * Email+password signup, claim unique username, then send verification.
 * If claiming fails, deletes the just-created Auth user (no orphans).
 */
export async function signUpWithEmailAndUsername({
    email,
    password,
    username,
    name, // optional
    actionCodeSettings,
}) {
    // 1) Validate BEFORE creating the auth user
    const uname = normalizeUsername(username);

    // 2) Create auth user
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    try {
        // Optional displayName
        const display = name || uname;
        if (display) {
            try { await updateProfile(user, { displayName: display }); } catch { }
        }

        // 3) Reserve username + create users/{uid}
        const unameRef = doc(db, "usernames", uname);
        const userRef = doc(db, "users", user.uid);

        await runTransaction(db, async (tx) => {
            const taken = await tx.get(unameRef);
            if (taken.exists()) throw new Error("Username is already taken");

            tx.set(unameRef, { uid: user.uid, createdAt: serverTimestamp() });
            tx.set(userRef, {
                uid: user.uid,
                username: uname,
                email: user.email ?? null,
                photoURL: user.photoURL ?? null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                ...(name ? { name } : {}),
            }, { merge: true });
        });

        // 4) Send verification ONLY after username is successfully claimed
        let verificationSent = false;
        try {
            if (!user.emailVerified) {
                await sendEmailVerification(user, actionCodeSettings);
                verificationSent = true;
            }
        } catch (e) {
            if (e?.code !== "auth/too-many-requests") throw e;
        }

        return { user, verificationSent, username: uname };
    } catch (err) {
        // 5) Clean up auth user if anything after creation fails
        try { await deleteUser(user); } catch { }
        throw err;
    }
}

/**
 * Email+password login. Returns the Firebase Auth user.
 * (Your page can then upsert users/{uid} and route.)
 */
export async function signInWithEmail(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
}

export { auth };
