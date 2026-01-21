"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import io from "socket.io-client";
import { useSession } from "next-auth/react";
import { Send, Copy, Music2, Users, Search, X, ListMusic, SkipBack, SkipForward, Play, Pause } from "lucide-react";
import SongCard from "./SongCard";
import SearchModal from "./SearchModal";
import MessageBubble from "./MessageBubble";
import { UserPlus } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableQueueItem({ id, song, index, onRemove, onPlay }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="bg-zinc-950/50 p-2 rounded flex gap-2 group relative hover:bg-zinc-800 cursor-grab active:cursor-grabbing transition-colors touch-none"
            onClick={(e) => {
                // Prevent click if we were dragging (simple heuristic: if transform is significant? 
                // Actually dnd-kit suppresses click on drag, but safe to check)
                onPlay();
            }}
        >
            <img src={song.thumbnail} className="w-10 h-10 rounded object-cover pointer-events-none" />
            <div className="flex-1 min-w-0 pointer-events-none">
                <p className="text-sm font-medium truncate">{song.title}</p>
                <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove(index);
                }}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-500/80 p-1 rounded-full text-white"
                onPointerDown={(e) => e.stopPropagation()}
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
}

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";

export default function RoomClient({ roomId }) {
    const { data: session, status } = useSession();
    const [socket, setSocket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const [username, setUsername] = useState("Guest");
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // New State for Advanced Features
    const [replyingTo, setReplyingTo] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [syncNotification, setSyncNotification] = useState(null);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [showNameModal, setShowNameModal] = useState(false);
    const [tempName, setTempName] = useState("");
    const [currentSyncSong, setCurrentSyncSong] = useState(null); // { id, platform, title, artist, user, isPaused, startTime, pausedPosition }
    const [progress, setProgress] = useState(0);
    const [isSeeking, setIsSeeking] = useState(false);
    const playerRef = useRef(null);

    const messagesEndRef = useRef(null);

    // Queue State
    const [queue, setQueue] = useState([]);
    const [showQueue, setShowQueue] = useState(false);

    // History State
    const [history, setHistory] = useState([]);
    const [sidebarTab, setSidebarTab] = useState("queue"); // "queue" | "history"

    // Initial History Fetch
    useEffect(() => {
        if (!roomId) return;
        fetch(`/api/history?roomId=${roomId}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    console.log("DEBUG: Fetched history:", data);
                    setHistory(data);
                }
            })
            .catch(err => console.error("Failed to fetch history:", err));
    }, [roomId]);



    const addToQueue = (song) => {
        if (!socket) return;
        const queueId = `${song.id || Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        socket.emit("queue_add", { roomId, song: { ...song, addedBy: username, queueId } });
        setSyncNotification(`Added to queue: ${song.title}`);
        setTimeout(() => setSyncNotification(null), 3000);
    };

    const removeFromQueue = (index) => {
        if (!socket) return;
        socket.emit("queue_remove", { roomId, index });
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            setQueue((items) => {
                const oldIndex = items.findIndex(item => item.queueId === active.id);
                const newIndex = items.findIndex(item => item.queueId === over.id);

                if (oldIndex !== -1 && newIndex !== -1) {
                    const newQueue = arrayMove(items, oldIndex, newIndex);
                    // Emit to server
                    socket.emit("queue_reorder", { roomId, newQueue });
                    return newQueue;
                }
                return items;
            });
        }
    };

    const playNext = () => {
        if (!socket) return;
        socket.emit("play_next", { roomId, currentSongId: currentSyncSong?.songId });
    };

    // 1. Auth & Username Setup
    useEffect(() => {
        if (status === "loading") return;

        if (session?.user?.name) {
            setUsername(session.user.name);
        } else {
            const storedName = localStorage.getItem("username");
            if (storedName && storedName !== 'Guest') {
                setUsername(storedName);
            } else {
                setShowNameModal(true);
            }
        }
    }, [status, session]);

    // Unified Socket Setup & Event Listeners
    useEffect(() => {
        if (!username || username === "Guest") return;

        const newSocket = io(SERVER_URL);
        setSocket(newSocket);

        newSocket.on("connect", () => {
            console.log("Socket connected");
            // Only join AFTER listeners are attached (which happens below because this closure captures newSocket)
            // But wait, the listeners are attached to newSocket immediately below in this same effect run.
            // However, the "connect" event might fire async. 
            // Better pattern: attach listeners, THEN emit join.
            newSocket.emit("join_room", roomId);
        });

        newSocket.on("queue_updated", (newQueue) => setQueue(newQueue));

        newSocket.on("receive_message", (message) => {
            console.log("DEBUG: Received message", message);
            setMessages((prev) => [...prev, message]);
        });

        newSocket.on("receive_message_history", (historyMessages) => {
            console.log("DEBUG: Received history", historyMessages.length);
            setMessages(historyMessages);
        });

        newSocket.on("reaction_toggled", ({ messageId, reaction, user }) => {
            setMessages((prev) => prev.map(msg => {
                if (msg.id === messageId) {
                    const reactions = msg.reactions || [];
                    const existingIndex = reactions.findIndex(r => r.user === user && r.reaction === reaction);

                    let newReactions;
                    if (existingIndex > -1) {
                        newReactions = reactions.filter((_, i) => i !== existingIndex);
                    } else {
                        newReactions = [...reactions, { reaction, user }];
                    }
                    return { ...msg, reactions: newReactions };
                }
                return msg;
            }));
        });

        newSocket.on("message_edited", ({ messageId, newText }) => {
            setMessages((prev) => prev.map(msg => msg.id === messageId ? { ...msg, text: newText, edited: true } : msg));
        });

        newSocket.on("sync_state_updated", (data) => {
            if (!data) { // FIX: Handle null data (no song playing)
                setCurrentSyncSong(null);
                return;
            }
            setSyncNotification(`${data.user} ${data.isPaused ? 'paused' : 'started'} remote player.`);
            setCurrentSyncSong(prev => ({ ...data, isPaused: data.isPaused }));
            setTimeout(() => setSyncNotification(null), 3000);
        });

        newSocket.on("sync_stopped", () => {
            setSyncNotification("Session ended by DJ.");
            setCurrentSyncSong(null);
            setTimeout(() => setSyncNotification(null), 3000);
        });

        newSocket.on("history_entry", (entry) => {
            setHistory(prev => [entry, ...prev]);
        });

        return () => {
            newSocket.disconnect();
        };
    }, [roomId, username]); // Re-connect if room or username changes

    // Queue Event Listener (Window event from other components)
    useEffect(() => {
        if (!socket) return;
        const handleQueueEvent = (e) => {
            addToQueue(e.detail);
        };
        window.addEventListener('queue_song', handleQueueEvent);
        return () => window.removeEventListener('queue_song', handleQueueEvent);
    }, [socket, username]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);





    // Update progress bar
    useEffect(() => {
        if (!currentSyncSong) return;
        if (currentSyncSong.isPaused && currentSyncSong.pausedPosition) {
            setProgress(currentSyncSong.pausedPosition);
            return;
        }

        if (isSeeking) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const elapsed = (now - currentSyncSong.startTime) / 1000;
            setProgress(elapsed);
        }, 1000);

        return () => clearInterval(interval);
    }, [currentSyncSong, isSeeking]);

    // Handle Play/Pause/Seek commands via postMessage (YouTube)
    useEffect(() => {
        if (!currentSyncSong || currentSyncSong.platform !== 'youtube') return;

        const iframe = playerRef.current;
        if (!iframe) return;

        if (currentSyncSong.isPaused) {
            iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        } else {
            // If playing, play and ensure we are at the correct time
            iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');

            // Handle seeking while playing (sync)
            if (currentSyncSong.startTime) {
                const currentSeek = (Date.now() - currentSyncSong.startTime) / 1000;
                iframe.contentWindow.postMessage(`{"event":"command","func":"seekTo","args":[${currentSeek}, true]}`, '*');
            }
        }

    }, [currentSyncSong?.isPaused, currentSyncSong?.startTime, currentSyncSong?.pausedPosition]);


    // Detect Song End (Auto-play) - DUAL STRATEGY: Event + Timer Fallback
    useEffect(() => {
        console.log("DEBUG: Auto-play effect mounted", currentSyncSong);

        let autoPlayTimer;

        // Strategy 1: Timer Fallback (Reliable if we have duration)
        if (currentSyncSong && currentSyncSong.duration && !currentSyncSong.isPaused) {
            const now = Date.now();
            const elapsed = (now - currentSyncSong.startTime) / 1000;
            const remaining = currentSyncSong.duration - elapsed;

            console.log(`DEBUG: Timer set for ${remaining}s`);

            if (remaining > 0) {
                // Add 1s buffer to ensure it really finished for everyone
                autoPlayTimer = setTimeout(() => {
                    console.log("Timer fired: Song should have ended. Triggering auto-play override.");
                    playNext();
                }, (remaining + 1.5) * 1000);
            } else {
                // Already over?
                console.log("Song duration exceeded on load? Triggering next.");
                // playNext(); // dangerous loop if duration is wrong, let's wait for user or event usually, or just trigger once.
            }
        }

        // Strategy 2: Window Message (Preferred but flaky on some environments)
        const handleWindowMessage = (event) => {
            // Filter out obviously irrelevant messages
            if (typeof event.data === 'string' && (event.data.includes('webpack') || event.data.includes('fast-refresh'))) return;
            if (typeof event.data === 'object' && (event.data?.source === 'react-devtools-bridge')) return;

            if (!currentSyncSong || currentSyncSong.platform !== 'youtube') return;

            try {
                if (typeof event.data === 'string') {
                    const data = JSON.parse(event.data);

                    if (data.event === "onStateChange" && data.info === 0) {
                        console.log("Event received: Song ended, triggering auto-play");
                        if (autoPlayTimer) clearTimeout(autoPlayTimer); // Clear timer if event fires first
                        playNext();
                    }
                }
            } catch (e) { }
        };

        window.addEventListener("message", handleWindowMessage);
        return () => {
            window.removeEventListener("message", handleWindowMessage);
            if (autoPlayTimer) clearTimeout(autoPlayTimer);
        };
    }, [currentSyncSong]);

    const handleStopSync = () => {
        socket.emit("stop_sync", roomId);
        setCurrentSyncSong(null);
    };

    const handleTogglePause = () => {
        if (!currentSyncSong) return;
        const newPausedState = !currentSyncSong.isPaused;
        let newStartTime = currentSyncSong.startTime;
        let newPausedPosition = currentSyncSong.pausedPosition;

        if (newPausedState) {
            // PAUSE: Capture current position
            if (!newPausedPosition) {
                newPausedPosition = (Date.now() - currentSyncSong.startTime) / 1000;
            }
        } else {
            // RESUME: Adjust start time so that (Now - StartTime) = PausedPosition
            // Now - NewStartTime = PausedPosition
            // NewStartTime = Now - PausedPosition
            // However, to keep it simple and drift-free, we just recalculate from paused pos
            if (currentSyncSong.pausedPosition) {
                newStartTime = Date.now() - (currentSyncSong.pausedPosition * 1000);
            }
            newPausedPosition = null;
        }

        const updatedState = {
            ...currentSyncSong,
            isPaused: newPausedState,
            startTime: newStartTime,
            pausedPosition: newPausedPosition
        };

        // Optimistic
        setCurrentSyncSong(updatedState);

        socket.emit("sync_update", {
            ...updatedState,
            user: username
        });
    };

    const handleSeekChange = (e) => {
        setIsSeeking(true);
        setProgress(parseFloat(e.target.value));
    };

    const handleSeekEnd = (e) => {
        const newTime = parseFloat(e.target.value);
        setIsSeeking(false);

        if (!currentSyncSong) return;

        // Calculate new StartTime such that (Now - StartTime) = NewTime
        const newStartTime = Date.now() - (newTime * 1000);

        const updatedState = {
            ...currentSyncSong,
            startTime: newStartTime,
            pausedPosition: currentSyncSong.isPaused ? newTime : null
        };

        setCurrentSyncSong(updatedState);
        // setProgress(newTime); // Already set by change

        socket.emit("sync_update", {
            ...updatedState,
            user: username
        });
    };




    const handlePrev = () => {
        if (!currentSyncSong) return;

        // If playing > 3 seconds, just restart song
        const elapsed = (Date.now() - currentSyncSong.startTime) / 1000;
        if (elapsed > 3) {
            socket.emit("sync_update", { ...currentSyncSong, startTime: Date.now(), pausedPosition: 0 });
            return;
        }

        // Else try to play previous from history
        if (history.length > 0) {
            let prevSong = history[0];

            // If the top of history is the current song, go back one more
            if (prevSong.songId === currentSyncSong.songId || prevSong.id === currentSyncSong.songId) {
                if (history.length > 1) {
                    prevSong = history[1];
                } else {
                    // No previous song to go back to
                    return;
                }
            }

            const syncData = {
                roomId,
                songId: prevSong.songId,
                platform: prevSong.platform,
                title: prevSong.title,
                artist: prevSong.artist,
                thumbnail: prevSong.thumbnail,
                startTime: Date.now(),
                isPaused: false,
                user: username,
                duration: 0
            };
            socket.emit("sync_update", syncData);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!socket) {
            console.error("Socket not connected");
            return;
        }
        console.log("DEBUG: handleSendMessage called", { inputText, socket: !!socket, username });
        if (!inputText.trim()) return;

        const messageData = {
            roomId,
            user: username,
            text: inputText,
            timestamp: new Date().toISOString(),
            songCard: null,
        };

        // Check for links
        // Simple regex for http/https
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = inputText.match(urlRegex);
        if (urls && urls.length > 0 && !editingMessage) {
            // Fetch metadata for the FIRST link found (MVP)
            try {
                const res = await fetch(`${SERVER_URL}/api/metadata`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: urls[0] }),
                });
                if (res.ok) {
                    const metadata = await res.json();
                    messageData.songCard = metadata;
                }
            } catch (err) {
                console.error("Metadata fetch failed", err);
            }
        }

        if (editingMessage) {
            console.log("DEBUG: Emitting edit_message");
            socket.emit("edit_message", { roomId, messageId: editingMessage.id, newText: inputText });
            setEditingMessage(null);
        } else {
            if (replyingTo) {
                messageData.replyTo = replyingTo;
                setReplyingTo(null);
            }
            console.log("DEBUG: Emitting send_message", messageData);
            try {
                socket.emit("send_message", messageData);
                console.log("DEBUG: Socket emit success (async check not possible usually but no error thrown)");
            } catch (err) {
                console.error("DEBUG: Socket emit FAILED", err);
            }
        }

        setInputText("");
        console.log("DEBUG: Input cleared");
    };

    const handleReply = (msg) => {
        setReplyingTo(msg);
        setEditingMessage(null);
        // Focus input
    };

    const handleEdit = (msg) => {
        setEditingMessage(msg);
        setReplyingTo(null);
        setInputText(msg.text);
    };

    const handleReact = (msg, reaction) => {
        socket.emit("toggle_reaction", { roomId, messageId: msg.id, reaction, user: username });
        setActiveMenuId(null);
    };

    const handleSync = (metadata) => {
        const syncData = {
            roomId,
            songId: metadata.id,
            platform: metadata.platform,
            title: metadata.title,
            artist: metadata.artist,
            startTime: Date.now(),
            isPlaying: true,
            isPaused: false,
            user: username,
            // Pass full metadata to ensure server can log history with thumbnail etc.
            thumbnail: metadata.thumbnail
        };
        socket.emit("sync_update", syncData);
        // Note: We don't need to manually set local state here anymore because server now broadcasts to everyone (io.to)
    };

    const cancelAction = () => {
        setReplyingTo(null);
        setEditingMessage(null);
        setInputText("");
    };

    const copyRoomLink = () => {
        navigator.clipboard.writeText(window.location.href);
        alert("Room link copied to clipboard!");
    };

    // Dynamic origin for YouTube API
    const [origin, setOrigin] = useState("");
    useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    const iframeSrc = useMemo(() => {
        if (!currentSyncSong || currentSyncSong.platform !== 'youtube') return "";
        if (!origin) return "";

        // Initial load only. Subsequent updates handled via postMessage
        // We add 'enablejsapi=1' to allow control
        return `https://www.youtube.com/embed/${currentSyncSong.songId}?enablejsapi=1&controls=0&autoplay=1&origin=${origin}&widget_referrer=${origin}&start=${Math.floor((Date.now() - currentSyncSong.startTime) / 1000)}`;
    }, [currentSyncSong?.songId, origin]);

    // Sync Effect: Handles Play/Pause/Seek updates WITHOUT reloading iframe
    useEffect(() => {
        if (!playerRef.current || !currentSyncSong || currentSyncSong.platform !== 'youtube') return;

        const player = playerRef.current;

        // Calculate where we should be
        let targetTime = 0;
        if (currentSyncSong.isPaused) {
            targetTime = currentSyncSong.pausedPosition || 0;
        } else {
            targetTime = (Date.now() - currentSyncSong.startTime) / 1000;
        }

        // 1. Seek to target time (Ensures everyone is at the same second)
        player.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'seekTo',
            args: [targetTime, true]
        }), '*');

        // 2. Play or Pause
        const command = currentSyncSong.isPaused ? "pauseVideo" : "playVideo";
        player.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: command,
            args: []
        }), '*');

    }, [currentSyncSong?.isPaused, currentSyncSong?.startTime, currentSyncSong?.pausedPosition]);


    const handleSelectSong = (track) => {
        setIsSearchOpen(false);
        const messageData = {
            roomId,
            user: username,
            text: "", // Optional: could add text like "Shared a song"
            timestamp: new Date().toISOString(),
            songCard: track
        };
        socket.emit("send_message", messageData);
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-zinc-950 text-white font-sans overflow-hidden">
            <SearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onSelect={handleSelectSong}
            />

            {/* Name Modal - Rendered Conditionally */}
            {showNameModal && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-center mb-4">
                            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                                <UserPlus className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <h2 className="text-xl font-bold text-center mb-2">Join Vibe Room</h2>
                        <p className="text-zinc-400 text-center text-sm mb-6">Pick a cool name to start jammin'.</p>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (!tempName.trim()) return;
                            setUsername(tempName);
                            localStorage.setItem("username", tempName);
                            setShowNameModal(false);
                        }}>
                            <input
                                autoFocus
                                type="text"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                placeholder="Enter your name..."
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-center font-bold"
                            />
                            <button
                                type="submit"
                                disabled={!tempName.trim()}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20"
                            >
                                Let's Go
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Sync Notification Banner */}
            {syncNotification && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-green-500/90 text-white px-4 py-2 rounded-full shadow-xl z-50 text-sm font-bold animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-none">
                    {syncNotification}
                </div>
            )}

            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 bg-zinc-900/80 backdrop-blur-md border-b border-white/5 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/10">
                        <Music2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-tight">Vibe Room</h1>
                        <p className="text-xs text-zinc-500 font-mono">ID: {roomId}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={copyRoomLink}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        title="Copy Invite Link"
                    >
                        <Copy className="w-5 h-5" />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 border border-white/5">
                        {username.charAt(0).toUpperCase()}
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">

                {/* Main Content (Chat + Player) */}
                <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${showQueue ? "mr-72 hidden md:flex" : ""}`}>
                    {/* Chat Area */}
                    <main
                        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
                        onClick={() => setActiveMenuId(null)}
                    >
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-600 opacity-50">
                                <Users className="w-12 h-12 mb-2" />
                                <p>No vibes yet. Share a song!</p>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <MessageBubble
                                key={idx}
                                msg={msg}
                                isMe={msg.user === username}
                                onReply={handleReply}
                                onEdit={handleEdit}
                                onReact={handleReact}
                                onSync={handleSync}
                                isMenuActive={activeMenuId === msg.id}
                                onToggleMenu={() => setActiveMenuId(activeMenuId === msg.id ? null : msg.id)}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </main>

                    {/* Input Area */}
                    <footer className="bg-zinc-900/80 backdrop-blur-md border-t border-white/5 pb-4">

                        {/* GLOBAL PLAYER (Mini) */}
                        {currentSyncSong && (
                            <div className="bg-zinc-950 border-b border-white/5 p-2 flex items-center justify-between relative overflow-hidden group">
                                {/* Background ambience */}
                                <div className={`absolute inset-0 blur-xl opacity-50 pointer-events-none ${currentSyncSong.isPaused ? 'bg-yellow-500/10' : 'bg-blue-500/10'}`} />

                                <div className="flex items-center gap-3 relative z-10 flex-1 min-w-0">
                                    {/* The Player Embed - Hidden or Mini */}
                                    <div className="w-[120px] h-[68px] rounded-lg overflow-hidden shrink-0 bg-black shadow-lg relative cursor-pointer" onClick={handleTogglePause}>
                                        {/* Pause Overlay */}
                                        {currentSyncSong.isPaused && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                                                <span className="w-8 h-8 flex items-center justify-center bg-white/20 rounded-full text-white">
                                                    <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-1" />
                                                </span>
                                            </div>
                                        )}

                                        {currentSyncSong.platform === 'youtube' ? (
                                            <iframe
                                                ref={playerRef}
                                                width="100%"
                                                height="100%"
                                                src={iframeSrc}
                                                key={currentSyncSong.songId} // Remount if song changes
                                                title="Sync Player"
                                                frameBorder="0"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                                className="pointer-events-none"
                                            />
                                        ) : (
                                            <iframe
                                                width="100%"
                                                height="100%"
                                                src={`https://open.spotify.com/embed/track/${currentSyncSong.songId}?utm_source=generator&theme=0`}
                                                frameBorder="0"
                                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                                loading="lazy"
                                                className={currentSyncSong.isPaused ? 'opacity-50' : ''}
                                            />
                                        )}
                                    </div>

                                    <div className="flex flex-col truncate flex-1">
                                        <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${currentSyncSong.isPaused ? 'text-yellow-500' : 'text-blue-400'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${currentSyncSong.isPaused ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                                            {currentSyncSong.isPaused ? 'PAUSED' : 'LIVE SYNC'}
                                        </span>
                                        <span className="font-bold text-sm truncate text-white">{currentSyncSong.title || "Unknown Track"}</span>
                                        <span className="text-xs text-zinc-400 truncate">by {currentSyncSong.artist || "Unknown Artist"} • DJ {currentSyncSong.user}</span>

                                        {/* Seek Bar */}
                                        <input
                                            type="range"
                                            min="0"
                                            max="300" // Hardcoded 5m for now (MVP)
                                            value={progress}
                                            onChange={handleSeekChange}
                                            onMouseUp={handleSeekEnd}
                                            onTouchEnd={handleSeekEnd}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer mt-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                                        />
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center gap-4 relative z-10">
                                    <button
                                        onClick={handlePrev}
                                        className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors disabled:opacity-30"
                                        disabled={!currentSyncSong && history.length === 0}
                                        title="Previous"
                                    >
                                        <SkipBack className="w-5 h-5 fill-current" />
                                    </button>

                                    <button
                                        onClick={handleTogglePause}
                                        className="p-3 bg-white text-black rounded-full hover:scale-105 transition-transform"
                                    >
                                        {currentSyncSong.isPaused ? (
                                            <Play className="w-6 h-6 fill-current ml-0.5" />
                                        ) : (
                                            <Pause className="w-6 h-6 fill-current" />
                                        )}
                                    </button>

                                    <button
                                        onClick={playNext}
                                        className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors disabled:opacity-30"
                                        disabled={!queue.length}
                                        title="Next"
                                    >
                                        <SkipForward className="w-5 h-5 fill-current" />
                                    </button>

                                    <button
                                        onClick={handleStopSync}
                                        className="p-2 hover:bg-white/10 rounded-full text-red-500 hover:text-red-400 transition-colors ml-2"
                                        title="Stop Session"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Reply/Edit Banner */}
                        {(replyingTo || editingMessage) && (
                            <div className="flex items-center justify-between bg-zinc-800/50 p-2 px-4 rounded-t-xl border border-white/5 border-b-0 text-xs">
                                <div className="flex items-center gap-2 text-zinc-300">
                                    {replyingTo ? (
                                        <>
                                            <div className="w-1 h-4 bg-blue-500 rounded-full" />
                                            Replying to <span className="font-bold">{replyingTo.user}</span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-1 h-4 bg-yellow-500 rounded-full" />
                                            Editing message
                                        </>
                                    )}
                                </div>
                                <button onClick={cancelAction} className="p-1 hover:bg-zinc-700 rounded-full">
                                    <X className="w-3 h-3 text-zinc-400" />
                                </button>
                            </div>
                        )}

                        <form onSubmit={handleSendMessage} className={`relative max-w-4xl mx-auto rounded-2xl shadow-xl ${(replyingTo || editingMessage) ? "rounded-t-none" : ""}`}>
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage(e);
                                    }
                                }}
                                onInput={(e) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                }}
                                placeholder="Send a message (Shift+Enter for new line) or link..."
                                className="w-full pl-12 pr-12 py-3.5 bg-zinc-950 border border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white placeholder-zinc-600 transition-all font-medium resize-none min-h-[56px] max-h-32 scrollbar-thin scrollbar-thumb-zinc-700"
                                rows={1}
                            />
                            <button
                                type="button"
                                onClick={() => setIsSearchOpen(true)}
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                                title="Search Song"
                            >
                                <Search className="w-5 h-5" />
                            </button>
                            <button
                                type="submit"
                                disabled={!inputText.trim() || !socket}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </footer>
                </div>

                {/* Queue Sidebar (Right Side) */}
                <div className={`absolute inset-y-0 right-0 w-72 bg-zinc-900 border-l border-white/5 transform transition-transform duration-300 z-40 ${showQueue ? "translate-x-0" : "translate-x-full"}`}>
                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <div className="flex gap-4">
                            <button
                                onClick={() => setSidebarTab("queue")}
                                className={`font-bold flex items-center gap-2 text-sm ${sidebarTab === 'queue' ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <ListMusic className="w-5 h-5" /> Queue ({queue.length})
                            </button>
                            <button
                                onClick={() => setSidebarTab("history")}
                                className={`font-bold flex items-center gap-2 text-sm ${sidebarTab === 'history' ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                History
                            </button>
                        </div>
                        <button onClick={() => setShowQueue(false)} className="p-1 hover:bg-white/10 rounded-full"><X className="w-4 h-4" /></button>
                    </div>

                    <div className="overflow-y-auto h-[calc(100%-60px)] p-2 space-y-2">
                        {sidebarTab === 'queue' ? (
                            queue.length === 0 ? (
                                <div className="text-center text-zinc-500 mt-10 text-sm">
                                    <p>Queue is empty.</p>
                                    <p>Add songs to play them next!</p>
                                </div>
                            ) : (
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={queue.map(s => s.queueId)} strategy={verticalListSortingStrategy}>
                                        {queue.map((song, idx) => (
                                            <SortableQueueItem
                                                key={song.queueId}
                                                id={song.queueId}
                                                song={song}
                                                index={idx}
                                                onRemove={removeFromQueue}
                                                onPlay={() => handleSync({
                                                    id: song.songId || song.id,
                                                    platform: song.platform,
                                                    title: song.title,
                                                    artist: song.artist,
                                                    thumbnail: song.thumbnail,
                                                })}
                                            />
                                        ))}
                                    </SortableContext>
                                </DndContext>
                            )
                        ) : (
                            history.length === 0 ? (
                                <div className="text-center text-zinc-500 mt-10 text-sm">
                                    <p>No history yet.</p>
                                </div>
                            ) : (
                                history.map((song, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-zinc-950/30 p-2 rounded flex gap-2 group relative opacity-75 hover:opacity-100 transition-opacity cursor-pointer hover:bg-zinc-900"
                                        onClick={() => handleSync({
                                            id: song.songId,
                                            platform: song.platform,
                                            title: song.title,
                                            artist: song.artist,
                                            thumbnail: song.thumbnail,
                                        })}
                                    >
                                        <img src={song.thumbnail} className="w-10 h-10 rounded object-cover grayscale hover:grayscale-0 transition-all pointer-events-none" />
                                        <div className="flex-1 min-w-0 pointer-events-none">
                                            <p className="text-sm font-medium truncate">{song.title}</p>
                                            <div className="flex justify-between items-center pr-2">
                                                <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
                                                <p className="text-[10px] text-zinc-600">by {song.playedBy}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                addToQueue(song);
                                            }}
                                            className="absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 bg-blue-600 p-1.5 rounded-full text-white shadow-lg z-10"
                                            title="Add back to queue"
                                        >
                                            <UserPlus className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))
                            )
                        )}
                    </div>

                    {sidebarTab === 'queue' && queue.length > 0 && (
                        <div className="p-4 border-t border-white/5">
                            <button onClick={playNext} className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded font-bold text-sm">
                                Play Next
                            </button>
                        </div>
                    )}
                </div>

            </div>

            {/* Queue Toggle Button (Floating) */}
            <button
                onClick={() => setShowQueue(!showQueue)}
                className="fixed bottom-44 right-4 md:bottom-8 md:right-8 bg-zinc-800 text-white p-3 rounded-full shadow-xl border border-white/10 z-50 flex items-center gap-2 hover:bg-zinc-700 transition-colors"
                title="Toggle Queue"
            >
                <ListMusic className="w-5 h-5" />
                {queue.length > 0 && <span className="text-xs font-bold bg-blue-500 px-1.5 rounded-full min-w-[20px]">{queue.length}</span>}
            </button>

        </div>
    );
}
