const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for MVP, restrict in prod
        methods: ["GET", "POST"]
    }
});

const { fetchMetadata } = require('./services/metadata');
const { searchYoutube } = require('./services/search');

// Basic health check
app.get('/', (req, res) => {
    res.send('Music Share Chat Server is running');
});

app.post('/api/metadata', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const metadata = await fetchMetadata(url);
    if (!metadata) return res.status(422).json({ error: 'Could not fetch metadata or unsupported platform' });


    res.json(metadata);
});

app.post('/api/search', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    const results = await searchYoutube(query);
    res.json(results);
});

const rooms = {}; // { roomId: { queue: [], currentSong: null, messages: [] } }
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const logHistory = async (roomId, song) => {
    try {
        const response = await axios.post(`${FRONTEND_URL}/api/history`, {
            roomId,
            songId: song.songId || song.id,
            platform: song.platform,
            title: song.title,
            artist: song.artist,
            thumbnail: song.thumbnail,
            playedBy: song.user || song.addedBy || "Unknown"
        });
        return response.data;
    } catch (err) {
        console.error("Failed to log history:", err.message);
        return null;
    }
};

// Socket.IO Events
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', async (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);

        if (!rooms[roomId]) {
            rooms[roomId] = { queue: [], currentSong: null, messages: [] };
        }

        // Load messages from DB if room is empty or just refresh cache
        try {
            const dbMessages = await prisma.message.findMany({
                where: { roomId },
                orderBy: { timestamp: 'asc' },
                take: 50
            });

            if (dbMessages && dbMessages.length > 0) {
                rooms[roomId].messages = dbMessages.map(m => ({
                    id: m.id,
                    roomId: m.roomId,
                    user: m.userId,
                    text: m.text,
                    timestamp: m.timestamp.toISOString(),
                    edited: m.edited,
                    reactions: m.reactions || {},
                    songCard: m.songCard || undefined,
                    replyTo: m.replyToId ? { id: m.replyToId } : null // Simplified reply logic
                }));
            }
        } catch (e) {
            console.error("Error loading messages:", e);
        }

        // Send current state to new user
        if (rooms[roomId]) {
            console.log(`DEBUG: Sending state to new user. Queue: ${rooms[roomId].queue?.length}, Messages: ${rooms[roomId].messages?.length}`);
            socket.emit('sync_state_updated', rooms[roomId].currentSong);
            socket.emit('queue_updated', rooms[roomId].queue || []);
            socket.emit('receive_message_history', rooms[roomId].messages || []);
        }
    });

    socket.on('send_message', async (data) => {
        // data: { id, roomId, user, text, timestamp, songCard?, replyTo? }

        // Save to DB
        try {
            const savedMsg = await prisma.message.create({
                data: {
                    roomId: data.roomId,
                    userId: data.user,
                    text: data.text,
                    timestamp: new Date(), // Set server time
                    replyToId: data.replyTo ? data.replyTo.id : null,
                    songCard: data.songCard || undefined,
                    reactions: {}
                }
            });
            // Update data with authoritative ID and timestamp
            data.id = savedMsg.id;
            data.timestamp = savedMsg.timestamp.toISOString();
            data.reactions = {};
        } catch (e) {
            console.error("Failed to save message:", e);
            if (!data.id) data.id = Date.now().toString(); // Fallback
        }

        if (rooms[data.roomId]) {
            if (!rooms[data.roomId].messages) rooms[data.roomId].messages = [];
            rooms[data.roomId].messages.push(data);
            // Limit history to last 50 messages to save memory
            if (rooms[data.roomId].messages.length > 50) rooms[data.roomId].messages.shift();
        }

        io.to(data.roomId).emit('receive_message', data);
    });

    socket.on('toggle_reaction', async (data) => {
        const { roomId, messageId, emoji, user } = data;
        io.to(roomId).emit('reaction_toggled', data); // Optimistic update

        // Update DB
        try {
            const msg = await prisma.message.findUnique({ where: { id: messageId } });
            if (msg) {
                let reactions = msg.reactions || {};
                if (!reactions[emoji]) reactions[emoji] = [];

                if (reactions[emoji].includes(user)) {
                    reactions[emoji] = reactions[emoji].filter(u => u !== user);
                    if (reactions[emoji].length === 0) delete reactions[emoji];
                } else {
                    reactions[emoji].push(user);
                }

                await prisma.message.update({
                    where: { id: messageId },
                    data: { reactions }
                });
            }
        } catch (e) {
            console.error("Reaction update failed:", e);
        }
    });

    socket.on('edit_message', async (data) => {
        io.to(data.roomId).emit('message_edited', data);
        try {
            await prisma.message.update({
                where: { id: data.messageId },
                data: { text: data.newText, edited: true }
            });
        } catch (e) {
            console.error("Edit update failed:", e);
        }
    });

    socket.on('sync_update', async (data) => {
        // data: { roomId, songId, platform, startTime, isPlaying, user }
        const { roomId, songId } = data;

        if (!rooms[roomId]) rooms[roomId] = { queue: [], currentSong: null };

        const current = rooms[roomId].currentSong;
        const isNewSong = !current || current.songId !== songId;

        rooms[roomId].currentSong = data;

        // Broadcast to EVERYONE in the room (including sender) to ensure consistent state
        io.to(roomId).emit('sync_state_updated', data);

        if (isNewSong) {
            const entry = await logHistory(roomId, data);
            if (entry) {
                io.to(roomId).emit("history_entry", entry);
            }
        }
    });

    // Queue Events
    socket.on('queue_add', ({ roomId, song }) => {
        if (!rooms[roomId]) rooms[roomId] = { queue: [], currentSong: null };
        rooms[roomId].queue.push(song);
        io.to(roomId).emit('queue_updated', rooms[roomId].queue);
    });

    socket.on('queue_remove', ({ roomId, index }) => {
        if (rooms[roomId] && rooms[roomId].queue) {
            rooms[roomId].queue.splice(index, 1);
            io.to(roomId).emit('queue_updated', rooms[roomId].queue);
        }
    });

    socket.on('queue_reorder', ({ roomId, newQueue }) => {
        if (rooms[roomId]) {
            rooms[roomId].queue = newQueue;
            // Broadcast to everyone so their UI updates
            socket.to(roomId).emit('queue_updated', newQueue);
        }
    });

    socket.on('play_next', async ({ roomId, currentSongId }) => {
        console.log(`DEBUG: play_next request for room ${roomId}, client thinks: ${currentSongId}, server has: ${rooms[roomId]?.currentSong?.songId}`);

        if (!rooms[roomId]) return;

        // Race condition check
        if (currentSongId && rooms[roomId].currentSong && rooms[roomId].currentSong.songId !== currentSongId) {
            console.log("Skipping play_next request - synchronization mismatch.");
            return;
        }

        if (rooms[roomId].queue && rooms[roomId].queue.length > 0) {
            const nextSong = rooms[roomId].queue.shift();

            const syncData = {
                roomId,
                songId: nextSong.id || nextSong.songId,
                platform: nextSong.platform,
                title: nextSong.title,
                artist: nextSong.artist,
                thumbnail: nextSong.thumbnail,
                startTime: Date.now(),
                isPaused: false,
                user: nextSong.addedBy || 'Queue',
                duration: nextSong.duration
            };

            rooms[roomId].currentSong = syncData;

            io.to(roomId).emit('sync_state_updated', syncData);
            io.to(roomId).emit('queue_updated', rooms[roomId].queue);

            const entry = await logHistory(roomId, syncData);
            if (entry) {
                io.to(roomId).emit("history_entry", entry);
            }
        } else {
            console.log(`DEBUG: Queue empty for room ${roomId}, stopping playback.`);
            rooms[roomId].currentSong = null;
            io.to(roomId).emit('sync_stopped');
        }
    });

    socket.on('stop_sync', (roomId) => {
        if (rooms[roomId]) rooms[roomId].currentSong = null;
        io.to(roomId).emit('sync_stopped');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
