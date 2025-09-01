// lib/admin-init.js
import admin from "firebase-admin";

let cachedAdmin = null;

export function getAdmin() {
    if (cachedAdmin && admin.apps.length) return cachedAdmin;

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT");

    let svc;
    try {
        svc = JSON.parse(raw);
    } catch {
        throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    }

    if (svc.private_key && typeof svc.private_key === "string" && svc.private_key.includes("\\n")) {
        svc.private_key = svc.private_key.replace(/\\n/g, "\n");
    }

    const envBucket = process.env.FIREBASE_STORAGE_BUCKET; // expected: <project>.appspot.com
    const fallbackBucket = svc.project_id ? `${svc.project_id}.appspot.com` : "";
    const bucketName = envBucket || fallbackBucket;

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(svc),
            projectId: svc.project_id,
            storageBucket: bucketName,
        });
    }

    // Optional sanity logs (remove later)
    if (process.env.NODE_ENV !== "production") {
        const configured = admin.app().options.storageBucket || "(none)";
        console.log("[admin-init] storageBucket:", configured, " (env:", envBucket, ")");
    }

    cachedAdmin = admin;
    return admin;
}
