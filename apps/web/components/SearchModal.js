"use client";

import { useState, useEffect } from "react";
import { Search, X, Loader2, Music } from "lucide-react";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";

export default function SearchModal({ isOpen, onClose, onSelect }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            // Focus input on open (optional - simple via autoFocus)
        } else {
            document.body.style.overflow = "unset";
            setQuery("");
            setResults([]);
        }
        return () => { document.body.style.overflow = "unset"; };
    }, [isOpen]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        try {
            const res = await fetch(`${SERVER_URL}/api/search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
            });
            const data = await res.json();
            setResults(data);
        } catch (error) {
            console.error("Search failed", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex items-center gap-3">
                    <Search className="w-5 h-5 text-zinc-400" />
                    <form onSubmit={handleSearch} className="flex-1">
                        <input
                            type="text"
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search for a song..."
                            className="w-full bg-transparent border-none focus:outline-none text-white placeholder-zinc-500 text-lg"
                        />
                    </form>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-zinc-800">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                            <Loader2 className="w-8 h-8 animate-spin mb-2" />
                            <p>Searching youtube...</p>
                        </div>
                    )}

                    {!loading && results.length === 0 && query && (
                        <p className="text-center text-zinc-500 py-8">No results found.</p>
                    )}

                    {!loading && results.map((track) => (
                        <button
                            key={track.id}
                            onClick={() => onSelect(track)}
                            className="w-full flex items-center gap-4 p-3 hover:bg-zinc-800/50 rounded-xl transition-colors group text-left"
                        >
                            <div className="relative w-16 h-9 bg-zinc-800 rounded mx-auto overflow-hidden shrink-0">
                                <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-white truncate">{track.title}</h3>
                                <p className="text-sm text-zinc-400 truncate">{track.artist}</p>
                            </div>
                            <div className="text-xs text-zinc-600 font-mono group-hover:text-zinc-400">
                                {track.duration}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
