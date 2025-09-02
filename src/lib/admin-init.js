// lib/admin-init.js
import admin from "firebase-admin";

let cachedAdmin = null;

export function getAdmin() {
    if (cachedAdmin && admin.apps.length) return cachedAdmin;

    // --- Load service account JSON from env
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT");

    let svc;
    try {
        svc = JSON.parse(raw);
    } catch {
        throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    }

    // Fix escaped newlines in private key
    if (typeof svc.private_key === "string" && svc.private_key.includes("\\n")) {
        svc.private_key = svc.private_key.replace(/\\n/g, "\n");
    }

    // --- Require explicit bucket (works for both new & old naming)
    const bucketName = (process.env.FIREBASE_STORAGE_BUCKET || "").trim();
    if (!bucketName) {
        throw new Error(
            "FIREBASE_STORAGE_BUCKET is required. Set it to your exact bucket name, e.g. video-calling-app-81b2a.firebasestorage.app"
        );
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(svc),
            projectId: svc.project_id,
            storageBucket: bucketName,
        });
    }

    // Dev sanity log
    if (process.env.NODE_ENV !== "production") {
        console.log("[admin-init] storageBucket =", admin.app().options.storageBucket);
    }

    cachedAdmin = admin;
    return admin;
}
