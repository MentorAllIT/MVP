import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import Airtable from "airtable";

const { JWT_SECRET, AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_USERS_TABLE } = process.env;

export async function GET(req: NextRequest) {
  if (!JWT_SECRET || !AIRTABLE_USERS_TABLE) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const token = req.cookies.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    console.log(payload);
    
    // Fetch user's name from database
    let userName = null;
    if (payload.uid) {
      try {
        console.log("Fetching user name for UID:", payload.uid);
        console.log("Using table:", AIRTABLE_USERS_TABLE);
        console.log("Using base ID:", AIRTABLE_BASE_ID);
        
        const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID!);
        const records = await base(AIRTABLE_USERS_TABLE!)
          .select({
            filterByFormula: `{UserID}='${payload.uid}'`,
            fields: ['UserID', 'Name'],
            maxRecords: 1
          })
          .firstPage();
        
        console.log("Records found:", records.length);
        
        if (records.length > 0) {
          const userRecord = records[0];
          console.log("User record found:", userRecord.fields);
          console.log("All available fields:", Object.keys(userRecord.fields));
          userName = userRecord.fields.Name || null;
          console.log("Extracted userName:", userName);
        } else {
          console.log("No user record found for UID:", payload.uid);
        }
      } catch (dbError) {
        console.error("Failed to fetch user name:", dbError);
        // Continue without name if database fetch fails
      }
    }
    
    console.log("Final response payload:", {
      ok: true,
      uid: payload.uid,
      role: payload.role,
      email: payload.sub,
      profile: payload.profile,
      name: userName,
    });

    return NextResponse.json({
      ok: true,
      uid: payload.uid,
      role: payload.role,
      email: payload.sub,
      profile: payload.profile,
      name: userName,
    });
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
}
