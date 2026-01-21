import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { songId, platform, title, artist, thumbnail } = await req.json();

        // Get User ID from email (could optimize by putting ID in session)
        const { data: user } = await supabase.from('User').select('id').eq('email', session.user.email).single();

        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const { data: favorite, error } = await supabase
            .from('Favorite')
            .upsert({
                userId: user.id,
                songId,
                platform,
                title,
                artist,
                thumbnail
            }, { onConflict: 'userId, songId' })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(favorite);
    } catch (error) {
        console.error("Error adding favorite:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Get User ID
        const { data: user } = await supabase.from('User').select('id').eq('email', session.user.email).single();
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const { data: favorites, error } = await supabase
            .from('Favorite')
            .select('*')
            .eq('userId', user.id)
            .order('createdAt', { ascending: false });

        if (error) throw error;

        return NextResponse.json(favorites);
    } catch (error) {
        console.error("Error fetching favorites:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const songId = searchParams.get("songId");

        const { data: user } = await supabase.from('User').select('id').eq('email', session.user.email).single();
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const { error } = await supabase
            .from('Favorite')
            .delete()
            .eq('userId', user.id)
            .eq('songId', songId);

        if (error) throw error;

        return NextResponse.json({ message: "Removed" });
    } catch (error) {
        console.error("Error removing favorite:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
