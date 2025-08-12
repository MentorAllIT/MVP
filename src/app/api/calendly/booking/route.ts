import { NextRequest, NextResponse } from "next/server";
import { CalendlyService } from "@/lib/calendly";
import Airtable from "airtable";
import { nanoid } from "nanoid";

// Environment variables
const { 
  CALENDLY_API_KEY,
  AIRTABLE_API_KEY, 
  AIRTABLE_BASE_ID, 
  AIRTABLE_USERS_TABLE,
  AIRTABLE_BOOKINGS_TABLE 
} = process.env;

if (!CALENDLY_API_KEY || !AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_USERS_TABLE || !AIRTABLE_BOOKINGS_TABLE) {
  throw new Error("Missing required environment variables");
}

const calendly = new CalendlyService(CALENDLY_API_KEY);
const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
const USERS_TABLE = AIRTABLE_USERS_TABLE;
const BOOKINGS_TABLE = AIRTABLE_BOOKINGS_TABLE;

// Helper function to escape strings for Airtable formulas
const esc = (s: string) => s.replace(/'/g, "\\'");

// Find mentor by Calendly scheduling URL
async function findMentorByCalendlyUrl(calendlyUrl: string) {
  try {
    // Extract username from Calendly URL (e.g., https://calendly.com/john-doe -> john-doe)
    const urlParts = calendlyUrl.split('/');
    const username = urlParts[urlParts.length - 1];
    
    const mentors = await base(USERS_TABLE)
      .select({
        filterByFormula: `AND(
          {Role} = 'Mentor',
          OR(
            FIND('${esc(username)}', {CalendlySchedulingUrl}) > 0,
            FIND('${esc(calendlyUrl)}', {CalendlySchedulingUrl}) > 0
          )
        )`,
        maxRecords: 1
      })
      .firstPage();

    return mentors.length > 0 ? mentors[0] : null;
  } catch (error) {
    console.error('Error finding mentor by Calendly URL:', error);
    return null;
  }
}

// Find mentee by email
async function findMenteeByEmail(email: string) {
  try {
    const mentees = await base(USERS_TABLE)
      .select({
        filterByFormula: `AND(
          {Role} = 'Mentee',
          {Email} = '${esc(email)}'
        )`,
        maxRecords: 1
      })
      .firstPage();

    return mentees.length > 0 ? mentees[0] : null;
  } catch (error) {
    console.error('Error finding mentee by email:', error);
    return null;
  }
}

// GET: Retrieve booking details from Calendly event URI
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventUri = searchParams.get('eventUri');
    
    if (!eventUri) {
      return NextResponse.json(
        { error: "eventUri parameter is required" },
        { status: 400 }
      );
    }

    // Get detailed event and invitee information from Calendly
    const [eventDetails, invitees] = await Promise.all([
      calendly.getEventDetails(eventUri),
      calendly.getEventInvitees(eventUri)
    ]);

    const primaryInvitee = invitees[0]; // Assuming single invitee
    
    if (!primaryInvitee) {
      return NextResponse.json(
        { error: "No invitee found for this event" },
        { status: 404 }
      );
    }

    // Get event type details to find the mentor
    const eventType = await calendly.getEventType(eventDetails.event_type);
    
    // Find mentor by Calendly URL
    const mentorRecord = await findMentorByCalendlyUrl(eventType.scheduling_url);
    if (!mentorRecord) {
      return NextResponse.json(
        { error: "Mentor not found for this Calendly event" },
        { status: 404 }
      );
    }

    // Find mentee by email
    const menteeRecord = await findMenteeByEmail(primaryInvitee.email);
    if (!menteeRecord) {
      return NextResponse.json(
        { error: "Mentee not found in system" },
        { status: 404 }
      );
    }

    // Format the complete booking details
    const bookingDetails = {
      calendlyEvent: {
        uri: eventDetails.uri,
        name: eventDetails.name,
        status: eventDetails.status,
        startTime: eventDetails.start_time,
        endTime: eventDetails.end_time,
        location: eventDetails.location,
        meetingNotes: eventDetails.meeting_notes_plain,
        createdAt: eventDetails.created_at,
        updatedAt: eventDetails.updated_at,
      },
      invitee: {
        uri: primaryInvitee.uri,
        name: primaryInvitee.name,
        email: primaryInvitee.email,
        timezone: primaryInvitee.timezone,
        questionsAndAnswers: primaryInvitee.questions_and_answers,
        cancelUrl: primaryInvitee.cancel_url,
        rescheduleUrl: primaryInvitee.reschedule_url,
        status: primaryInvitee.status,
      },
      mentor: {
        userId: mentorRecord.fields.UserID,
        name: mentorRecord.fields.Name,
        email: mentorRecord.fields.Email,
        schedulingUrl: mentorRecord.fields.CalendlySchedulingUrl,
      },
      mentee: {
        userId: menteeRecord.fields.UserID,
        name: menteeRecord.fields.Name,
        email: menteeRecord.fields.Email,
      },
      eventType: {
        name: eventType.name,
        duration: eventType.duration,
        schedulingUrl: eventType.scheduling_url,
        description: eventType.description_plain,
      }
    };

    return NextResponse.json({
      success: true,
      bookingDetails
    });

  } catch (error: any) {
    console.error("Error retrieving booking details:", error);
    return NextResponse.json(
      { 
        error: "Failed to retrieve booking details",
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// POST: Create booking record from Calendly event details
export async function POST(req: NextRequest) {
  try {
    const { eventUri } = await req.json();
    
    if (!eventUri) {
      return NextResponse.json(
        { error: "eventUri is required" },
        { status: 400 }
      );
    }

    // First, get the booking details using the GET logic
    const detailsResponse = await fetch(`${req.url}?eventUri=${encodeURIComponent(eventUri)}`, {
      method: 'GET',
      headers: req.headers,
    });
    
    if (!detailsResponse.ok) {
      const errorData = await detailsResponse.json();
      return NextResponse.json(errorData, { status: detailsResponse.status });
    }

    const { bookingDetails } = await detailsResponse.json();

    // Check if booking already exists
    const existingBookings = await base(BOOKINGS_TABLE)
      .select({
        filterByFormula: `{CalendlyEventURI} = '${esc(eventUri)}'`,
        maxRecords: 1
      })
      .firstPage();

    if (existingBookings.length > 0) {
      return NextResponse.json({
        success: true,
        message: "Booking already exists",
        bookingId: existingBookings[0].fields.BookingID,
        action: "found_existing"
      });
    }

    // Create new booking record
    const bookingId = nanoid(12);
    
    const newRecord = await base(BOOKINGS_TABLE).create([
      {
        fields: {
          BookingID: bookingId,
          CalendlyEventURI: eventUri,
          CalendlyInviteeURI: bookingDetails.invitee.uri,
          CalendlyEventId: eventUri.split('/').pop(),
          
          // Participants
          BookedByUserID: bookingDetails.mentee.userId,
          InvitedUserID: bookingDetails.mentor.userId,
          BookerUsername: bookingDetails.mentee.name,
          InvitedUsername: bookingDetails.mentor.name,
          Email: bookingDetails.mentee.email,
          InvitedEmail: bookingDetails.mentor.email,
          
          // Meeting details
          MeetingTime: bookingDetails.calendlyEvent.startTime,
          EndTime: bookingDetails.calendlyEvent.endTime,
          BookingStatus: 'Scheduled',
          MeetingLocation: JSON.stringify(bookingDetails.calendlyEvent.location || {}),
          MeetingNotes: bookingDetails.calendlyEvent.meetingNotes || '',
          
          // Calendly specific
          InviteeTimezone: bookingDetails.invitee.timezone,
          CancelUrl: bookingDetails.invitee.cancelUrl,
          RescheduleUrl: bookingDetails.invitee.rescheduleUrl,
          QuestionsAndAnswers: JSON.stringify(bookingDetails.invitee.questionsAndAnswers || []),
          
          // Metadata
          SyncedFromCalendly: true,
          CreatedAt: bookingDetails.calendlyEvent.createdAt,
          UpdatedAt: new Date().toISOString(),
          EventTypeName: bookingDetails.eventType.name,
          EventTypeDuration: bookingDetails.eventType.duration,
        },
      },
    ]);

    return NextResponse.json({
      success: true,
      message: "Booking created successfully from Calendly event",
      bookingId: bookingId,
      action: "created",
      bookingDetails: {
        id: bookingId,
        mentor: bookingDetails.mentor.name,
        mentee: bookingDetails.mentee.name,
        startTime: bookingDetails.calendlyEvent.startTime,
        eventType: bookingDetails.eventType.name,
      }
    });

  } catch (error: any) {
    console.error("Error creating booking from Calendly event:", error);
    return NextResponse.json(
      { 
        error: "Failed to create booking",
        details: error.message 
      },
      { status: 500 }
    );
  }
}
