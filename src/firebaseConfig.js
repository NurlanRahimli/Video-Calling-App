// src/firebaseConfig.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getAnalytics } from "firebase/analytics";
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from "firebase/app-check";

const firebaseConfig = {
    apiKey: "AIzaSyA6XPxukbfJMf96yV5VepAypTmUBnWMFiE",
    authDomain: "video-calling-app-81b2a.firebaseapp.com",
    projectId: "video-calling-app-81b2a",
    storageBucket: "video-calling-app-81b2a.firebasestorage.app",
    messagingSenderId: "537542070828",
    appId: "1:537542070828:web:8f8b2434bd161a716af789",
    measurementId: "G-2KDL69KGYF"
};

// ---- Initialize once
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");

// Analytics should only run in browser
let analytics;
if (typeof window !== "undefined") {
    analytics = getAnalytics(app);
}
export { analytics };

// ---- App Check (browser only) + warm token
let appCheckReady = null;

if (typeof window !== "undefined" && !appCheckReady) {
    if (process.env.NEXT_PUBLIC_APPCHECK_DEBUG === "1") {
        // eslint-disable-next-line no-undef
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    const appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(
            process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY
        ),
        isTokenAutoRefreshEnabled: true,
    });

    // warm a token so the first auth call won’t fail
    appCheckReady = getToken(appCheck, true).catch(() => { }).then(() => { });
}

// ✅ Export for other code to await App Check readiness
export function waitForAppCheck() {
    return appCheckReady || Promise.resolve();
}
