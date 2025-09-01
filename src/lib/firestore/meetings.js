// lib/firestore/meetings.js
import {
    collection, collectionGroup, query, where, orderBy, limit,
    startAfter, getDocs, getDoc, doc
} from "firebase/firestore";
import { db } from "@/firebaseConfig";

// Firestore Timestamp | string | number | Date -> Date | null
function toDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v?.toDate === "function") return v.toDate();
    const d = new Date(v);
    return Number.isFinite(+d) ? d : null;
}

/**
 * Meetings the user participated in (paged) by collection group over /participants
 * - Paginates by the last participant doc (cursor = last QueryDocumentSnapshot of participants)
 * - Orders by joinedAt DESC to surface most recently joined meetings first
 * - endedOnly filters client-side after hydrating meetings (keeps query simple/cheap)
 */

export async function listMyMeetingsPage({
    uid,
    pageSize = 10,
    cursor = null,
    endedOnly = true,
} = {}) {
    if (!uid) throw new Error("uid is required");

    const parts = collectionGroup(db, "participants");
    const qBase = cursor
        ? query(parts, where("uid", "==", uid), orderBy("joinedAt", "desc"), startAfter(cursor), limit(pageSize * 2))
        : query(parts, where("uid", "==", uid), orderBy("joinedAt", "desc"), limit(pageSize * 2));

    const snap = await getDocs(qBase);
    const partDocs = snap.docs;

    // keep your participant doc data keyed by meeting id
    const entries = partDocs.map((pd) => {
        const meetingRef = pd.ref.parent?.parent; // /meetings/{meetingId}
        const pdata = pd.data() || {};
        return {
            meetingRef,
            meetingId: meetingRef?.id,
            myJoinedAt: toDate(pdata.joinedAt),
            myLeftAt: toDate(pdata.leftAt || pdata.leftedAt || pdata.left || null), // support variants if you had them
        };
    }).filter(e => e.meetingRef);

    // hydrate meetings
    const meetingDocs = await Promise.all(entries.map((e) => getDoc(e.meetingRef)));
    let items = meetingDocs
        .map((mdoc, i) => {
            if (!mdoc.exists()) return null;
            const data = mdoc.data() || {};
            const createdAt = toDate(data.createdAt);
            const startedAt = toDate(data.startedAt);
            const endedAt = toDate(data.endedAt);

            const { myJoinedAt, myLeftAt, meetingId } = entries[i];

            // compute YOUR duration; fall back to meeting end if leftAt missing
            const endForYou =
                myLeftAt ||
                endedAt || // meeting ended, but you never wrote leftAt
                null;

            const myDurationMs =
                myJoinedAt && endForYou ? Math.max(0, endForYou - myJoinedAt) : null;

            return {
                id: meetingId,
                topic: data.topic || null,
                roomName: data.roomName || null,
                state: data.state || null,
                createdAt,
                startedAt,
                endedAt,
                // 👇 per-user fields
                myJoinedAt,
                myLeftAt,
                myDurationMs,
            };
        })
        .filter(Boolean);

    if (endedOnly) items = items.filter((m) => m.endedAt instanceof Date);

    // keep page size stable
    items = items.slice(0, pageSize);

    const nextCursor = partDocs.length ? partDocs[partDocs.length - 1] : null;
    return { items, nextCursor };
}


/** First N participants for avatar row (unchanged) */
export async function fetchParticipantsPreview(meetingId, cap = 5) {
    const sub = collection(doc(db, "meetings", meetingId), "participants");
    const q = query(sub, orderBy("joinedAt", "asc"), limit(cap));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
        const p = d.data() || {};
        return {
            uid: p.uid || null,
            displayName: p.displayName || "Guest",
            photoURL: p.photoURL || null,
        };
    });
}
