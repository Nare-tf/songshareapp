import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
    try {
        const { email, password, username } = await req.json();

        if (!email || !password || !username) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Check availability
        const { data: existingUser } = await supabase
            .from('User')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const { data: user, error } = await supabase
            .from('User')
            .insert({
                name: username,
                email,
                password: hashedPassword,
                image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ message: "User created successfully", user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
    } catch (error) {
        console.error("Registration Error", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
