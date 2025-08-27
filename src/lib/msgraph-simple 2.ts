// Simple Microsoft Graph email implementation using built-in fetch
// This avoids the problematic @azure/identity package

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

async function getAccessToken(): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing Azure configuration. Check AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default'
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const tokenData: TokenResponse = await response.json();
  return tokenData.access_token;
}

export async function sendMailViaGraph(to: string, subject: string, html: string): Promise<void> {
  try {
    const accessToken = await getAccessToken();
    const senderUPN = process.env.MSGRAPH_SENDER_UPN;

    if (!senderUPN) {
      throw new Error('Missing MSGRAPH_SENDER_UPN configuration');
    }

    const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderUPN)}/sendMail`;
    
    const emailBody = {
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: html
        },
        toRecipients: [
          {
            emailAddress: {
              address: to
            }
          }
        ]
      },
      saveToSentItems: false
    };

    const response = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Graph sendMail failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log('Email sent successfully via Microsoft Graph');
    
    // Only try to parse JSON if there's content
    const responseText = await response.text();
    if (responseText.trim()) {
      try {
        const responseData = JSON.parse(responseText);
        console.log('Microsoft Graph Response:', JSON.stringify(responseData, null, 2));
      } catch (parseError) {
        console.log('Response text (not JSON):', responseText);
      }
    } else {
      console.log('Microsoft Graph returned empty response (success)');
    }
  } catch (error) {
    console.error('Error sending email via Microsoft Graph:', error);
    throw error;
  }
}

// Password reset email function
export async function sendPasswordResetEmailGraph(
  email: string,
  resetToken: string,
  userName: string
): Promise<void> {
  const resetUrl = `${process.env.APP_BASE_URL || process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  const subject = 'Password Reset Request - MentorAll';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 24px;">🔐 Password Reset Request</h2>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 16px;">MentorAll</p>
      </div>
      
      <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          Hi ${userName},
        </p>
        
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          We received a request to reset your password for your MentorAll account. 
          If you didn't make this request, you can safely ignore this email.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background: #007bff; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 6px; font-weight: bold; 
                    display: inline-block; font-size: 16px;">
            Reset My Password
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          This link will expire in 1 hour for security reasons. 
          If you have any questions, please contact our support team.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #999; font-size: 12px; text-align: center;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${resetUrl}" style="color: #007bff;">${resetUrl}</a>
        </p>
      </div>
    </div>
  `;

  await sendMailViaGraph(email, subject, html);
}

// Success email function
export async function sendPasswordResetSuccessEmailGraph(
  email: string,
  userName: string
): Promise<void> {
  const signinUrl = `${process.env.APP_BASE_URL || process.env.FRONTEND_URL}/signin`;
  
  const subject = 'Password Successfully Reset - MentorAll';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 24px;">✅ Password Reset Successful</h2>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 16px;">MentorAll</p>
      </div>
      
      <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          Hi ${userName},
        </p>
        
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          Your password has been successfully reset. You can now sign in to your MentorAll account 
          using your new password.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${signinUrl}" 
             style="background: #28a745; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 6px; font-weight: bold; 
                    display: inline-block; font-size: 16px;">
            Sign In Now
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          If you didn't request this password reset, please contact our support team immediately 
          as your account may have been compromised.
        </p>
      </div>
    </div>
  `;

  await sendMailViaGraph(email, subject, html);
}
