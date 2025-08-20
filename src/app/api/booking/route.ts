import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";
const getBase = () => {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
  return AIRTABLE_API_KEY && AIRTABLE_BASE_ID
    ? new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID)
    : null;
};
const esc = (s: string) => String(s).replace(/'/g, "\\'");

export async function POST(request: Request) {
  try {
    const base = getBase();
    const USERS = process.env.AIRTABLE_USERS_TABLE;
    const BOOKINGS = process.env.AIRTABLE_BOOKINGS_TABLE;
    if (!base || !USERS || !BOOKINGS) {
      return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
    }
    const body = await request.json();
    
    // Support both old and new parameter names for backward compatibility
    const bookerId = body.bookerId || body.currentUserId;
    const inviteeId = body.inviteeId || body.invitedUserId;
    const inviteeUsername = body.inviteeUsername || body.invitedUsername;
    const meetingTime = body.meetingTime;
    const notes = body.notes || "";

    // Validate required fields
    if (!bookerId || (!inviteeId && !inviteeUsername) || !meetingTime) {
      return NextResponse.json(
        { error: "Missing required fields: bookerId (or currentUserId), inviteeId (or invitedUserId/inviteeUsername), meetingTime" },
        { status: 400 }
      );
    }

    // Validate meeting time format
    const meetingDate = new Date(meetingTime);
    if (isNaN(meetingDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid meeting time format" },
        { status: 400 }
      );
    }

    // If we have username but no ID, look up the user
    let finalInviteeId = inviteeId;
    if (!finalInviteeId && inviteeUsername) {
      try {
        const userRecords = await base(USERS!)
          .select({
            filterByFormula: `{Username} = '${esc(inviteeUsername)}'`,
            maxRecords: 1
          })
          .firstPage();

        if (userRecords.length === 0) {
          return NextResponse.json(
            { error: "Invitee user not found" },
            { status: 404 }
          );
        }

        finalInviteeId = userRecords[0].fields.UserID as string;
      } catch (error) {
        console.error("Error looking up user by username:", error);
        return NextResponse.json(
          { error: "Error looking up user" },
          { status: 500 }
        );
      }
    }

    // Generate unique booking ID
    const bookingId = nanoid();

    // Fetch user details for both booker and invitee
    let bookerDetails = null;
    let inviteeDetails = null;

    try {
      // Get booker details
      const bookerRecords = await base(USERS!)
        .select({
          filterByFormula: `{UserID} = '${esc(bookerId)}'`,
          maxRecords: 1
        })
        .firstPage();

      if (bookerRecords.length > 0) {
        const bookerFields = bookerRecords[0].fields;
        bookerDetails = {
          email: bookerFields.Email || "",
          name: bookerFields.Name || "",
          tags: bookerFields.Tags || ""
        };
      }

      // Get invitee details
      const inviteeRecords = await base(USERS!)
        .select({
          filterByFormula: `{UserID} = '${esc(finalInviteeId)}'`,
          maxRecords: 1
        })
        .firstPage();

      if (inviteeRecords.length > 0) {
        const inviteeFields = inviteeRecords[0].fields;
        inviteeDetails = {
          username: inviteeFields.Name || "",
          email: inviteeFields.Email || "",
          name: inviteeFields.Name || ""
        };
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
      // Continue with booking creation even if user details fetch fails
    }

    // Create booking record
    const bookingRecord = {
      BookingID: bookingId,
      BookedByUserID: bookerId,
      BookerUsername: bookerDetails?.name || "",
      Email: bookerDetails?.email || "",
      InviteeID: finalInviteeId,
      InvitedUsername: inviteeDetails?.name || inviteeUsername || "",
      InvitedEmail: inviteeDetails?.email || "",
      MeetingTime: meetingTime,
      BookingStatus: "Pending", // Default status
      Notes: notes,
      Tags: bookerDetails?.tags ? String(bookerDetails.tags) : "",
      // ICS file URL for calendar download
      ICSFileUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/booking/${bookingId}/ics`
    };

    // Save to Airtable
    const createdRecord = await base(BOOKINGS).create(bookingRecord);

    // Update MentorMeta and MenteeMeta tables with booking IDs
    try {
      const MENTOR_META = process.env.AIRTABLE_MENTOR_META_TABLE || "MentorMeta";
      const MENTEE_META = process.env.AIRTABLE_MENTEE_META_TABLE || "MenteeMeta";

      // Update mentor's booking list
      const mentorRecords = await base(MENTOR_META)
        .select({
          filterByFormula: `{UserID} = '${esc(finalInviteeId)}'`,
          maxRecords: 1
        })
        .firstPage();

      if (mentorRecords.length > 0) {
        const mentorRecord = mentorRecords[0];
        const existingBookings = mentorRecord.fields.Bookings as string || "";
        const updatedBookings = existingBookings 
          ? `${existingBookings}, ${bookingId}` 
          : bookingId;
        
        await base(MENTOR_META).update(mentorRecord.id, {
          Bookings: updatedBookings
        });
      }

      // Update mentee's booking list
      const menteeRecords = await base(MENTEE_META)
        .select({
          filterByFormula: `{UserID} = '${esc(bookerId)}'`,
          maxRecords: 1
        })
        .firstPage();

      if (menteeRecords.length > 0) {
        const menteeRecord = menteeRecords[0];
        const existingBookings = menteeRecord.fields.Bookings as string || "";
        const updatedBookings = existingBookings 
          ? `${existingBookings}, ${bookingId}` 
          : bookingId;
        
        await base(MENTEE_META).update(menteeRecord.id, {
          Bookings: updatedBookings
        });
      }
    } catch (metaUpdateError) {
      console.error("Error updating meta tables with booking ID:", metaUpdateError);
      // Don't fail the booking creation if meta update fails
    }

    return NextResponse.json({
      success: true,
      bookingId: bookingId,
      record: createdRecord.fields,
      message: "Booking created successfully."
    });

  } catch (error) {
    console.error("Booking creation error:", error);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}

// GET method to retrieve bookings
export async function GET(request: NextRequest) {
  try {
    const base = getBase();
    const BOOKINGS = process.env.AIRTABLE_BOOKINGS_TABLE;
    if (!base || !BOOKINGS) {
      return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
     }
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const bookingId = searchParams.get("bookingId");
    const role = searchParams.get("role");

    // Handle single booking fetch by bookingId
    if (bookingId) {
      try {
        const booking = await base(BOOKINGS)
          .select({
            filterByFormula: `{BookingID} = '${esc(bookingId)}'`,
            maxRecords: 1
          })
          .firstPage();

        if (booking.length === 0) {
          return NextResponse.json(
            { error: "Booking not found" },
            { status: 404 }
          );
        }

        const record = booking[0];
        const bookingDetails = {
          id: record.id,
          BookingId: record.fields.BookingID,
          BookerUsername: record.fields.BookerUsername || "Unknown",
          Email: record.fields.Email || "",
          InvitedUsername: record.fields.InvitedUsername || "Unknown",
          InvitedEmail: record.fields.InvitedEmail || "",
          MeetingTime: record.fields.MeetingTime,
          BookingStatus: record.fields.BookingStatus || "Pending",
          Notes: record.fields.Notes || "",
          ICSFileUrl: record.fields.ICSFileUrl || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/booking/${record.fields.BookingID}/ics`
        };

        return NextResponse.json(bookingDetails);
      } catch (error) {
        console.error("Error fetching booking by ID:", error);
        return NextResponse.json(
          { error: "Failed to fetch booking details" },
          { status: 500 }
        );
      }
    }

    // Handle multiple bookings fetch by userId (existing functionality)
    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId or bookingId parameter" },
        { status: 400 }
      );
    }

    let filterFormula = "";
    if (role === "mentor") {
      // For mentors, show bookings where they are the invitee
      filterFormula = `{InviteeID} = '${esc(userId)}'`;
    } else {
      // For bookers, show bookings where they are the booker
      filterFormula = `{BookedByUserID} = '${esc(userId)}'`;
    }

    const bookings = await base(BOOKINGS)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: "MeetingTime", direction: "desc" }]
      })
      .all();

    // Format the response using stored user details from booking records
    const formattedBookings = bookings.map((record: any) => ({
      id: record.id,
      bookingId: record.fields.BookingID,
      bookerName: record.fields.BookerUsername || "Unknown",
      bookerEmail: record.fields.BookerEmail || "",
      inviteeName: record.fields.InvitedUsername || "Unknown", 
      inviteeEmail: record.fields.InvitedEmail || "",
      meetingTime: record.fields.MeetingTime,
      status: record.fields.BookingStatus,
      notes: record.fields.Notes,
      createdAt: record.fields.CreatedAt,
      icsFileUrl: record.fields.ICSFileUrl || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/booking/${record.fields.BookingID}/ics`
    }));

    return NextResponse.json({ bookings: formattedBookings });

  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}
