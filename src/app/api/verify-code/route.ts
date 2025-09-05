import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  throw new Error("Missing Airtable env vars");
}

const APPROVED_TABLE =
  process.env.AIRTABLE_APPROVED_USERS_TABLE as string;

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Missing e-mail or code" },
        { status: 400 }
      );
    }

    const safeEmail = String(email).trim().toLowerCase().replace(/'/g, "\\'");
    const safeCodeL = String(code).trim().toLowerCase().replace(/'/g, "\\'");

    // const matches = await base(APPROVED_TABLE)
    //   .select({
    //     filterByFormula: `AND({Email}='${safeEmail}', LOWER({Code})='${safeCodeL}')`,
    //     maxRecords: 1,
    //   })
    //   .firstPage();

    // if (!matches.length) {
    //   return NextResponse.json(
    //     { error: "Email and code do not match" },
    //     { status: 404 }
    //   );
    // }

    // Temporary hardcoded check
    if (safeCodeL !== "ment4u") {
      return NextResponse.json(
        { error: "Email and code do not match" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Verify code error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}