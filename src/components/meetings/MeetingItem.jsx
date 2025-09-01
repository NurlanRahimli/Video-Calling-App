"use client";

import React from "react";
import ParticipantsRow from "./ParticipantsRow";
import { formatDuration as fmtDurMs } from "@/utils/duration"; // expects ms

// --- helpers ---
const toJsDate = (v) => {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v?.toDate === "function") return v.toDate();
    const d = new Date(v);
    return Number.isFinite(+d) ? d : null;
};
const isValid = (d) => d instanceof Date && Number.isFinite(+d);

function formatDate(d) {
    if (!isValid(d)) return "—";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function formatTimeRange(start, end) {
    if (!isValid(start) || !isValid(end)) return null;
    const s = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const e = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${s} – ${e}`;
}

export default function MeetingItem({ meeting }) {
    const { topic, roomName, startedAt, endedAt, createdAt, participants = [] } = meeting;

    const s = toJsDate(startedAt);
    const e = toJsDate(endedAt);
    const c = toJsDate(createdAt);

    const title = topic || roomName || "Untitled meeting";
    const displayDate = e ?? s ?? c;
    const date = formatDate(displayDate);
    const timeRange = formatTimeRange(s, e);

    // if no endedAt, show up-to-now duration (or show "—" if you prefer)
    let duration = "—";
    if (isValid(s)) {
        const end = isValid(e) ? e : null; // or new Date() to count ongoing
        if (end) {
            duration = fmtDurMs(end - s); // uses your utils/duration
        }
    }

    return (
        <div className="rounded-3xl p-4 sm:p-5 bg-white/10 backdrop-blur-md border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/10 text-slate-100">
            <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-white truncate sm:text-base">{title}</h3>
                <p className="text-xs sm:text-sm text-white/70">
                    {date} {timeRange ? `· ${timeRange}` : ""}
                </p>
                {/* <span className="text-xs shrink-0 sm:text-sm text-white/80">{duration}</span> */}
            </div>
            <div className="mt-3">
                <ParticipantsRow participants={participants} />
            </div>
        </div>
    );
}
