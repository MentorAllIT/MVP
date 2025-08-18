import { NextRequest, NextResponse } from "next/server";
import { CalendlyService } from "@/lib/calendly";
import Airtable from "airtable";
import { nanoid } from "nanoid";

// Environment variables
const { 
  CALENDLY_API_KEY,
  AIRTABLE_API_KEY, 
  AIRTABLE_BASE_ID, 
  AIRTABLE_BOOKINGS_TABLE 
} = process.env;

if (!CALENDLY_API_KEY || !AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_BOOKINGS_TABLE) {
  throw new Error("Missing required environment variables");
}

const calendly = new CalendlyService(CALENDLY_API_KEY);
const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
const BOOKINGS_TABLE = AIRTABLE_BOOKINGS_TABLE;

// GET: Sync Calendly events to your system
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userUri = searchParams.get('userUri');
    const syncDays = parseInt(searchParams.get('syncDays') || '30');
    
    if (!userUri) {
      return NextResponse.json(
        { error: "userUri parameter is required" },
        { status: 400 }
      );
    }

    // Calculate date range for sync
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + syncDays);

    // Fetch events from Calendly
    const eventsResponse = await calendly.getUserEvents(userUri, {
      min_start_time: now.toISOString(),
      max_start_time: futureDate.toISOString(),
      status: 'active',
      count: 100,
      sort: 'start_time:asc'
    });

    const syncedBookings = [];

    for (const event of eventsResponse.collection) {
      try {
        // Get detailed event info and invitees
        const [eventDetails, invitees] = await Promise.all([
          calendly.getEventDetails(event.uri),
          calendly.getEventInvitees(event.uri)
        ]);

        // Check if booking already exists in Airtable
        const existingBookings = await base(BOOKINGS_TABLE)
          .select({
            filterByFormula: `{CalendlyEventURI} = '${event.uri}'`,
            maxRecords: 1
          })
          .firstPage();

        if (existingBookings.length > 0) {
          // Update existing booking
          const existingRecord = existingBookings[0];
          const updatedRecord = await base(BOOKINGS_TABLE).update([
            {
              id: existingRecord.id,
              fields: {
                BookingStatus: event.status === 'active' ? 'Scheduled' : 'Cancelled',
                MeetingTime: event.start_time,
                EndTime: event.end_time,
                UpdatedAt: new Date().toISOString(),
              },
            },
          ]);
          
          syncedBookings.push({
            action: 'updated',
            bookingId: existingRecord.fields.BookingID,
            calendlyEventId: event.uri
          });
        } else {
          // Create new booking
          const bookingId = nanoid(12);
          const primaryInvitee = invitees[0];
          
          // Get organizer info
          const currentUser = await calendly.getCurrentUser();
          
          const newRecord = await base(BOOKINGS_TABLE).create([
            {
              fields: {
                BookingID: bookingId,
                CalendlyEventURI: event.uri,
                CalendlyEventId: event.uri.split('/').pop(),
                BookingStatus: 'Scheduled',
                MeetingTime: event.start_time,
                EndTime: event.end_time,
                InviteeEmail: primaryInvitee?.email || '',
                InviteeName: primaryInvitee?.name || '',
                InviteeTimezone: primaryInvitee?.timezone || '',
                OrganizerEmail: currentUser.email,
                OrganizerName: currentUser.name,
                MeetingLocation: JSON.stringify(event.location || {}),
                MeetingNotes: event.meeting_notes_plain || '',
                CancelUrl: primaryInvitee?.cancel_url || '',
                RescheduleUrl: primaryInvitee?.reschedule_url || '',
                CreatedAt: event.created_at,
                UpdatedAt: new Date().toISOString(),
                QuestionsAndAnswers: JSON.stringify(primaryInvitee?.questions_and_answers || []),
                SyncedFromCalendly: true,
              },
            },
          ]);

          syncedBookings.push({
            action: 'created',
            bookingId: bookingId,
            calendlyEventId: event.uri
          });
        }
      } catch (eventError) {
        console.error(`Error processing event ${event.uri}:`, eventError);
        continue;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${syncedBookings.length} bookings from Calendly`,
      syncedBookings,
      totalEvents: eventsResponse.collection.length
    });

  } catch (error: any) {
    console.error("Calendly sync error:", error);
    return NextResponse.json(
      { 
        error: "Failed to sync Calendly events",
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// POST: Manual sync for specific event
export async function POST(req: NextRequest) {
  try {
    const { eventUri } = await req.json();
    
    if (!eventUri) {
      return NextResponse.json(
        { error: "eventUri is required" },
        { status: 400 }
      );
    }

    // Get detailed event info
    const [eventDetails, invitees] = await Promise.all([
      calendly.getEventDetails(eventUri),
      calendly.getEventInvitees(eventUri)
    ]);

    const primaryInvitee = invitees[0];
    const currentUser = await calendly.getCurrentUser();

    // Check if booking exists
    const existingBookings = await base(BOOKINGS_TABLE)
      .select({
        filterByFormula: `{CalendlyEventURI} = '${eventUri}'`,
        maxRecords: 1
      })
      .firstPage();

    let result;

    if (existingBookings.length > 0) {
      // Update existing
      const existingRecord = existingBookings[0];
      const updatedRecord = await base(BOOKINGS_TABLE).update([
        {
          id: existingRecord.id,
          fields: {
            BookingStatus: eventDetails.status === 'active' ? 'Scheduled' : 'Cancelled',
            MeetingTime: eventDetails.start_time,
            EndTime: eventDetails.end_time,
            UpdatedAt: new Date().toISOString(),
          },
        },
      ]);
      
      result = {
        action: 'updated',
        bookingId: existingRecord.fields.BookingID
      };
    } else {
      // Create new
      const bookingId = nanoid(12);
      
      const newRecord = await base(BOOKINGS_TABLE).create([
        {
          fields: {
            BookingID: bookingId,
            CalendlyEventURI: eventUri,
            CalendlyEventId: eventUri.split('/').pop(),
            BookingStatus: 'Scheduled',
            MeetingTime: eventDetails.start_time,
            EndTime: eventDetails.end_time,
            InviteeEmail: primaryInvitee?.email || '',
            InviteeName: primaryInvitee?.name || '',
            InviteeTimezone: primaryInvitee?.timezone || '',
            OrganizerEmail: currentUser.email,
            OrganizerName: currentUser.name,
            MeetingLocation: JSON.stringify(eventDetails.location || {}),
            MeetingNotes: eventDetails.meeting_notes_plain || '',
            CancelUrl: primaryInvitee?.cancel_url || '',
            RescheduleUrl: primaryInvitee?.reschedule_url || '',
            CreatedAt: eventDetails.created_at,
            UpdatedAt: new Date().toISOString(),
            QuestionsAndAnswers: JSON.stringify(primaryInvitee?.questions_and_answers || []),
            SyncedFromCalendly: true,
          },
        },
      ]);

      result = {
        action: 'created',
        bookingId: bookingId
      };
    }

    return NextResponse.json({
      success: true,
      ...result,
      eventDetails: {
        uri: eventDetails.uri,
        name: eventDetails.name,
        start_time: eventDetails.start_time,
        end_time: eventDetails.end_time,
        status: eventDetails.status
      }
    });

  } catch (error: any) {
    console.error("Manual sync error:", error);
    return NextResponse.json(
      { 
        error: "Failed to sync specific event",
        details: error.message 
      },
      { status: 500 }
    );
  }
}
