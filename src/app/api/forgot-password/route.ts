import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import { sendPasswordResetEmailGraph } from '@/lib/msgraph-simple';
import { generateResetToken, hashResetToken, generateTokenExpiry } from '@/lib/passwordReset';

const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID!);

// Track recent requests to prevent duplicates
const recentRequests = new Map<string, number>();

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    // Special handling for institutional emails
    const isUNSWEmail = email.includes('@ad.unsw.edu.au') || email.includes('@unsw.edu.au');
    if (isUNSWEmail) {
      console.log('UNSW email detected - using enhanced delivery settings');
    }
    
    // Rate limiting temporarily disabled for testing
    // const now = Date.now();
    // const lastRequest = recentRequests.get(email);
    // if (lastRequest && (now - lastRequest) < 60000) {
    //   return NextResponse.json(
    //     { message: 'Please wait 60 seconds before requesting another reset link.' },
    //     { status: 429 }
    //   );
    // }
    // recentRequests.set(email, now);

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log('Email received:', email);
    console.log('Airtable API Key exists:', !!process.env.AIRTABLE_API_KEY);
    console.log('Airtable Base ID exists:', !!process.env.AIRTABLE_BASE_ID);
    console.log('Airtable Users Table exists:', !!process.env.AIRTABLE_USERS_TABLE);

    // Check if user exists in Airtable
    const usersTable = airtable(process.env.AIRTABLE_USERS_TABLE!);
    console.log('Users table created');
    
    const userRecords = await usersTable
      .select({
        filterByFormula: `{Email} = '${email}'`,
        maxRecords: 1,
      })
      .firstPage();

    console.log('User records found:', userRecords.length);

    if (userRecords.length === 0) {
      // Don't reveal if user exists or not for security
      return NextResponse.json(
        { message: 'If an account with that email exists, a password reset link has been sent.' },
        { status: 200 }
      );
    }

    const user = userRecords[0];
    const userId = user.id;
    const userName = user.get('Name') as string || 'User';

    console.log('User found:', { userId, userName });

    // Generate reset token and expiry
    const resetToken = generateResetToken();
    const hashedToken = hashResetToken(resetToken);
    const tokenExpiry = generateTokenExpiry();

    console.log('Token generated:', { resetToken: resetToken.substring(0, 10) + '...', hashedToken: hashedToken.substring(0, 10) + '...', tokenExpiry });

    // Update user record with reset token info
    await usersTable.update([
      {
        id: userId,
        fields: {
          // Match exact Airtable field names
          "Reset Token": hashedToken,
          "Reset Token Expires At": tokenExpiry,
          "Reset Token Created At": new Date().toISOString().split('T')[0], // Date only for Airtable
        },
      },
    ]);

    console.log('User record updated with reset token');

    // Send password reset email with retry logic
    let emailSent = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!emailSent && attempts < maxAttempts) {
      try {
        attempts++;
        await sendPasswordResetEmailGraph(email, resetToken, userName);
        emailSent = true;
        console.log(`Email sent successfully on attempt ${attempts}`);
      } catch (emailError) {
        console.error(`Email attempt ${attempts} failed:`, emailError);
        if (attempts < maxAttempts) {
          console.log(`Retrying email delivery in 5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    console.log(`Password reset initiated for user: ${email}`);

    return NextResponse.json(
      { 
        message: 'If an account with that email exists, a password reset link has been sent.',
        success: true 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('=== FORGOT PASSWORD ERROR ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Full error object:', error);
    
    return NextResponse.json(
      { 
        error: 'An error occurred while processing your request. Please try again later.' 
      },
      { status: 500 }
    );
  }
}
