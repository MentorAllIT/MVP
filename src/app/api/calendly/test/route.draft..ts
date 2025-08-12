import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const { CALENDLY_API_KEY } = process.env;

// Test endpoint to verify Calendly API connection
export async function GET() {
  try {
    console.log("Testing Calendly API with key:", CALENDLY_API_KEY ? `${CALENDLY_API_KEY.substring(0, 10)}...` : 'NOT SET');
    
    if (!CALENDLY_API_KEY) {
      return NextResponse.json({
        success: false,
        error: "CALENDLY_API_KEY environment variable is not set"
      }, { status: 500 });
    }

    // Test direct API call
    const response = await axios.get('https://api.calendly.com/users/me', {
      headers: {
        'Authorization': `Bearer ${CALENDLY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return NextResponse.json({
      success: true,
      message: "Calendly API connection successful",
      user: {
        name: response.data.resource.name,
        email: response.data.resource.email,
        schedulingUrl: response.data.resource.scheduling_url,
        timezone: response.data.resource.timezone,
        uri: response.data.resource.uri
      }
    });

  } catch (error: any) {
    console.error("Calendly API test error:", error.response?.data || error.message);
    
    return NextResponse.json(
      { 
        success: false,
        error: "Calendly API connection failed",
        details: error.message,
        statusCode: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        apiKeyPreview: CALENDLY_API_KEY ? `${CALENDLY_API_KEY.substring(0, 10)}...` : 'NOT SET'
      },
      { status: 500 }
    );
  }
}
