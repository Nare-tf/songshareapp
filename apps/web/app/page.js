"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Music, ArrowRight, Radio } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");

  const handleCreateRoom = () => {
    if (!username) return alert("Please enter a username");
    const newRoomId = Math.random().toString(36).substring(7);
    localStorage.setItem("username", username);
    router.push(`/room/${newRoomId}`);
  };

  const handleJoinRoom = () => {
    if (!username || !roomId) return alert("Please enter username and room ID");
    localStorage.setItem("username", username);
    router.push(`/room/${roomId}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/30 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/30 rounded-full blur-[120px]" />

      <div className="z-10 w-full max-w-md p-8">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 mb-6 shadow-lg shadow-purple-500/20">
            <Music className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 mb-2">
            Vibe Share
          </h1>
          <p className="text-zinc-400 text-lg">
            Real-time music sharing chat rooms.
          </p>
        </div>

        {/* Glass Card */}
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5 ml-1">
                Your Name
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username..."
                className="w-full px-4 py-3 bg-zinc-950/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white placeholder-zinc-600 transition-all"
              />
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-zinc-900/50 px-2 text-zinc-500">Action</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={handleCreateRoom}
                className="group relative w-full flex items-center justify-center gap-2 bg-white text-black font-semibold py-3.5 rounded-xl hover:bg-zinc-200 transition-all active:scale-[0.98]"
              >
                <Radio className="w-4 h-4" />
                <span>Create New Room</span>
                <ArrowRight className="w-4 h-4 opacity-0 -ml-2 group-hover:ml-0 group-hover:opacity-100 transition-all" />
              </button>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Or enter Room ID..."
                  className="flex-1 px-4 py-3 bg-zinc-950/50 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white placeholder-zinc-600 transition-all"
                />
                <button
                  onClick={handleJoinRoom}
                  className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl border border-white/5 transition-all active:scale-[0.98]"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-zinc-600 text-sm">
          Supports Spotify & YouTube Links
        </p>
      </div>
    </div>
  );
}
