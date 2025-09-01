"use client";
import { auth } from "@/firebaseConfig";
import {
    GoogleAuthProvider,
    GithubAuthProvider,
    // FacebookAuthProvider,
    signInWithPopup,
    signInWithRedirect,
} from "firebase/auth";

const google = new GoogleAuthProvider();
const github = new GithubAuthProvider();
// const facebook = new FacebookAuthProvider();

/**
 * Returns a Firebase User on success (popup), or null if we initiated a redirect.
 * Throws on real errors.
 */
export function loginWithGoogle(opts = {}) {
    return opts.useRedirect
        ? signInWithRedirect(auth, google).then(() => null)
        : signInWithPopup(auth, google).then(res => res.user);
}

export function loginWithGithub(opts = {}) {
    return opts.useRedirect
        ? signInWithRedirect(auth, github).then(() => null)
        : signInWithPopup(auth, github).then(res => res.user);
}

// export function loginWithFacebook(opts = {}) { ... }
