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
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');

    if (uid) {
      // Get specific user by UID
      const records = await base(USERS_TABLE)
        .select({
          filterByFormula: `{UserID}='${uid}'`,
          fields: ['UserID', 'Name', 'Email', 'Role', 'CreatedAt'],
          maxRecords: 1
        })
        .firstPage();

      if (records.length > 0) {
        const user = records[0];
        return NextResponse.json({
          success: true,
          uid: user.fields.UserID,
          email: user.fields.Email,
          role: user.fields.Role,
          name: user.fields.Name,
          createdAt: user.fields.CreatedAt
        });
      } else {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
    } else {
      // Get all users (for admin purposes)
      const records = await base(USERS_TABLE)
        .select({
          fields: ['UserID', 'Name', 'Email', 'Role'],
          sort: [{ field: 'Name', direction: 'asc' }]
        })
        .all();

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
    }

  } catch (err: any) {
    console.error("Users retrieval error:", err);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}