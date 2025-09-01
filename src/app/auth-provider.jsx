// app/auth-provider.jsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/firebaseConfig"; // <-- use the single shared instance

const Ctx = createContext({ user: null, loading: true });

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // subscribe once to the shared auth instance
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return unsub;
    }, []);

    return (
        <Ctx.Provider value={{ user, loading }}>
            {children}
        </Ctx.Provider>
    );
}

export const useAuth = () => useContext(Ctx);
