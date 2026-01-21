
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req) {
    try {
        const body = await req.json();
        console.log("DEBUG: POST /api/history received:", body);
        const { roomId, songId, platform, title, artist, thumbnail, playedBy } = body;

        if (!roomId || !songId || !title) {
            console.error("DEBUG: Missing fields in history request");
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const entry = await prisma.playHistory.create({
            data: {
                roomId,
                songId,
                platform,
                title,
                artist,
                thumbnail,
                playedBy
            }
        });

        return NextResponse.json(entry, { status: 201 });
    } catch (error) {
        console.error("Error creating history entry:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const roomId = searchParams.get("roomId");

        if (!roomId) {
            return NextResponse.json({ error: "roomId is required" }, { status: 400 });
        }

        const history = await prisma.playHistory.findMany({
            where: { roomId },
            orderBy: { playedAt: 'desc' },
            take: 50
        });

        return NextResponse.json(history);
    } catch (error) {
        console.error("Error fetching history:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
