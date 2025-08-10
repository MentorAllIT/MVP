import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid";

// env guard
const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_USERS_TABLE } = process.env;
const hasAirtableConfig = AIRTABLE_API_KEY && AIRTABLE_BASE_ID && AIRTABLE_USERS_TABLE;

let base: any = null;
let TABLE: string = '';
const SALT = 12;

if (hasAirtableConfig) {
  base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
  TABLE = AIRTABLE_USERS_TABLE;
}

// route handler
export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role } = await req.json();

    if (!name || !email || !password || !role) {
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
    const safeEmail = email.replace(/'/g, "\\'");
    const existing  = await base(TABLE)
      .select({ filterByFormula: `{Email} = '${safeEmail}'`, maxRecords: 1 })
      .firstPage();
    if (existing.length) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    // Hash password
    const hash   = await bcrypt.hash(password, SALT);
    const userId = nanoid(10);

    // Create record
    await base(TABLE).create([
      {
        fields: {
          UserID:   userId,
          Name:     name,
          Email:    email,
          Password: hash,
          Role:     role,
        },
      },
    ]);

    return NextResponse.json({ id: userId }, { status: 201 });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
