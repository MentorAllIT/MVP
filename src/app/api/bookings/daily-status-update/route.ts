import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

export const dynamic = "force-dynamic";

const getBase = () => {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
  return AIRTABLE_API_KEY && AIRTABLE_BASE_ID
    ? new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID)
    : null;
};

const esc = (s: string) => String(s).replace(/'/g, "\\'");

export async function POST(request: NextRequest) {
  try {
    // Check if this is a Vercel cron request or manual trigger
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const cronSecret = process.env.CRON_SECRET || 'default-secret';
    
    // Allow Vercel cron requests (they have specific user agent)
    const isVercelCron = userAgent?.includes('Vercel-Cron');
    const isAuthorized = authHeader === `Bearer ${cronSecret}`;
    
    if (!isVercelCron && !isAuthorized) {
      return NextResponse.json({ 
        error: "Unauthorized - This endpoint is for automated cron jobs only" 
      }, { status: 401 });
    }

    console.log(`Daily status update triggered by: ${isVercelCron ? 'Vercel Cron' : 'Manual trigger'}`);

    const base = getBase();
    const BOOKINGS = process.env.AIRTABLE_BOOKINGS_TABLE;
    
    if (!base || !BOOKINGS) {
      return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
    }

    // Calculate yesterday's date range in AEST - simple and direct
    const now = new Date();
    
    // Get today's date in AEST
    const todayAEST = new Date(now.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
    
    // Calculate yesterday in AEST
    const yesterdayAEST = new Date(todayAEST);
    yesterdayAEST.setDate(yesterdayAEST.getDate() - 1);
    
    // Set to start of day (00:00:00) and end of day (23:59:59) in AEST
    const yesterdayStart = new Date(yesterdayAEST);
    yesterdayStart.setHours(0, 0, 0, 0);
    
    const yesterdayEnd = new Date(yesterdayAEST);
    yesterdayEnd.setHours(23, 59, 59, 999);

    console.log(`Daily status update running at ${now.toISOString()} UTC`);
    console.log(`Today in AEST: ${todayAEST.toISOString()}`);
    console.log(`Yesterday in AEST: ${yesterdayAEST.toISOString().split('T')[0]}`);
    console.log(`Looking for meetings from ${yesterdayStart.toISOString()} to ${yesterdayEnd.toISOString()} (AEST)`);

    const filterFormula = `AND(
      IS_AFTER({MeetingTime}, DATETIME_PARSE('${yesterdayStart.toISOString()}', 'YYYY-MM-DDTHH:mm:ss.SSS[Z]')),
      IS_BEFORE({MeetingTime}, DATETIME_PARSE('${yesterdayEnd.toISOString()}', 'YYYY-MM-DDTHH:mm:ss.SSS[Z]')),
      OR(
        {BookingStatus} = 'Confirmed',
        {BookingStatus} = 'Pending',
        {BookingStatus} = 'Rescheduled'
      )
    )`;

    const bookingsToUpdate = await base(BOOKINGS)
      .select({
        filterByFormula: filterFormula,
        fields: ['BookingID', 'BookingStatus', 'MeetingTime', 'BookerUsername', 'InvitedUsername']
      })
      .all();

    console.log(`Found ${bookingsToUpdate.length} bookings to mark as completed`);

    if (bookingsToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No bookings to update",
        updatedCount: 0,
        timestamp: now.toISOString()
      });
    }

    // Update all found bookings to "Completed" status
    const updates = bookingsToUpdate.map(record => ({
      id: record.id,
      fields: {
        SessionStatus: "Completed"
      }
    }));

    // Batch update in groups of 10 (Airtable limit)
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < updates.length; i += batchSize) {
      batches.push(updates.slice(i, i + batchSize));
    }

    let totalUpdated = 0;
    const updatedBookings: Array<{
      bookingId: string;
      meetingTime: string;
      booker: string;
      invitee: string;
    }> = [];

    for (const batch of batches) {
      const batchResult = await base(BOOKINGS).update(batch);
      totalUpdated += batchResult.length;
      
      // Collect details of updated bookings for logging
      batchResult.forEach(record => {
        const originalRecord = bookingsToUpdate.find(b => b.id === record.id);
        updatedBookings.push({
          bookingId: String(originalRecord?.fields?.BookingID || ''),
          meetingTime: String(originalRecord?.fields?.MeetingTime || ''),
          booker: String(originalRecord?.fields?.BookerUsername || ''),
          invitee: String(originalRecord?.fields?.InvitedUsername || '')
        });
      });
    }

    console.log(`Successfully updated ${totalUpdated} bookings to Completed status`);
    updatedBookings.forEach(booking => {
      console.log(`- Booking ${booking.bookingId}: ${booking.booker} → ${booking.invitee} at ${booking.meetingTime}`);
    });

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${totalUpdated} bookings to Completed status`,
      updatedCount: totalUpdated,
      updatedBookings: updatedBookings,
      timestamp: now.toISOString(),
      dateRange: {
        from: yesterdayStart.toISOString(),
        to: yesterdayEnd.toISOString()
      }
    });

  } catch (error: any) {
    console.error("Daily status update error:", error);
    return NextResponse.json(
      { 
        error: "Failed to update booking statuses", 
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Also allow GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}
