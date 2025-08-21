import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: "API is working",
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    aestTime: new Date().toLocaleString("en-AU", { 
      timeZone: "Australia/Sydney",
      dateStyle: "full",
      timeStyle: "long"
    }),
    environment: {
      hasAirtableKey: !!process.env.AIRTABLE_API_KEY,
      hasBaseId: !!process.env.AIRTABLE_BASE_ID,
      hasBookingsTable: !!process.env.AIRTABLE_BOOKINGS_TABLE,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
    }
  });
}

export async function POST(request: NextRequest) {
  // This is a test endpoint to verify the daily update works
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    
    const response = await fetch(`${baseUrl}/api/bookings/daily-status-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'default-secret'}`
      }
    });
    
    const result = await response.json();
    
    return NextResponse.json({
      test: "Daily status update test",
      success: response.ok,
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    return NextResponse.json({
      test: "Daily status update test",
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
