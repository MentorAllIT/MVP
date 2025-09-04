import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

export const dynamic = "force-dynamic";

interface TimeSlot {
  start: string;
  end: string;
}

interface WeeklyAvailability {
  monday: TimeSlot[];
  tuesday: TimeSlot[];
  wednesday: TimeSlot[];
  thursday: TimeSlot[];
  friday: TimeSlot[];
  saturday: TimeSlot[];
  sunday: TimeSlot[];
}

interface MentorAvailability {
  timezone: string;
  weekly: WeeklyAvailability;
  overrides?: { [date: string]: TimeSlot[] };
  minNoticeHours?: number;
}

interface BookingConflict {
  datetime: string;
  endTime: string;
}

const getBase = () => {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
  return AIRTABLE_API_KEY && AIRTABLE_BASE_ID
    ? new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID)
    : null;
};

const esc = (s: string) => String(s).replace(/'/g, "\\'");

// Helper function to get effective availability for a specific date
function getEffectiveAvailabilityForDate(
  availability: MentorAvailability,
  dateString: string
): TimeSlot[] {
  // Check for date-specific override first
  if (availability.overrides && availability.overrides[dateString]) {
    return availability.overrides[dateString];
  }

  // Fall back to weekly schedule
  try {
    const date = new Date(dateString + 'T00:00:00');
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()] as keyof WeeklyAvailability;
    
    return availability.weekly[dayName] || [];
  } catch (dateError) {
    console.error("Error parsing date:", dateString, dateError);
    return [];
  }
}

// Helper function to check if mentor is available at a specific time
function isMentorAvailableAt(
  availability: MentorAvailability,
  datetime: string,
  bookingConflicts: BookingConflict[]
): { available: boolean; reason?: string; tooSoon?: boolean } {
  const requestedDate = new Date(datetime);
  const dateString = requestedDate.toISOString().split('T')[0];
  const timeString = requestedDate.toTimeString().slice(0, 5); // HH:MM format

  // Check minimum notice requirement
  const minNoticeMs = (availability.minNoticeHours || 0) * 60 * 60 * 1000;
  const now = new Date();
  if (requestedDate.getTime() - now.getTime() < minNoticeMs) {
    return { available: false, reason: 'Minimum notice required', tooSoon: true };
  }

  // Get effective availability for this date
  const daySlots = getEffectiveAvailabilityForDate(availability, dateString);
  
  // Check if time falls within any available slot
  const isInAvailableSlot = daySlots.some(slot => {
    return timeString >= slot.start && timeString < slot.end;
  });

  if (!isInAvailableSlot) {
    return { available: false, reason: 'Outside available hours' };
  }

  // Check for booking conflicts
  const hasConflict = bookingConflicts.some(conflict => {
    const conflictStart = new Date(conflict.datetime);
    const conflictEnd = new Date(conflict.endTime);
    return requestedDate >= conflictStart && requestedDate < conflictEnd;
  });

  if (hasConflict) {
    return { available: false, reason: 'Time slot already booked' };
  }

  return { available: true };
}

export async function GET(request: NextRequest) {
  try {
    const base = getBase();
    const MENTOR_META = process.env.AIRTABLE_MENTOR_META_TABLE || "MentorMeta";
    const BOOKINGS = process.env.AIRTABLE_BOOKINGS_TABLE || "Bookings";
    
    if (!base) {
      return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const dateParam = searchParams.get("date");
    const checkTime = searchParams.get("checkTime");

    if (!userId) {
      return NextResponse.json(
        { error: "UserId parameter is required" },
        { status: 400 }
      );
    }

    // Fetch mentor availability from MentorMeta table using UserID
    const records = await base(MENTOR_META)
      .select({
        filterByFormula: `{UserID} = '${esc(userId)}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      return NextResponse.json(
        { error: "Mentor not found or availability not configured" },
        { status: 404 }
      );
    }

    const mentorRecord = records[0];
    const availabilityJSON = mentorRecord.fields.AvailabilityJSON as string;

    if (!availabilityJSON) {
      return NextResponse.json(
        { error: "Mentor availability not configured" },
        { status: 404 }
      );
    }

    let availability: MentorAvailability;
    try {
      availability = JSON.parse(availabilityJSON);
      
      // Validate the availability structure
      if (!availability.timezone || !availability.weekly) {
        return NextResponse.json(
          { error: "Invalid availability format" },
          { status: 400 }
        );
      }
    } catch (parseError) {
      console.error("Error parsing availability JSON:", parseError);
      return NextResponse.json(
        { error: "Invalid availability JSON format" },
        { status: 400 }
      );
    }

    // Fetch existing bookings for conflict detection
    let bookingConflicts: BookingConflict[] = [];
    try {
      const bookingRecords = await base(BOOKINGS)
        .select({
          filterByFormula: `{MentorUserID} = '${esc(userId)}'`,
          fields: ['DateTime', 'EndTime'],
          sort: [{ field: 'DateTime', direction: 'asc' }]
        })
        .firstPage();

      bookingConflicts = bookingRecords.map(record => ({
        datetime: record.fields.DateTime as string,
        endTime: record.fields.EndTime as string
      }));
    } catch (bookingError) {
      console.error("Error fetching bookings (non-fatal):", bookingError);
      // Continue without bookings data - mentor availability can still work
      bookingConflicts = [];
    }

    // If checking specific time availability
    if (checkTime) {
      const availabilityCheck = isMentorAvailableAt(availability, checkTime, bookingConflicts);
      return NextResponse.json({
        success: true,
        available: availabilityCheck.available,
        reason: availabilityCheck.reason,
        tooSoon: availabilityCheck.tooSoon,
        datetime: checkTime
      });
    }

    // If requesting specific date availability
    if (dateParam) {
      const effectiveSlots = getEffectiveAvailabilityForDate(availability, dateParam);
      const hasOverride = !!(availability.overrides && availability.overrides[dateParam]);
      
      return NextResponse.json({
        success: true,
        date: dateParam,
        slots: effectiveSlots,
        hasOverride,
        timezone: availability.timezone,
        minNoticeHours: availability.minNoticeHours || 0,
        bookingConflicts: bookingConflicts.filter(conflict => 
          conflict.datetime.startsWith(dateParam)
        )
      });
    }

    // Return full availability structure
    return NextResponse.json({
      success: true,
      availability: availability,
      bookingConflicts,
      mentorInfo: {
        userId: mentorRecord.fields.UserID,
        username: mentorRecord.fields.Username,
        name: mentorRecord.fields.Name || mentorRecord.fields.Username || "Unknown"
      }
    });

  } catch (error) {
    console.error("Error fetching mentor availability:", error);
    
    // Log more specific error details
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    
    return NextResponse.json(
      { 
        error: "Failed to fetch mentor availability",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
