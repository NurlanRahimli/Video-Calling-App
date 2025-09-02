// src/app/api/recordings/[id]/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-init";

export async function DELETE(req, { params }) {
    const docId = params?.id;
    if (!docId) {
        return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }

    try {
        const admin = getAdmin();

        // Require Firebase ID token
        const authHeader = req.headers.get("authorization") || "";
        const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!idToken) {
            return NextResponse.json({ ok: false, error: "Missing idToken" }, { status: 401 });
        }

        const decoded = await admin.auth().verifyIdToken(idToken);
        const db = admin.firestore();

        // Load the recording doc
        const ref = db.collection("recordings").doc(docId);
        const snap = await ref.get();
        if (!snap.exists) {
            return NextResponse.json({ ok: false, error: "Recording not found" }, { status: 404 });
        }
        const data = snap.data();

        // Only the owner may delete
        if (decoded.uid !== data.ownerId) {
            return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }

        // OPTIONAL: also delete the Storage object to avoid orphaned files.
        // Comment these lines out if you truly only want to remove the Firestore doc.
        if (data.storagePath) {
            await admin.storage().bucket().file(data.storagePath).delete({ ignoreNotFound: true });
        }

        // Delete the Firestore doc
        await ref.delete();

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("[recordings DELETE] error:", e);
        return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
    }
}

export async function OPTIONS() {
    return NextResponse.json({}, { status: 204 });
}
