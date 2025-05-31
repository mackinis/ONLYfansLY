
'use server';

import nodemailer from 'nodemailer';

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: parseInt(process.env.EMAIL_PORT || '587', 10) === 465, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, 
  },
});

export async function sendActivationEmail(
  to: string, 
  subject: string, 
  html: string,
  siteTitle: string // Added siteTitle parameter
): Promise<{ success: boolean; messageId?: string; error?: any }> {
  try {
    // Extract sender email address from EMAIL_FROM if it's in "Name <email>" format
    // For simplicity, we'll use EMAIL_USER as the sender address and dynamic siteTitle as display name.
    // If EMAIL_FROM is intended as the full "From" header, that could be used directly,
    // but using EMAIL_USER for the actual sender part aligns with typical SMTP auth.
    const fromAddress = process.env.EMAIL_USER; // This should be the email address authorized for sending
    
    const info = await transporter.sendMail({
      from: `"${siteTitle}" <${fromAddress}>`, // Use dynamic siteTitle as display name
      to,
      subject,
      html,
    });
    console.log('Activation Email sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending activation email:', error);
    if (error instanceof Error) {
        console.error('Nodemailer error message:', error.message);
        if ('responseCode' in error) {
            console.error('Nodemailer response code:', (error as any).responseCode);
        }
         if ('command' in error) {
            console.error('Nodemailer command:', (error as any).command);
        }
    }
    return { success: false, error };
  }
}
