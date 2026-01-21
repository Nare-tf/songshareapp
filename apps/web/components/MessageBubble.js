"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical, Smile, Reply, Edit2, Copy, Trash2 } from "lucide-react";
import SongCard from "./SongCard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MessageBubble({ msg, isMe, onReply, onEdit, onReact, onSync, isMenuActive, onToggleMenu }) {
    const bubbleRef = useRef(null);
    const [menuPosition, setMenuPosition] = useState("top"); // 'top' or 'bottom'

    // Helper to get initials
    const initials = msg.user.substring(0, 2).toUpperCase();

    const handleAction = (action, payload) => {
        onToggleMenu();
        if (action === "reply") onReply(msg);
        if (action === "edit") onEdit(msg);
        if (action === "copy") navigator.clipboard.writeText(msg.text);
        if (action === "react") onReact(msg, payload || "❤️");
    };

    // Smart Menu Positioning
    useEffect(() => {
        if (isMenuActive && bubbleRef.current) {
            const rect = bubbleRef.current.getBoundingClientRect();
            // If closer than 150px to top, flip down
            if (rect.top < 150) {
                setMenuPosition("bottom");
            } else {
                setMenuPosition("top");
            }
        }
    }, [isMenuActive]);

    return (
        <div className={`group flex items-start gap-3 max-w-[85%] ${isMe ? "flex-row-reverse self-end" : "flex-row self-start"}`}>

            {/* Avatar */}
            {!isMe && (
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 border border-white/5 shrink-0">
                    {initials}
                </div>
            )}

            <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} min-w-0`}>

                {/* Username & Time */}
                <div className={`flex items-baseline gap-2 mb-1 px-1 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                    <span className="text-xs font-bold text-zinc-400">{msg.user}</span>
                    <span className="text-[10px] text-zinc-600">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>

                {/* Message Content Wrapper (Target for Long Press/Menu) */}
                <div className="relative group/bubble" ref={bubbleRef}>

                    {/* Reply Context (Example UI) */}
                    {msg.replyTo && (
                        <div className="mb-1 text-xs text-zinc-500 flex items-center gap-1 bg-white/5 px-2 py-1 rounded border-l-2 border-zinc-600">
                            <Reply className="w-3 h-3" />
                            <span className="font-bold">{msg.replyTo.user}:</span>
                            <span className="truncate max-w-[150px]">{msg.replyTo.text}</span>
                        </div>
                    )}

                    {/* Bubble */}
                    {msg.text && (
                        <div
                            className={`px-4 py-2 rounded-2xl text-sm leading-relaxed break-words relative z-0 ${isMe
                                ? "bg-blue-600 text-white rounded-tr-sm"
                                : "bg-zinc-800 text-zinc-200 rounded-tl-sm border border-white/5"
                                }`}
                            onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
                        >
                            <div className="prose prose-invert prose-p:my-0 prose-ul:my-0 prose-li:my-0 prose-headings:my-1 prose-headings:text-base prose-code:text-xs prose-pre:bg-black/30 prose-pre:p-2 prose-pre:rounded-lg max-w-none">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        code({ node, inline, className, children, ...props }) {
                                            return (
                                                <code className={`${className} ${inline ? 'bg-black/20 px-1 rounded' : ''}`} {...props}>
                                                    {children}
                                                </code>
                                            )
                                        }
                                    }}
                                >
                                    {msg.text}
                                </ReactMarkdown>
                            </div>
                            {msg.edited && <span className="text-[10px] opacity-60 ml-2 italic">(edited)</span>}
                        </div>
                    )}

                    {/* Reactions (Below Bubble) */}
                    {msg.reactions && msg.reactions.length > 0 && (
                        <div className="mt-1 flex gap-1 flex-wrap justify-end">
                            {Object.entries(msg.reactions.reduce((acc, curr) => {
                                acc[curr.reaction] = (acc[curr.reaction] || []);
                                acc[curr.reaction].push(curr.user);
                                return acc;
                            }, {})).map(([emoji, users]) => (
                                <div key={emoji} className="group/reaction relative">
                                    <span
                                        className="bg-zinc-800/80 text-[10px] px-1.5 py-0.5 rounded-full border border-white/5 text-zinc-300 cursor-help"
                                        title={users.join(", ")}
                                    >
                                        {emoji} {users.length}
                                    </span>
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] px-2 py-1 rounded hidden group-hover/reaction:block whitespace-nowrap z-[110]">
                                        {users.slice(0, 3).join(", ")} {users.length > 3 ? `+${users.length - 3}` : ""}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Action Menu (Desktop Hover / Mobile Tap) */}
                    {isMenuActive && (
                        <div className={`absolute ${menuPosition === "top" ? "bottom-full mb-2" : "top-full mt-2"} ${isMe ? "right-0" : "left-0"} bg-zinc-900 border border-white/10 shadow-xl rounded-xl overflow-hidden flex flex-col min-w-[150px] z-[100] animate-in fade-in zoom-in-95 duration-100`}>
                            <button onClick={() => handleAction("reply")} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-800 transition-colors text-left w-full text-zinc-200">
                                <Reply className="w-4 h-4" /> Reply
                            </button>
                            {isMe && (
                                <button onClick={() => handleAction("edit")} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-800 transition-colors text-left w-full text-zinc-200">
                                    <Edit2 className="w-4 h-4" /> Edit
                                </button>
                            )}
                            <button onClick={() => handleAction("copy")} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-800 transition-colors text-left w-full text-zinc-200">
                                <Copy className="w-4 h-4" /> Copy
                            </button>
                            <div className="flex items-center gap-1 px-2 py-2 border-t border-white/5 bg-zinc-950/30">
                                {["❤️", "🔥", "😂", "😢", "😮"].map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => handleAction("react", emoji)}
                                        className="w-8 h-8 flex items-center justify-center text-sm hover:bg-white/10 rounded-full transition-colors"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* Song Card */}
                {msg.songCard && (
                    <div
                        className={`mt-2 cursor-pointer ${isMe ? "bg-blend-darken" : ""}`}
                        onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
                    >
                        <SongCard metadata={msg.songCard} onPlay={onSync} />
                    </div>
                )}

            </div>
        </div>
    );
}
