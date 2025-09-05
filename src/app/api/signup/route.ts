import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import jwt from "jsonwebtoken";

// env guard
const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_USERS_TABLE, AIRTABLE_APPROVED_USERS_TABLE, JWT_SECRET } = process.env;
const hasAirtableConfig = AIRTABLE_API_KEY && AIRTABLE_BASE_ID && AIRTABLE_USERS_TABLE && AIRTABLE_APPROVED_USERS_TABLE && JWT_SECRET;

let base: any = null;
let TABLE: string = '';
let APPROVED_TABLE: string = '';
let JWT_SECRET_VALUE: string = '';
const SALT = 12;

if (hasAirtableConfig) {
  base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
  TABLE = AIRTABLE_USERS_TABLE;
  APPROVED_TABLE = AIRTABLE_APPROVED_USERS_TABLE;
  JWT_SECRET_VALUE = JWT_SECRET;
}

// route handler
export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role, code } = await req.json();

    if (!name || !email || !password || !role || !code) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
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

    // Duplicate e-mail check
    if (role !== "mentor" && role !== "mentee") {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    const safeEmail = String(email).trim().toLowerCase().replace(/'/g, "\\'");
    const safeCodeL = String(code).trim().toLowerCase().replace(/'/g, "\\'");

    // Duplicate e-mail check in Users table
    const existing = await base(TABLE)
      .select({ filterByFormula: `{Email}='${safeEmail}'`, maxRecords: 1 })
      .firstPage();
    if (existing.length) {
      const existingUser = existing[0];
      const existingRole = existingUser.fields.Role;
      
      // Check if user is trying to register for the same role
      if (existingRole === role) {
        return NextResponse.json({ 
          error: `This email is already registered as a ${role}. Please sign in instead.`,
          existingRole: role,
          canHaveBothRoles: false
        }, { status: 409 });
      } else {
        // User is trying to register for a different role - MVP restriction
        return NextResponse.json({ 
          error: `This email is already registered as a ${existingRole}.`,
          existingRole: existingRole,
          requestedRole: role,
          canHaveBothRoles: false,
          mvpRestriction: `For MVP version, we don't support same email for both roles. If you want another role, use another email.`
        }, { status: 409 });
      }
    }

    // NOTE: Approval-code flow: commented out for future
    // // Verify email
    // const approved = await base(APPROVED_TABLE)
    //   .select({
    //     filterByFormula: `AND({Email}='${safeEmail}', LOWER({Code})='${safeCodeL}')`,
    //     maxRecords: 1,
    //   })
    //   .firstPage();

    // if (!approved.length) {
    //   return NextResponse.json(
    //     { error: "Invalid approval code" },
    //     { status: 403 }
    //   );
    // }

    // Hash password & create user record
    const hash   = await bcrypt.hash(String(password), SALT);
    const userId = nanoid(10);

    // Create record
    await base(TABLE).create([
      {
        fields: {
          UserID:   userId,
          Name:     String(name),
          Email:    safeEmail,
          Password: hash,
          Role:     role,
        },
      },
    ]);

    const token = jwt.sign(
      { sub: safeEmail, role, uid: userId, profile: false }, // profile may be false until created
      JWT_SECRET!,
      { expiresIn: "7d" }
    );

    const res = NextResponse.json({ ok: true, uid: userId, role, profile: false }, { status: 201 });
    res.cookies.set("session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res


  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
