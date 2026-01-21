
# 🎶 Project: Real-Time Music Sharing Chat Rooms (Embed-First)

## 1. Core Vision

Build a web application where users can **share music links in real time** inside chat rooms.
When a Spotify or YouTube link is pasted, the app **automatically fetches metadata** and renders a **rich embedded song card** directly in the chat.
The app focuses on **vibes, context, and shared listening**, not file uploads or full music hosting.

---

## 2. Supported Platforms (v1)

* Spotify (embed / preview)
* YouTube (iframe embed)
* Fallback: normal clickable link

❌ No file uploads
❌ No self-hosted audio

---

## 3. User Flow (High Level)

### 3.1 Entry

* User opens site
* Chooses:

  * Join public room
  * Create room
* Username prompt (guest login, no password)

---

### 3.2 Sharing Music

1. User pastes a link into chat input
2. System detects supported music link
3. Backend fetches metadata
4. Chat displays a **song card** instead of raw URL

---

### 3.3 Listening

* User can:

  * Play embed normally (solo)
  * Join room sync (if active)

---

## 4. Feature Structure (MVP)

### 4.1 Rooms

* Public rooms only (v1)
* Room properties:

  * Name
  * Description / vibe
  * Current song (optional)
* One **host/DJ** per room (creator)

---

### 4.2 Chat System

* Real-time chat (WebSockets)
* Message types:

  * Text
  * Song share
* Messages contain:

  * Username
  * Timestamp
  * Inline song cards (if applicable)

---

### 4.3 Song Card (Critical Component)

Each shared song renders as a card containing:

* Album art / thumbnail
* Song title
* Artist
* Platform icon (Spotify / YouTube)
* Duration (if available)
* Buttons:

  * ▶ Play
  * 🎧 Play in Room (host only)

---

### 4.4 Auto-Fetch Metadata

Backend responsibilities:

* Detect platform from URL
* Extract track/video ID
* Fetch metadata using:

  * Spotify API / oEmbed
  * YouTube oEmbed / Data API
* Cache results to reduce API calls

---

## 5. Synced Play (Soft Sync – v1)

### 5.1 Design

* Sync **intent**, not audio frames
* Uses embedded players only
* Minor playback drift is acceptable

---

### 5.2 Room Playback State

Store per room:

```json
{
  "songId": "platform-specific-id",
  "platform": "spotify | youtube",
  "startedAt": timestamp,
  "paused": boolean
}
```

---

### 5.3 Sync Flow

* Host clicks **“Play in Room”**
* Server broadcasts:

  * Song ID
  * Start timestamp
* Clients:

  * Load embed
  * Seek to `(now - startedAt)`
  * Start playback

Late joiners:

* Auto-seek to current position

---

### 5.4 Controls

* Only host can:

  * Play / pause room music
* Others:

  * Join sync
  * Play solo
  * React

---

## 6. Reactions & Context

* Users can react to **song cards**
* Emoji reactions only (🔥 😭 🖤 🌙)
* Optional text when sharing (“why this song”)

---

## 7. Search (Explicitly Out of Scope v1)

* ❌ No in-app music search
* Users must paste external links
* Architecture must remain **link-based** even if search is added later

---

## 8. Tech Stack (Suggested)

* Frontend:

  * React / Next.js
  * Dark mode default
* Backend:

  * Node.js
  * WebSocket (Socket.IO)
* Database:

  * Supabase / Firebase
* APIs:

  * Spotify API (metadata only)
  * YouTube oEmbed / iframe

---

## 9. Non-Goals (Do NOT Build)

* No playlists
* No user following
* No file uploads
* No ads
* No recommendation algorithms
* No full authentication system

---

## 10. Success Criteria (v1)

* Sharing a music link instantly produces a rich embed
* Chat feels real-time and smooth
* Room music feels “shared” even without perfect sync
* UI is music-first, clean, and minimal

---

## 11. Future Extensions (Not for v1)

* Vote skip
* Song queue
* Ephemeral rooms
* User profiles
* Search inside app
* Weekly recap

---

## 12. Product Principle

> This app is a place to **share music taste with context**, not to host or replace streaming platforms.