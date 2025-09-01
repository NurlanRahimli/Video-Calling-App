"use client";

import React from "react";

function initials(name = "?") {
    const parts = name.trim().split(/\s+/);
    const [a = "", b = ""] = parts;
    return (a[0] || "").toUpperCase() + (b[0] || "").toUpperCase();
}

function FallbackAvatar({ name, size }) {
    return (
        <div
            className="inline-flex items-center justify-center font-medium rounded-full shadow-sm bg-white/20 text-white/90 ring-2 ring-white/30"
            style={{ width: size, height: size, fontSize: size * 0.38 }}
            title={name}
        >
            {initials(name)}
        </div>
    );
}

export default function ParticipantsRow({
    participants = [],
    max = 5,
    size = 28,
}) {
    const shown = participants.slice(0, max);
    const overflow = Math.max(0, participants.length - shown.length);

    return (
        <div className="flex items-center -space-x-2">
            {shown.map((p, i) => {
                const key = p.uid || p.displayName || i;
                const title = p.displayName || "Guest";
                const src = p.photoURL || p.avatar || "";

                return src ? (
                    <img
                        key={key}
                        src={src}
                        width={size}
                        height={size}
                        title={title}
                        alt={title}
                        className="object-cover rounded-full shadow-sm ring-2 ring-white/30"
                        style={{ width: size, height: size }}
                        onError={(e) => {
                            // swap to a glassy initials bubble if image fails
                            e.currentTarget.replaceWith(
                                Object.assign(document.createElement("div"), {
                                    className:
                                        "inline-flex items-center justify-center rounded-full bg-white/20 text-white/90 font-medium ring-2 ring-white/30 shadow-sm",
                                    title,
                                    innerText: initials(title),
                                    style: `width:${size}px;height:${size}px;font-size:${size * 0.38}px`,
                                })
                            );
                        }}
                    />
                ) : (
                    <FallbackAvatar key={key} name={title} size={size} />
                );
            })}

            {overflow > 0 && (
                <div
                    className="inline-flex items-center justify-center rounded-full shadow-sm bg-white/10 text-white/90 ring-2 ring-white/30"
                    style={{ width: size, height: size, fontSize: size * 0.38 }}
                    title={`+${overflow} more`}
                >
                    +{overflow}
                </div>
            )}
        </div>
    );
}
