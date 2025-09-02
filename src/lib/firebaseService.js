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
    await waitForAppCheck();

    return new Promise(resolve => {
        // 1) Try getRedirectResult
        getRedirectResult(auth)
            .then(res => {
                if (res?.user) {
                    resolve(res.user);
                } else {
                    // 2) Fallback to auth state (race with a short timeout)
                    const unsub = onAuthStateChanged(auth, user => {
                        if (user) {
                            unsub();
                            resolve(user);
                        }
                    });
                    // 3) If nothing happens in 4s, resolve null
                    setTimeout(() => { unsub(); resolve(null); }, 4000);
                }
            })
            .catch(() => resolve(null));
    });
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
