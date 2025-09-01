// src/firebaseConfig.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
// Optional: only if you want Analytics
import { getAnalytics } from "firebase/analytics";
// --- App Check (browser only) ---
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
    apiKey: "AIzaSyA6XPxukbfJMf96yV5VepAypTmUBnWMFiE",
    authDomain: "video-calling-app-81b2a.firebaseapp.com",
    projectId: "video-calling-app-81b2a",
    storageBucket: "video-calling-app-81b2a.firebasestorage.app",
    messagingSenderId: "537542070828",
    appId: "1:537542070828:web:8f8b2434bd161a716af789",
    measurementId: "G-2KDL69KGYF"
};

// Initialize Firebase
// Only run App Check in the browser
const app = initializeApp(firebaseConfig);

// Only run App Check in the browser
if (typeof window !== "undefined") {
    // Optional: dev helper — set NEXT_PUBLIC_APPCHECK_DEBUG=1 in env to see a debug token
    if (process.env.NEXT_PUBLIC_APPCHECK_DEBUG === "1") {
        // eslint-disable-next-line no-undef
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(
            process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY
        ),
        isTokenAutoRefreshEnabled: true,
    });
}

// Export services so you can use them anywhere in your app
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Analytics should only be used in the browser (Next.js SSR can break)
let analytics;
if (typeof window !== "undefined") {
    analytics = getAnalytics(app);
}
export { analytics };

export const functions = getFunctions(app, "us-central1");
