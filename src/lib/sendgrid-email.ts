import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Send password reset email using SendGrid
export const sendPasswordResetEmailSendGrid = async (
  email: string,
  resetToken: string,
  userName: string
) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SendGrid API key not configured');
    }

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const msg = {
      to: email,
      from: process.env.EMAIL_FROM || 'info@mentorall.io',
      subject: 'Password Reset Request - MentorAll',
      html: `
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
      `,
    };

    const response = await sgMail.send(msg);
    console.log('SendGrid email sent successfully:', response[0].statusCode);
    return { success: true, messageId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('SendGrid email error:', error);
    throw new Error(`SendGrid email failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Send password reset success email using SendGrid
export const sendPasswordResetSuccessEmailSendGrid = async (
  email: string,
  userName: string
) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SendGrid API key not configured');
    }

    const msg = {
      to: email,
      from: process.env.EMAIL_FROM || 'info@mentorall.io',
      subject: 'Password Successfully Reset - MentorAll',
      html: `
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
              <a href="${process.env.FRONTEND_URL}/signin" 
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
      `,
    };

    const response = await sgMail.send(msg);
    console.log('SendGrid success email sent:', response[0].statusCode);
    return { success: true, messageId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('SendGrid success email error:', error);
    throw new Error(`SendGrid success email failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
