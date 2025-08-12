import { NextRequest, NextResponse } from "next/server";
import { CalendlyService } from "@/lib/calendly";
import Airtable from "airtable";
import { nanoid } from "nanoid";

// Environment variables
const { 
  CALENDLY_API_KEY,
  CALENDLY_WEBHOOK_SECRET,
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

// Webhook signature verification (optional but recommended)
function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!CALENDLY_WEBHOOK_SECRET) return true; // Skip verification if no secret set
  
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', CALENDLY_WEBHOOK_SECRET)
    .update(payload)
    .digest('base64');
  
  return signature === expectedSignature;
}

// Handle Calendly webhook events
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('calendly-webhook-signature') || '';
    
    // Verify webhook signature (if configured)
    if (!verifyWebhookSignature(body, signature)) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const webhookData = JSON.parse(body);
    const { event, payload } = webhookData;

    console.log(`Received Calendly webhook: ${event}`);

    switch (event) {
      case 'invitee.created':
        await handleInviteeCreated(payload);
        break;
      
      case 'invitee.canceled':
        await handleInviteeCanceled(payload);
        break;
      
      case 'routing_form_submission.created':
        // Handle routing form submissions if needed
        console.log('Routing form submission received:', payload);
        break;
      
      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    return NextResponse.json({ success: true, event });

  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { 
        error: "Failed to process webhook",
        details: error.message 
      },
      { status: 500 }
    );
  }
}

async function handleInviteeCreated(payload: any) {
  try {
    const eventUri = payload.event;
    const inviteeUri = payload.invitee;

    console.log(`Processing invitee.created for event: ${eventUri}`);

    // Use our new booking creation API to handle the event
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/calendly/booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ eventUri }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`Successfully created booking: ${result.bookingId}`, result.bookingDetails);
    } else {
      const error = await response.json();
      console.error(`Failed to create booking for event ${eventUri}:`, error);
    }

  } catch (error) {
    console.error('Error handling invitee.created:', error);
    throw error;
  }
}

async function handleInviteeCanceled(payload: any) {
  try {
    const eventUri = payload.event;
    const inviteeUri = payload.invitee;

    // Find existing booking
    const existingBookings = await base(BOOKINGS_TABLE)
      .select({
        filterByFormula: `{CalendlyEventURI} = '${eventUri}'`,
        maxRecords: 1
      })
      .firstPage();

    if (existingBookings.length === 0) {
      console.log(`No booking found for canceled event: ${eventUri}`);
      return;
    }

    // Update booking status to cancelled
    const existingRecord = existingBookings[0];
    const updatedRecord = await base(BOOKINGS_TABLE).update([
      {
        id: existingRecord.id,
        fields: {
          BookingStatus: 'Cancelled',
          CancellationTime: new Date().toISOString(),
          UpdatedAt: new Date().toISOString(),
          WebhookEvent: 'invitee.canceled',
        },
      },
    ]);

    console.log(`Cancelled booking ${existingRecord.fields.BookingID} for Calendly event ${eventUri}`);

  } catch (error) {
    console.error('Error handling invitee.canceled:', error);
    throw error;
  }
}

// GET method to check webhook status
export async function GET() {
  return NextResponse.json({
    status: 'Calendly webhook endpoint active',
    timestamp: new Date().toISOString(),
    supportedEvents: [
      'invitee.created',
      'invitee.canceled',
      'routing_form_submission.created'
    ]
  });
}
