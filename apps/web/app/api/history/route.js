import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
    try {
        const body = await req.json();
        console.log("DEBUG: POST /api/history received:", body);
        const { roomId, songId, platform, title, artist, thumbnail, playedBy } = body;

        if (!roomId || !songId || !title) {
            console.error("DEBUG: Missing fields in history request");
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const { data: entry, error } = await supabase
            .from('PlayHistory')
            .insert({
                roomId,
                songId,
                platform,
                title,
                artist,
                thumbnail,
                playedBy
            })
            .select() // Return inserted data
            .single();

        if (error) throw error;

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

        const { data: history, error } = await supabase
            .from('PlayHistory')
            .select('*')
            .eq('roomId', roomId)
            .order('playedAt', { ascending: false })
            .limit(50);

        if (error) throw error;

        return NextResponse.json(history);
    } catch (error) {
        console.error("Error fetching history:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
