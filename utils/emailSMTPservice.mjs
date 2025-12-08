import nodemailer from 'nodemailer';
import {X, T} from "../config/constants.mjs"

// ============================================
// TRANSPORTER CONFIGURATION
// ============================================

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ============================================
// BASE TEMPLATE WRAPPER
// ============================================

const baseTemplate = (content, recipientEmail) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email</title>
</head>
<body style="
  margin: 0; 
  padding: 0; 
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background-color: #ffffff;
  color: #000000;
  line-height: 1.6;
">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto;">
    <tr>
      <td style="padding: 40px 24px;">
        
        <!-- Header -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-bottom: 32px; border-bottom: 1px solid #e5e5e5;">
              <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #000000;">
                ${process.env.APP_NAME || 'Notification'}
              </h2>
            </td>
          </tr>
        </table>

        <!-- Content -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 32px 0;">
              ${content}
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-top: 32px; border-top: 1px solid #e5e5e5; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #666666;">
                This email was intended for <strong style="color: #000000;">${recipientEmail}</strong>
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                If you did not expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`;

// ============================================
// REUSABLE BUTTON COMPONENT
// ============================================

const createButton = (text, url) => `
  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
    <tr>
      <td style="
        background-color: #000000;
        border-radius: 6px;
      ">
        <a href="${url}" target="_blank" style="
          display: inline-block;
          padding: 14px 32px;
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          text-decoration: none;
        ">
          ${text}
        </a>
      </td>
    </tr>
  </table>
`;

// ============================================
// 1. OTP EMAIL
// ============================================

export const sendOTPEmail = async (email, otp) => {
  const content = `
    <div style="text-align: center;">
      <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #000000;">
        Verification Code
      </h1>
      <p style="margin: 0 0 32px 0; font-size: 15px; color: #666666;">
        Use the code below to complete your verification
      </p>
      
      <!-- OTP Box -->
      <div style="
        display: inline-block;
        padding: 20px 40px;
        background-color: #f9f9f9;
        border: 2px solid #000000;
        border-radius: 8px;
      ">
        <span style="
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 8px;
          color: #000000;
          font-family: 'Courier New', monospace;
        ">
          ${otp}
        </span>
      </div>
      
      <p style="margin: 24px 0 0 0; font-size: 13px; color: #666666;">
        This code expires in <strong style="color: #000000;">10 minutes</strong>
      </p>
      <p style="margin: 8px 0 0 0; font-size: 13px; color: #999999;">
        Do not share this code with anyone.
      </p>
    </div>
  `;

  const mailOptions = {
    from: `"${process.env.APP_NAME}" <${process.env.SMTP_FROM}>`,
    to: email,
    subject: `${otp} is your verification code`,
    html: baseTemplate(content, email),
  };

  return await transporter.sendMail(mailOptions);
};

// ============================================
// 2. STAFF APPROVED EMAIL
// ============================================

export const sendStaffApprovedEmail = async (email, role) => {
  const loginUrl = `${process.env.FRONTEND_URL}/login`;
  
  const content = `
    <div style="text-align: center;">
      <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 600; color: #000000;">
        Congratulations!
      </h1>
      <p style="margin: 0 0 32px 0; font-size: 16px; color: #666666;">
        Your account has been approved
      </p>
      
      <!-- Role Box -->
      <div style="
        padding: 24px;
        background-color: #f9f9f9;
        border: 1px solid #e5e5e5;
        border-radius: 8px;
        margin-bottom: 8px;
      ">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #666666;">
          You have been approved by the administrator as
        </p>
        <p style="margin: 0; font-size: 22px; font-weight: 700; color: #000000; text-transform: capitalize;">
          ${role}
        </p>
      </div>
      
      <p style="margin: 24px 0 0 0; font-size: 15px; color: #333333;">
        Please login to continue with your account.
      </p>
      
      ${createButton('Login to Your Account', loginUrl)}
    </div>
  `;

  const mailOptions = {
    from: `"${process.env.APP_NAME}" <${process.env.SMTP_FROM}>`,
    to: email,
    subject: `Account Approved - Welcome as ${role}`,
    html: baseTemplate(content, email),
  };

  return await transporter.sendMail(mailOptions);
};

// ============================================
// 3. STUDENT APPROVAL EMAIL
// ============================================

export const sendStudentApprovalEmail = async (email, consultantName = 'Your Consultant') => {
  const loginUrl = `${process.env.FRONTEND_URL}/login`;
  
  const content = `
    <div style="text-align: center;">
      <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #000000;">
        Your Account Has Been Created
      </h1>
      <p style="margin: 0 0 32px 0; font-size: 16px; color: #666666;">
        Welcome aboard! Your journey starts here.
      </p>
      
      <!-- Info Box -->
      <div style="
        padding: 24px;
        background-color: #f9f9f9;
        border: 1px solid #e5e5e5;
        border-radius: 8px;
        text-align: left;
      ">
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #333333;">
          Your account has been created by <strong style="color: #000000;">${consultantName}</strong>.
        </p>
        <p style="margin: 0; font-size: 15px; color: #333333;">
          Your application process has officially started. Login to view your dashboard and track your progress.
        </p>
      </div>
      
      <div style="text-align: center;">
        ${createButton('Login to Get Started', loginUrl)}
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"${process.env.APP_NAME}" <${process.env.SMTP_FROM}>`,
    to: email,
    subject: 'Your Account Has Been Created - Application Process Started',
    html: baseTemplate(content, email),
  };

  return await transporter.sendMail(mailOptions);
};

// ============================================
// 4. NOTIFICATION EMAIL (GENERIC CANVAS)
// ============================================

export const sendNotificationEmail = async (email, message, subject = 'Notification') => {
  const dashboardUrl = `${process.env.FRONTEND_URL}/dashboard`;
  
  const content = `
    <div>
      <h1 style="margin: 0 0 24px 0; font-size: 22px; font-weight: 600; color: #000000; text-align: center;">
        ${subject}
      </h1>
      
      <!-- Message Box -->
      <div style="
        padding: 24px;
        background-color: #f9f9f9;
        border: 1px solid #e5e5e5;
        border-radius: 8px;
      ">
        <p style="margin: 0; font-size: 15px; color: #333333; line-height: 1.7;">
          ${message}
        </p>
      </div>
      
      <div style="text-align: center;">
        ${createButton('Go to Dashboard', dashboardUrl)}
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"${process.env.APP_NAME}" <${process.env.SMTP_FROM}>`,
    to: email,
    subject: subject,
    html: baseTemplate(content, email),
  };

  return await transporter.sendMail(mailOptions);
};

// ============================================
// VERIFY EMAIL CONNECTION
// ============================================

export const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log(T + 'Email service connected successfully');
    return true;
  } catch (error) {
    console.error(X + 'Email service connection failed:', error.message);
    return false;
  }
};

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  sendOTPEmail,
  sendStaffApprovedEmail,
  sendStudentApprovalEmail,
  sendNotificationEmail,
  verifyEmailConnection,
};