export const runtime = 'nodejs'; // ensure Node runtime (not Edge)

export async function POST() {
    const key = process.env.DAILY_API_KEY;
    console.log("DAILY_API_KEY length:", key?.length); // should print a number (e.g., 64)

    if (!key) {
        return new Response(JSON.stringify({ error: "Missing DAILY_API_KEY" }), { status: 500 });
    }

    try {
        const resp = await fetch("https://api.daily.co/v1/rooms", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                properties: {
                    exp: Math.round(Date.now() / 1000) + 60 * 60,
                    enable_chat: true,
                    enable_screenshare: true,
                    start_video_off: true,
                    start_audio_off: true,
                    enable_recording: "cloud"  // <— allow Daily cloud recording in this room
                },
            }),
        });

        const text = await resp.text(); // show exactly what Daily replies
        if (!resp.ok) {
            console.error("Daily error", resp.status, text);
            return new Response(JSON.stringify({ error: text }), { status: resp.status });
        }
        const data = JSON.parse(text);
        return new Response(JSON.stringify({ roomUrl: data.url, roomName: data.name }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: e?.message || "Room create failed" }), { status: 500 });
    }
}
