import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID!);

const USERS    = process.env.AIRTABLE_USERS_TABLE!;
const PROFILES = process.env.AIRTABLE_PROFILES_TABLE!;
const JWT_SECRET = process.env.JWT_SECRET!;
const esc = (s: string) => s.replace(/'/g, "\\'");

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    const [userRec] = await base(USERS)
      .select({
        filterByFormula: `AND(LOWER({Email}) = '${esc(email.toLowerCase())}')`,
        maxRecords: 1,
      })
      .firstPage();

    if (!userRec) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const { Password, Role, UserID } = userRec.fields as {
      Password: string;
      Role:     string;
      UserID:   string;
    };

    // Password check
    if (!(await bcrypt.compare(password, Password))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Does a Profiles row exist for this uid?
    const [profileRec] = await base(PROFILES)
      .select({ filterByFormula: `{UserID} = '${esc(UserID)}'`, maxRecords: 1 })
      .firstPage();

    const hasProfile = Boolean(profileRec);

    // JWT + cookie
    const token = jwt.sign(
      { sub: email.toLowerCase(), role: Role, uid: UserID, profile: hasProfile },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const res = NextResponse.json({ ok: true, role: Role, uid: UserID, profile: hasProfile });
    res.cookies.set("session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err) {
    console.error("signin route:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
