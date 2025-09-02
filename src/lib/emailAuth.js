// src/lib/emailAuth.js
import {
    getAuth,
    setPersistence,
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    sendEmailVerification,
    signOut,
} from "firebase/auth";
import { app } from "@/firebaseConfig"; // your existing initializeApp export

const auth = getAuth(app);

// make sessions persist in web/mobile browsers
setPersistence(auth, browserLocalPersistence).catch(() => { });

export async function signUpWithEmail(email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    try { await sendEmailVerification(cred.user); } catch { }
    return cred.user;
}

export async function signInWithEmail(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
}

export async function sendReset(email) {
    await sendPasswordResetEmail(auth, email);
}

export async function logout() {
    await signOut(auth);
}

export { auth };
