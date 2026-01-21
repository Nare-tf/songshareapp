import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        const { email, password, username } = await req.json();

        if (!email || !password || !username) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: username,
            },
        });

        return NextResponse.json({ message: "User created successfully", user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
    } catch (error) {
        console.error("Registration Error", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
