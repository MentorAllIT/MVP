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

    // Get date range (same logic as cron job)
    const now = new Date();
    const todayAEST = new Date(now.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
    const yesterdayAEST = new Date(todayAEST);
    yesterdayAEST.setDate(yesterdayAEST.getDate() - 1);
    
    const yesterdayStart = new Date(yesterdayAEST);
    yesterdayStart.setHours(0, 0, 0, 0);
    
    const yesterdayEnd = new Date(yesterdayAEST);
    yesterdayEnd.setHours(23, 59, 59, 999);

    // Get all bookings from yesterday (regardless of status)
    const allYesterdayBookings = await base(BOOKINGS)
      .select({
        filterByFormula: `AND(
          IS_AFTER({MeetingTime}, DATETIME_PARSE('${yesterdayStart.toISOString()}', 'YYYY-MM-DDTHH:mm:ss.SSS[Z]')),
          IS_BEFORE({MeetingTime}, DATETIME_PARSE('${yesterdayEnd.toISOString()}', 'YYYY-MM-DDTHH:mm:ss.SSS[Z]'))
        )`,
        fields: ['BookingID', 'BookingStatus', 'SessionStatus', 'MeetingTime', 'BookerUsername', 'InvitedUsername']
      })
      .all();

    // Get only confirmed bookings (what the cron job targets)
    const confirmedBookings = await base(BOOKINGS)
      .select({
        filterByFormula: `AND(
          IS_AFTER({MeetingTime}, DATETIME_PARSE('${yesterdayStart.toISOString()}', 'YYYY-MM-DDTHH:mm:ss.SSS[Z]')),
          IS_BEFORE({MeetingTime}, DATETIME_PARSE('${yesterdayEnd.toISOString()}', 'YYYY-MM-DDTHH:mm:ss.SSS[Z]')),
          {BookingStatus} = 'Confirmed'
        )`,
        fields: ['BookingID', 'BookingStatus', 'SessionStatus', 'MeetingTime', 'BookerUsername', 'InvitedUsername']
      })
      .all();

    return NextResponse.json({
      dateRange: {
        from: yesterdayStart.toISOString(),
        to: yesterdayEnd.toISOString(),
        fromFormatted: yesterdayStart.toLocaleString("en-AU", { timeZone: "Australia/Sydney" }),
        toFormatted: yesterdayEnd.toLocaleString("en-AU", { timeZone: "Australia/Sydney" })
      },
      allYesterdayBookings: allYesterdayBookings.map(record => ({
        id: record.id,
        bookingId: record.fields.BookingID,
        bookingStatus: record.fields.BookingStatus,
        sessionStatus: record.fields.SessionStatus,
        meetingTime: record.fields.MeetingTime,
        meetingTimeFormatted: new Date(String(record.fields.MeetingTime)).toLocaleString("en-AU", { 
          timeZone: "Australia/Sydney" 
        }),
        booker: record.fields.BookerUsername,
        invitee: record.fields.InvitedUsername
      })),
      confirmedBookingsOnly: confirmedBookings.map(record => ({
        id: record.id,
        bookingId: record.fields.BookingID,
        bookingStatus: record.fields.BookingStatus,
        sessionStatus: record.fields.SessionStatus,
        meetingTime: record.fields.MeetingTime,
        meetingTimeFormatted: new Date(String(record.fields.MeetingTime)).toLocaleString("en-AU", { 
          timeZone: "Australia/Sydney" 
        }),
        booker: record.fields.BookerUsername,
        invitee: record.fields.InvitedUsername
      })),
      counts: {
        totalYesterdayBookings: allYesterdayBookings.length,
        confirmedYesterdayBookings: confirmedBookings.length
      },
      explanation: {
        message: "This shows all bookings from yesterday and which ones would be updated by the cron job",
        cronJobTargets: "Only bookings with BookingStatus = 'Confirmed' will be updated to SessionStatus = 'Completed'"
      }
    });

  } catch (error: any) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { 
        error: "Failed to debug bookings", 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
