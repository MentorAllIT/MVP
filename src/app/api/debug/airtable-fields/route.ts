import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

export const dynamic = "force-dynamic";

const {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_MENTEE_PREFERENCES_TABLE,
} = process.env;

export async function GET(request: NextRequest) {
  try {
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_MENTEE_PREFERENCES_TABLE) {
      return NextResponse.json(
        { error: "Missing Airtable configuration" },
        { status: 500 }
      );
    }

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    
    // Get a sample record to see available fields
    const records = await base(AIRTABLE_MENTEE_PREFERENCES_TABLE).select({
      maxRecords: 1
    }).firstPage();

    if (records.length === 0) {
      return NextResponse.json({
        message: "No records found in table",
        availableFields: []
      });
    }

    const record = records[0];
    const availableFields = Object.keys(record.fields);
    
    return NextResponse.json({
      message: "Table structure inspected",
      availableFields,
      sampleRecord: record.fields
    });

  } catch (error) {
    console.error("Error inspecting Airtable fields:", error);
    return NextResponse.json(
      { error: "Failed to inspect table structure" },
      { status: 500 }
    );
  }
}
