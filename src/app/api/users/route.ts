import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

// Environment variables guard
const { 
  AIRTABLE_API_KEY, 
  AIRTABLE_BASE_ID, 
  AIRTABLE_USERS_TABLE 
} = process.env;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_USERS_TABLE) {
  throw new Error("Missing Airtable environment variables");
}

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
const USERS_TABLE = AIRTABLE_USERS_TABLE;

export async function GET(req: NextRequest) {
  try {
    // Get all users from Airtable
    const records = await base(USERS_TABLE)
      .select({
        fields: ['UserID', 'Name', 'Email', 'Role'], // Only fetch needed fields
        sort: [{ field: 'Name', direction: 'asc' }] // Sort by name
      })
      .all(); // Get all records (use .all() instead of .firstPage() to get all users)

    const users = records.map(record => ({
      UserID: record.fields.UserID,
      Name: record.fields.Name,
      Email: record.fields.Email,
      Role: record.fields.Role,
    }));

    return NextResponse.json({
      success: true,
      users: users,
      count: users.length
    });

  } catch (err: any) {
    console.error("Users retrieval error:", err);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
