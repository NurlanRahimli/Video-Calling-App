export default function Loading() {
    return (
        <main className="max-w-3xl px-4 py-6 mx-auto sm:py-8">
            <div className="space-y-3 sm:space-y-4">
                {[...Array(3)].map((_, i) => (
                    <div
                        key={i}
                        className="rounded-3xl p-5 bg-white/10 backdrop-blur-md border border-white/20 ring-1 ring-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                    >
                        <div className="flex items-center justify-between">
                            <div className="w-40 h-5 rounded bg-white/20 animate-pulse" />
                            <div className="w-16 h-4 rounded bg-white/20 animate-pulse" />
                        </div>
                        <div className="w-56 h-4 mt-3 rounded bg-white/20 animate-pulse" />
                        <div className="flex mt-4 -space-x-2">
                            {[...Array(5)].map((__, j) => (
                                <div
                                    key={j}
                                    className="rounded-full h-7 w-7 bg-white/20 ring-2 ring-white/30 animate-pulse"
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
}
