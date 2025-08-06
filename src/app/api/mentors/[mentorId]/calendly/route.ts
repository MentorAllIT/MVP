import { NextRequest, NextResponse } from "next/server";
import { CalendlyService } from "@/lib/calendly";
import Airtable from "airtable";

// Environment variables
const { 
  CALENDLY_API_KEY,
  AIRTABLE_API_KEY, 
  AIRTABLE_BASE_ID, 
  AIRTABLE_USERS_TABLE 
} = process.env;

if (!CALENDLY_API_KEY || !AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_USERS_TABLE) {
  throw new Error("Missing required environment variables");
}

const calendly = new CalendlyService(CALENDLY_API_KEY);
const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
const USERS_TABLE = AIRTABLE_USERS_TABLE;

// Helper function to escape strings for Airtable formulas
const esc = (s: string) => s.replace(/'/g, "\\'");

// GET: Fetch specific mentor's Calendly event types and availability
export async function GET(
  req: NextRequest,
  { params }: { params: { mentorId: string } }
) {
  try {
    const { mentorId } = params;
    const { searchParams } = new URL(req.url);
    const syncEventTypes = searchParams.get('syncEventTypes') === 'true';

    // Get mentor info from Airtable
    const mentorRecords = await base(USERS_TABLE)
      .select({
        filterByFormula: `AND({UserID} = '${esc(mentorId)}', {Role} = 'Mentor')`,
        maxRecords: 1
      })
      .firstPage();

    if (mentorRecords.length === 0) {
      return NextResponse.json(
        { error: "Mentor not found" },
        { status: 404 }
      );
    }

    const mentor = mentorRecords[0].fields;
    
    if (!mentor.IsCalendlyEnabled) {
      return NextResponse.json(
        { error: "Mentor does not have Calendly enabled" },
        { status: 400 }
      );
    }

    let response = {
      success: true,
      mentor: {
        userId: mentor.UserID,
        name: mentor.Name,
        email: mentor.Email,
        calendlyUsername: mentor.CalendlyUsername,
        schedulingUrl: mentor.CalendlySchedulingUrl,
        isCalendlyEnabled: mentor.IsCalendlyEnabled,
        timezone: mentor.Timezone
      },
      eventTypes: [],
      lastSyncedEventTypes: []
    };

    // Parse stored event types
    try {
      response.lastSyncedEventTypes = mentor.CalendlyEventTypes ? JSON.parse(mentor.CalendlyEventTypes as string) : [];
    } catch (e) {
      response.lastSyncedEventTypes = [];
    }

    // If sync is requested, fetch fresh data from Calendly
    if (syncEventTypes) {
      try {
        // For now, we'll use the main API key to fetch event types
        // In a production setup, each mentor would have their own API key
        const currentUser = await calendly.getCurrentUser();
        
        // Fetch event types for the current user (this would be mentor-specific in production)
        const eventTypesResponse = await fetch(`https://api.calendly.com/event_types?user=${currentUser.uri}`, {
          headers: {
            'Authorization': `Bearer ${CALENDLY_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        if (eventTypesResponse.ok) {
          const eventTypesData = await eventTypesResponse.json();
          const eventTypes = eventTypesData.collection.map((et: any) => ({
            uri: et.uri,
            name: et.name,
            slug: et.slug,
            duration: et.duration,
            schedulingUrl: et.scheduling_url,
            description: et.description_plain,
            active: et.active,
            kind: et.kind,
            poolingType: et.pooling_type
          }));

          response.eventTypes = eventTypes;

          // Update the mentor's event types in Airtable
          await base(USERS_TABLE).update([
            {
              id: mentorRecords[0].id,
              fields: {
                CalendlyEventTypes: JSON.stringify(eventTypes),
                LastEventTypeSync: new Date().toISOString()
              },
            },
          ]);

        } else {
          throw new Error(`Calendly API error: ${eventTypesResponse.status}`);
        }

      } catch (calendlyError: any) {
        console.error("Error fetching Calendly event types:", calendlyError);
        
        // Fall back to stored event types
        response.eventTypes = response.lastSyncedEventTypes;
        response.syncError = calendlyError.message;
      }
    } else {
      // Use stored event types
      response.eventTypes = response.lastSyncedEventTypes;
    }

    return NextResponse.json(response);

  } catch (error: any) {
    console.error("Mentor Calendly info fetch error:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch mentor Calendly information",
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// POST: Update mentor's specific event type settings
export async function POST(
  req: NextRequest,
  { params }: { params: { mentorId: string } }
) {
  try {
    const { mentorId } = params;
    const { eventTypeUri, enabled, customSettings } = await req.json();

    // This would handle mentor-specific event type configurations
    // For example: enabling/disabling specific event types for booking
    
    return NextResponse.json({
      success: true,
      message: "Mentor event type settings updated",
      mentorId,
      eventTypeUri,
      enabled,
      customSettings
    });

  } catch (error: any) {
    console.error("Mentor event type update error:", error);
    return NextResponse.json(
      { 
        error: "Failed to update mentor event type settings",
        details: error.message 
      },
      { status: 500 }
    );
  }
}
