import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

export const dynamic = "force-dynamic";

const {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_MENTEE_PREFERENCES_TABLE,
  JWT_SECRET,
} = process.env;

const ready = AIRTABLE_API_KEY && AIRTABLE_BASE_ID && AIRTABLE_MENTEE_PREFERENCES_TABLE;

export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const envStatus = {
      AIRTABLE_API_KEY: !!AIRTABLE_API_KEY,
      AIRTABLE_BASE_ID: !!AIRTABLE_BASE_ID,
      AIRTABLE_MENTEE_PREFERENCES_TABLE: !!AIRTABLE_MENTEE_PREFERENCES_TABLE,
      JWT_SECRET: !!JWT_SECRET,
      ready: ready
    };

    console.log("Environment check:", envStatus);

    if (!ready) {
      return NextResponse.json({
        error: "Missing environment variables",
        envStatus,
        message: "Backend not configured - missing Airtable credentials"
      }, { status: 503 });
    }

    // Test Airtable connection
    let airtableTest = null;
    try {
      const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID!);
      
      // Try to fetch one record from the table
      const testRecords = await base(AIRTABLE_MENTEE_PREFERENCES_TABLE!).select({
        maxRecords: 1,
      }).firstPage();
      
      airtableTest = {
        success: true,
        recordsFound: testRecords.length,
        tableName: AIRTABLE_MENTEE_PREFERENCES_TABLE
      };
    } catch (airtableError) {
      airtableTest = {
        success: false,
        error: airtableError instanceof Error ? airtableError.message : 'Unknown error',
        tableName: AIRTABLE_MENTEE_PREFERENCES_TABLE
      };
    }

    return NextResponse.json({
      status: "success",
      envStatus,
      airtableTest,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Debug endpoint error:", error);
    
    return NextResponse.json({
      error: "Debug endpoint failed",
      message: error instanceof Error ? error.message : 'Unknown error',
      envStatus: {
        AIRTABLE_API_KEY: !!AIRTABLE_API_KEY,
        AIRTABLE_BASE_ID: !!AIRTABLE_BASE_ID,
        AIRTABLE_MENTEE_PREFERENCES_TABLE: !!AIRTABLE_MENTEE_PREFERENCES_TABLE,
        JWT_SECRET: !!JWT_SECRET,
        ready: ready
      }
    }, { status: 500 });
  }
}
