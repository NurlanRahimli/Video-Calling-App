// (src/)app/api/ping/route.js
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-init";
import { getStorage } from "firebase-admin/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const admin = getAdmin();
        const nameFromOpts = admin.app().options.storageBucket || null;
        const bucket = getStorage(admin.app()).bucket();
        const [exists] = await bucket.exists().catch(() => [false]);

        let writeOk = null, writeErr = null;
        try {
            await bucket.file("healthcheck.txt").save("ok");
            writeOk = true;
        } catch (e) {
            writeOk = false;
            writeErr = String(e?.message || e);
        }

        return NextResponse.json({
            nameFromOptions: nameFromOpts,
            resolvedBucket: bucket.name || null,
            exists,
            writeOk,
            writeErr,
            projectId: admin.app().options.projectId || null,
        });
    } catch (e) {
        return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
    }
}
