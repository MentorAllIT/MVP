import { NextResponse } from "next/server";
import Airtable from "airtable";

export const dynamic = "force-dynamic";
const getBase = () => {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
  return AIRTABLE_API_KEY && AIRTABLE_BASE_ID
    ? new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID)
    : null;
};
const getBookingId = (req: Request) => {
  const m = new URL(req.url).pathname.match(/\/api\/booking\/([^/]+)\/ics$/);
  return m ? decodeURIComponent(m[1]) : "";
};

export async function GET(req: Request) {
  try {
    const base = getBase();
    const table = process.env.AIRTABLE_BOOKINGS_TABLE;

    if (!base || !table) {
      return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
    }

    const bookingId = getBookingId(req).trim();

    // Fetch booking details
    const bookings = await base(table)
      .select({
        filterByFormula: `{BookingID} = '${bookingId}'`,
        maxRecords: 1
      })
      .firstPage();

    if (bookings.length === 0) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    const booking = bookings[0].fields;
    
    // Parse meeting time (stored in UTC, will be converted to user's local timezone by calendar apps)
    const meetingTime = new Date(booking.MeetingTime as string);
    if (isNaN(meetingTime.getTime())) {
      return NextResponse.json(
        { error: "Invalid meeting time" },
        { status: 400 }
      );
    }

    // Calculate end time (1 hour after start)
    const endTime = new Date(meetingTime.getTime() + 60 * 60 * 1000);

    // Format dates for ICS (YYYYMMDDTHHMMSSZ) - UTC format is standard for ICS files
    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    // Format time for AEST display in description
    const formatAESTTime = (date: Date) => {
      return date.toLocaleString('en-AU', {
        timeZone: 'Australia/Sydney',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    };

    const startTimeICS = formatICSDate(meetingTime);
    const endTimeICS = formatICSDate(endTime);
    const createdTimeICS = formatICSDate(new Date());

    // Generate unique UID for the event
    const uid = `${booking.BookingID}@mentorall.com`;

    // Create meeting description with timezone information
    const description = [
      `Meeting between ${booking.BookerUsername} and ${booking.InvitedUsername}`,
      '',
      `Scheduled time (AEST): ${formatAESTTime(meetingTime)}`,
      '',
      booking.Notes ? `Notes: ${booking.Notes}` : '',
      '',
      'Powered by MentorAll'
    ].filter(line => line !== null && line !== '').join('\\n');

    // Build ICS content
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MentorAll//Booking System//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${createdTimeICS}`,
      `DTSTART:${startTimeICS}`,
      `DTEND:${endTimeICS}`,
      `SUMMARY:Meeting: ${booking.BookerUsername} & ${booking.InvitedUsername}`,
      `DESCRIPTION:${description}`,
      `LOCATION:Zoom (Link will be provided in confirmation email)`,
      `STATUS:${booking.BookingStatus === 'Confirmed' ? 'CONFIRMED' : booking.BookingStatus === 'Rescheduled' ? 'TENTATIVE' : 'TENTATIVE'}`,
      `ORGANIZER:CN=${booking.BookerUsername}`,
      `ATTENDEE:CN=${booking.InvitedUsername}`,
      `CATEGORIES:MentorAll,Meeting`,
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Meeting reminder - 15 minutes',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    // Return ICS file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="mentorall-meeting-${bookingId}.ics"`,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error("ICS generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate calendar file" },
      { status: 500 }
    );
  }
}
