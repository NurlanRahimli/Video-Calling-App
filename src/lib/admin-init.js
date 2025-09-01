import admin from "firebase-admin";

export function getAdmin() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT");
    const svc = JSON.parse(raw);
    if (svc.private_key?.includes("\\n")) svc.private_key = svc.private_key.replace(/\\n/g, "\n");

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET

    // re-init safety omitted for brevity
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(svc),
            projectId: svc.project_id,
            storageBucket: bucketName,
        });
    }
    return admin;
}
