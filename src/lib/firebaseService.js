"use client";
import { auth, waitForAppCheck } from "@/firebaseConfig";
import {
    GoogleAuthProvider,
    GithubAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
} from "firebase/auth";

const isMobile = () =>
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod|android/i.test(navigator.userAgent);

export async function completeRedirectLogin() {
    try {
        const res = await getRedirectResult(auth);
        return res?.user || null;
    } catch {
        return null;
    }
}

async function signIn(ProviderCtor, opts = {}) {
    await waitForAppCheck();

    const preferRedirect = opts.useRedirect ?? isMobile();

    if (preferRedirect) {
        await signInWithRedirect(auth, new ProviderCtor());
        return null; // flow continues after reload
    }

    const res = await signInWithPopup(auth, new ProviderCtor());
    return res.user;
}

export function loginWithGoogle(opts) {
    return signIn(GoogleAuthProvider, opts);
}

export function loginWithGithub(opts) {
    return signIn(GithubAuthProvider, opts);
}
