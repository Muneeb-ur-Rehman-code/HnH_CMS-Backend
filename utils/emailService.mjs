import Mailjet from 'node-mailjet';
import { X, T } from "../config/constants.mjs";

// ============================================
// MAILJET CLIENT
// ============================================

const mailjet = new Mailjet({
    apiKey: process.env.MJ_API_KEY,
    apiSecret: process.env.MJ_API_SECRET,
});

// ============================================
// BASE TEMPLATE WRAPPER
// ============================================

const baseTemplate = (content, recipientEmail) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-bottom: 32px; border-bottom: 1px solid #e5e5e5;">
              <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #000000;">
                ${process.env.APP_NAME || 'Notification'}
              </h2>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 32px 0;">
              ${content}
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-top: 32px; border-top: 1px solid #e5e5e5; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #666;">
                This email was intended for <strong>${recipientEmail}</strong>
              </p>
              <p style="margin: 0; font-size: 12px; color: #999;">
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

const createButton = (text, url) => `
  <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
    <tr>
      <td style="background-color: #000; border-radius: 6px;">
        <a href="${url}" target="_blank" style="
          display: inline-block;
          padding: 14px 32px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          text-decoration: none;
        ">
          ${text}
        </a>
      </td>
    </tr>
  </table>
`;


// ============================================
// MAILJET SEND WRAPPER
// ============================================

const sendMail = async ({ to, subject, html }) => {
    return await mailjet
        .post("send", { version: "v3.1" })
        .request({
            Messages: [
                {
                    From: {
                        Email: process.env.MAILJET_FROM_EMAIL,
                        Name: process.env.APP_NAME,
                    },
                    To: [{ Email: to }],
                    Subject: subject,
                    HTMLPart: html,
                },
            ],
        });
};


// ============================================
// 1. OTP EMAIL
// ============================================

export const sendOTPEmail = async (email, otp) => {
    const content = `
    <div style="text-align: center;">
      <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 600;">Verification Code</h1>
      <p style="margin: 0 0 32px; color: #666;">Use the code below to verify</p>

      <div style="
        display: inline-block;
        padding: 20px 40px;
        background-color: #f9f9f9;
        border: 2px solid #000;
        border-radius: 8px;
      ">
        <span style="
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 8px;
          font-family: 'Courier New', monospace;
          color: #000;
        ">
          ${otp}
        </span>
      </div>

      <p style="margin: 24px 0 0; font-size: 13px; color: #666;">
        This code expires in <strong>10 minutes</strong>
      </p>
    </div>
  `;

    return await sendMail({
        to: email,
        subject: `${otp} is your verification code`,
        html: baseTemplate(content, email),
    });
};


// ============================================
// 2. STAFF APPROVED EMAIL
// ============================================

export const sendStaffApprovedEmail = async (email, role) => {
    const loginUrl = `${process.env.FRONTEND_URL}/login`;

    const content = `
    <div style="text-align:center;">
      <h1 style="margin:0 0 8px; font-size:28px; font-weight:600;">Congratulations!</h1>
      <p style="margin:0 0 32px; color:#666;">Your account has been approved</p>

      <div style="
        padding:24px;
        background:#f9f9f9;
        border:1px solid #e5e5e5;
        border-radius:8px;
      ">
        <p style="margin:0 0 8px; color:#666;">You are approved as</p>
        <p style="margin:0; font-size:22px; font-weight:700; text-transform:capitalize;">
          ${role}
        </p>
      </div>

      ${createButton("Login to Your Account", loginUrl)}
    </div>
  `;

    return await sendMail({
        to: email,
        subject: `Account Approved - Welcome as ${role}`,
        html: baseTemplate(content, email),
    });
};


// ============================================
// 3. STUDENT APPROVAL EMAIL
// ============================================

export const sendStudentApprovalEmail = async (email, consultantName = 'Your Consultant') => {
    const loginUrl = `${process.env.FRONTEND_URL}/login`;

    const content = `
    <div style="text-align:center;">
      <h1 style="margin:0 0 8px; font-size:24px; font-weight:600;">Your Account Has Been Created</h1>
      <p style="margin:0 0 32px; color:#666;">Welcome aboard!</p>

      <div style="
        padding:24px;
        background:#f9f9f9;
        border:1px solid #e5e5e5;
        border-radius:8px;
        text-align:left;
      ">
        <p style="margin:0 0 16px;">Created by <strong>${consultantName}</strong>.</p>
        <p style="margin:0;">Login to start your application journey.</p>
      </div>

      ${createButton("Login to Get Started", loginUrl)}
    </div>
  `;

    return await sendMail({
        to: email,
        subject: "Your Account Has Been Created",
        html: baseTemplate(content, email),
    });
};


// ============================================
// 4. GENERIC NOTIFICATION EMAIL
// ============================================

export const sendNotificationEmail = async (email, message, subject = 'Notification') => {
    const dashboardUrl = `${process.env.FRONTEND_URL}/dashboard`;

    const content = `
    <div>
      <h1 style="text-align:center; margin:0 0 24px; font-size:22px;">${subject}</h1>

      <div style="
        padding:24px;
        background:#f9f9f9;
        border:1px solid #e5e5e5;
        border-radius:8px;
      ">
        <p style="margin:0; font-size:15px; line-height:1.7;">
          ${message}
        </p>
      </div>

      ${createButton("Go to Dashboard", dashboardUrl)}
    </div>
  `;

    return await sendMail({
        to: email,
        subject,
        html: baseTemplate(content, email),
    });
};


// ============================================
// VERIFY CONNECTION
// ============================================

export const verifyEmailConnection = async () => {
    try {
        await mailjet.get("sender").request();
        console.log(T + "Mailjet API connected successfully");
        return true;
    } catch (error) {
        console.error(X + "Mailjet connection failed:", error.message);
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
