import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { eventUri } = await request.json();

    if (!eventUri) {
      return NextResponse.json(
        { error: 'eventUri is required for testing' },
        { status: 400 }
      );
    }

    console.log(`Testing booking flow for event: ${eventUri}`);

    // Step 1: Test fetching booking details
    console.log('Step 1: Fetching booking details from Calendly...');
    const detailsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/calendly/booking?eventUri=${encodeURIComponent(eventUri)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const detailsResult = await detailsResponse.json();
    console.log('Booking details result:', detailsResult);

    if (!detailsResponse.ok) {
      return NextResponse.json({
        success: false,
        step: 'fetch_details',
        error: detailsResult,
      });
    }

    // Step 2: Test creating booking
    console.log('Step 2: Creating booking record...');
    const createResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/calendly/booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ eventUri }),
    });

    const createResult = await createResponse.json();
    console.log('Booking creation result:', createResult);

    if (!createResponse.ok) {
      return NextResponse.json({
        success: false,
        step: 'create_booking',
        error: createResult,
        detailsFetched: detailsResult,
      });
    }

    // Step 3: Test webhook simulation
    console.log('Step 3: Simulating webhook...');
    const webhookResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/calendly/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Calendly-Webhook-Signature': 'test-signature',
      },
      body: JSON.stringify({
        event: 'invitee.created',
        payload: {
          event: eventUri,
          invitee: 'https://api.calendly.com/scheduled_events/invitees/test-invitee',
        },
        time: new Date().toISOString(),
      }),
    });

    const webhookResult = await webhookResponse.json();
    console.log('Webhook result:', webhookResult);

    return NextResponse.json({
      success: true,
      message: 'Full booking flow test completed',
      results: {
        step1_fetch_details: {
          success: detailsResponse.ok,
          result: detailsResult,
        },
        step2_create_booking: {
          success: createResponse.ok,
          result: createResult,
        },
        step3_webhook_simulation: {
          success: webhookResponse.ok,
          result: webhookResult,
        },
      },
    });

  } catch (error: any) {
    console.error('Error testing booking flow:', error);
    return NextResponse.json(
      { error: 'Test failed', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Booking Flow Test Endpoint',
    usage: {
      method: 'POST',
      body: {
        eventUri: 'https://api.calendly.com/scheduled_events/AAAAAAAAAAAAAAAA'
      },
      description: 'Tests the complete booking flow: fetch details -> create booking -> webhook simulation'
    },
    endpoints_tested: [
      'GET /api/calendly/booking',
      'POST /api/calendly/booking', 
      'POST /api/calendly/webhook'
    ]
  });
}
