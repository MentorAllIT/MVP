import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const { JWT_SECRET } = process.env;

export async function GET(req: NextRequest) {
  if (!JWT_SECRET) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const token = req.cookies.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    console.log(payload)
    return NextResponse.json({
      ok: true,
      uid: payload.uid,
      role: payload.role,
      email: payload.sub,
      profile: payload.profile,
    });
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
}
