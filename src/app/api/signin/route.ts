import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Airtable
const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_USERS_TABLE, AIRTABLE_PROFILES_TABLE, JWT_SECRET } = process.env;
const hasAirtableConfig = AIRTABLE_API_KEY && AIRTABLE_BASE_ID && AIRTABLE_USERS_TABLE && AIRTABLE_PROFILES_TABLE && JWT_SECRET;

let base: any = null;
let USERS: string = '';
let PROFILES: string = '';
let JWT_SECRET_VALUE: string = '';

if (hasAirtableConfig) {
  base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
  USERS = AIRTABLE_USERS_TABLE;
  PROFILES = AIRTABLE_PROFILES_TABLE;
  JWT_SECRET_VALUE = JWT_SECRET;
}

const esc = (s: string) => s.replace(/'/g, "\\'");

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    // Check if Airtable is configured
    if (!hasAirtableConfig) {
      return NextResponse.json(
        { 
          error: "Backend not configured. This is a demo version. Please contact the administrator to set up the database.",
          demo: true 
        },
        { status: 503 }
      );
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
      JWT_SECRET_VALUE,
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
