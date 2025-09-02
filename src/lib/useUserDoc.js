// src/lib/useUserDoc.js
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebaseConfig";

export function useUserDoc(uid) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!uid) { setProfile(null); setLoading(false); return; }
        const unsub = onSnapshot(
            doc(db, "users", uid),
            snap => { setProfile(snap.data() || null); setLoading(false); },
            () => setLoading(false)
        );
        return () => unsub();
    }, [uid]);

    return { profile, loading };
}
