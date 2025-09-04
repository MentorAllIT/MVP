import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import * as bcrypt from 'bcrypt';
import { sendPasswordResetSuccessEmailGraph } from '../../../lib/msgraph-simple';
import { hashResetToken, isTokenExpired, isValidTokenFormat } from '../../../lib/passwordReset';

const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID!);

export async function POST(request: NextRequest) {
  console.log('=== RESET PASSWORD API CALLED ===');
  console.log('Request received at:', new Date().toISOString());
  console.log('Request headers:', Object.fromEntries(request.headers.entries()));
  
  try {
    console.log('Parsing request body...');
    const body = await request.text();
    console.log('Raw request body:', body);
    
    const { token, password, confirmPassword } = JSON.parse(body);
    console.log('Request body parsed successfully');
    console.log('Token exists:', !!token);
    console.log('Password exists:', !!password);
    console.log('Confirm password exists:', !!confirmPassword);

    // Validate input
    if (!token || !password || !confirmPassword) {
      return NextResponse.json(
        { error: 'Token, password, and confirm password are required' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    console.log('Received token:', JSON.stringify(token));
    console.log('Token length:', token?.length);
    console.log('Token type:', typeof token);
    console.log('Is valid format:', isValidTokenFormat(token));
    
    if (!isValidTokenFormat(token)) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 400 }
      );
    }

    // Hash the provided token to compare with stored hash
    const hashedToken = hashResetToken(token);
    console.log('Hashed token for lookup:', hashedToken.substring(0, 10) + '...');

    // Find user with this reset token
    const usersTable = airtable(process.env.AIRTABLE_USERS_TABLE!);
    console.log('Searching Airtable for token...');
    
    const userRecords = await usersTable
      .select({
        filterByFormula: `{Reset Token} = '${hashedToken}'`,
        maxRecords: 1,
      })
      .firstPage();

    console.log('User records found:', userRecords.length);
    
    if (userRecords.length === 0) {
      console.log('No user found with this reset token');
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    const user = userRecords[0];
    const tokenExpiry = user.get('Reset Token Expires At') as string;
    const userEmail = user.get('Email') as string;
    const userName = user.get('Name') as string || 'User';

    console.log('Found user:', userEmail);
    console.log('Token expiry:', tokenExpiry);
    console.log('Is token expired:', isTokenExpired(tokenExpiry));

    // Check if token is expired
    if (isTokenExpired(tokenExpiry)) {
      console.log('Token has expired');
      return NextResponse.json(
        { error: 'Reset token has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update user's password and clear reset token
    await usersTable.update([
      {
        id: user.id,
        fields: {
          Password: hashedPassword,
          "Reset Token": '', // Clear the reset token
          // Note: We don't update date fields to avoid Airtable parsing errors
          // The date fields will remain as they are, which is fine for security
        },
      },
    ]);

    // Send success email
    try {
      await sendPasswordResetSuccessEmailGraph(userEmail, userName);
    } catch (emailError) {
      console.error('Failed to send success email:', emailError);
      // Don't fail the password reset if email fails
    }

    console.log(`Password successfully reset for user: ${userEmail}`);

    return NextResponse.json(
      { 
        message: 'Password has been successfully reset. You can now sign in with your new password.',
        success: true 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in reset password:', error);
    
    return NextResponse.json(
      { 
        error: 'An error occurred while resetting your password. Please try again later.' 
      },
      { status: 500 }
    );
  }
}
