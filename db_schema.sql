-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- User Table
create table if not exists "User" (
  "id" text primary key default uuid_generate_v4(),
  "name" text,
  "email" text unique,
  "password" text,
  "emailVerified" timestamp(3),
  "image" text,
  "createdAt" timestamp(3) default now(),
  "updatedAt" timestamp(3) default now()
);

-- Account Table (NextAuth)
create table if not exists "Account" (
  "id" text primary key default uuid_generate_v4(),
  "userId" text not null references "User"("id") on delete cascade,
  "type" text not null,
  "provider" text not null,
  "providerAccountId" text not null,
  "refresh_token" text,
  "access_token" text,
  "expires_at" integer,
  "token_type" text,
  "scope" text,
  "id_token" text,
  "session_state" text,
  unique("provider", "providerAccountId")
);

-- Session Table (NextAuth)
create table if not exists "Session" (
  "id" text primary key default uuid_generate_v4(),
  "sessionToken" text unique not null,
  "userId" text not null references "User"("id") on delete cascade,
  "expires" timestamp(3) not null
);

-- VerificationToken Table (NextAuth)
create table if not exists "VerificationToken" (
  "identifier" text not null,
  "token" text unique not null,
  "expires" timestamp(3) not null,
  unique("identifier", "token")
);

-- Favorite Table
create table if not exists "Favorite" (
  "id" text primary key default uuid_generate_v4(),
  "userId" text not null references "User"("id") on delete cascade,
  "songId" text not null,
  "platform" text not null,
  "title" text not null,
  "artist" text not null,
  "thumbnail" text not null,
  "createdAt" timestamp(3) default now(),
  unique("userId", "songId")
);

-- PlayHistory Table
create table if not exists "PlayHistory" (
  "id" text primary key default uuid_generate_v4(),
  "roomId" text not null,
  "songId" text not null,
  "platform" text not null,
  "title" text not null,
  "artist" text not null,
  "thumbnail" text not null,
  "playedBy" text,
  "playedAt" timestamp(3) default now()
);

-- Message Table (Chat)
create table if not exists "Message" (
  "id" text primary key default uuid_generate_v4(),
  "roomId" text not null,
  "userId" text not null,
  "text" text not null,
  "timestamp" timestamp(3) default now(),
  "edited" boolean default false,
  "replyToId" text,
  "songCard" jsonb,
  "reactions" jsonb
);

-- Add indexes for better performance
create index if not exists "Account_userId_idx" on "Account"("userId");
create index if not exists "Session_userId_idx" on "Session"("userId");
create index if not exists "PlayHistory_roomId_idx" on "PlayHistory"("roomId");
create index if not exists "Message_roomId_idx" on "Message"("roomId");
