"use client";

import { Play, Share2, ExternalLink, Heart } from "lucide-react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

const SongCard = ({ metadata, onPlay }) => {
    const { data: session } = useSession();
    const [isLiked, setIsLiked] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    if (!metadata) return null;

    const { title, artist, thumbnail, platform, id, originalUrl } = metadata;

    // Check if liked on mount (mock/optimization: typically cached or parent passed)
    // For now, we assume local state toggle for immediate feedback

    const toggleFavorite = async (e) => {
        e.stopPropagation();
        if (!session) return alert("Login to favorite songs!");

        setIsLoading(true);
        // Optimistic update
        const newState = !isLiked;
        setIsLiked(newState);

        try {
            const method = newState ? "POST" : "DELETE";
            const url = newState ? "/api/favorites" : `/api/favorites?songId=${id}`;
            const body = newState ? JSON.stringify({ songId: id, platform, title, artist, thumbnail }) : null;

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body
            });

            if (!res.ok) throw new Error("Failed to toggle");
        } catch (err) {
            console.error(err);
            setIsLiked(!newState); // Revert
        } finally {
            setIsLoading(false);
        }
    };

    // Decide embed URL
    let embedUrl = "";
    if (platform === "spotify") {
        embedUrl = `https://open.spotify.com/embed/track/${id}?utm_source=generator&theme=0`;
    } else if (platform === "youtube") {
        embedUrl = `https://www.youtube.com/embed/${id}`;
    }

    return (
        <div className="my-2 w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg transition-all hover:border-zinc-700 group">
            {/* Embed Area */}
            <div className="relative aspect-video w-full bg-black">
                {platform === "spotify" ? (
                    <iframe
                        style={{ borderRadius: "12px" }}
                        src={embedUrl}
                        width="100%"
                        height="152"
                        frameBorder="0"
                        allowFullScreen=""
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        className="w-full h-[152px]" // Spotify embed fixed height
                    />
                ) : (
                    <iframe
                        width="100%"
                        height="100%"
                        src={embedUrl}
                        title={title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="w-full h-full object-cover"
                    />
                )}

                {/* Favorite Overlay Trigger (Visible on Hover/Touch) */}
                <button
                    onClick={toggleFavorite}
                    className="absolute top-2 right-2 p-2 rounded-full bg-black/50 backdrop-blur-sm hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-10"
                >
                    <Heart className={`w-5 h-5 transition-colors ${isLiked ? "fill-red-500 text-red-500" : "text-white"}`} />
                </button>
            </div>

            {/* Footer/Actions (Mockup for vibe) */}
            <div className="px-4 py-2 flex items-center justify-between bg-zinc-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${platform === 'spotify' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                        {platform}
                    </span>
                    <span className="text-xs text-zinc-500 truncate max-w-[150px]">{artist}</span>
                </div>

                <div className="flex items-center gap-2">
                    {onPlay && (
                        <div className="flex bg-blue-500/10 rounded-full overflow-hidden">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPlay(metadata);
                                }}
                                className="flex items-center gap-1 px-3 py-1 hover:bg-blue-500/20 text-blue-400 text-[10px] font-bold transition-colors border-r border-blue-500/20"
                                title="Play Now"
                            >
                                <Play className="w-3 h-3" /> PLAY
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // Hacky dispatch for now, ideally passed via props
                                    // But since SongCard is deep in MessageBubble, we use a custom event or context.
                                    // SIMPLER: Dispatch a custom DOM event 'queue_song'
                                    window.dispatchEvent(new CustomEvent('queue_song', { detail: metadata }));
                                }}
                                className="px-2 py-1 hover:bg-blue-500/20 text-blue-400 text-[10px] font-bold transition-colors"
                                title="Add to Queue"
                            >
                                +
                            </button>
                        </div>
                    )}
                    <a
                        href={originalUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 text-zinc-500 hover:text-white transition-colors rounded-full hover:bg-white/10"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                </div>
            </div>
        </div>
    );
};

export default SongCard;
