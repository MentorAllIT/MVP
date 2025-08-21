import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

export const dynamic = "force-dynamic";

const getBase = () => {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
  return AIRTABLE_API_KEY && AIRTABLE_BASE_ID
    ? new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID)
    : null;
};

export async function GET(request: NextRequest) {
  try {
    const base = getBase();
    const BOOKINGS = process.env.AIRTABLE_BOOKINGS_TABLE;
    
    if (!base || !BOOKINGS) {
      return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
    }

    // Get a few records to see the actual field structure
    const records = await base(BOOKINGS)
      .select({
        maxRecords: 3,
        fields: ['BookingID', 'BookingStatus', 'SessionStatus', 'MeetingTime']
      })
      .firstPage();

    // Get field information by examining the records
    const fieldInfo: any = {};
    
    if (records.length > 0) {
      const firstRecord = records[0];
      Object.keys(firstRecord.fields).forEach(fieldName => {
        fieldInfo[fieldName] = {
          value: firstRecord.fields[fieldName],
          type: typeof firstRecord.fields[fieldName]
        };
      });
    }

    return NextResponse.json({
      success: true,
      tableInfo: {
        tableName: BOOKINGS,
        recordCount: records.length,
        sampleFields: fieldInfo,
        allFieldsFromFirstRecord: records[0]?.fields || {}
      },
      sampleRecords: records.map(record => ({
        id: record.id,
        fields: record.fields
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { 
        error: "Failed to debug table structure", 
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
