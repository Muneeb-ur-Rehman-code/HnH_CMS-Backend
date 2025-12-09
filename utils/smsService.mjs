// utils/smsService.mjs

import { Vonage } from '@vonage/server-sdk';
import { X, T, E, P } from "../config/constants.mjs"

// ============================================
// VONAGE CLIENT CONFIGURATION
// ============================================

const vonage = new Vonage({
    apiKey: process.env.VONAGE_API_KEY,
    apiSecret: process.env.VONAGE_API_SECRET
});

const BRAND_NAME = process.env.VONAGE_BRAND_NAME || 'YourApp';
const FROM_NUMBER = process.env.VONAGE_FROM_NUMBER;
const WHATSAPP_NUMBER = process.env.VONAGE_WHATSAPP_NUMBER;


// ============================================
// HELPER: Format Phone Number
// ============================================

const formatPhoneNumber = (phone) => {
    // Remove all non-digit characters except leading +
    let formatted = phone.replace(/[^\d+]/g, '');

    // Remove leading + if present (Vonage expects just digits)
    if (formatted.startsWith('+')) {
        formatted = formatted.substring(1);
    }

    return formatted;
};


// ============================================
// 1. SEND OTP VIA SMS
// ============================================

export const sendOTPviaSMS = async (phone, otp) => {
    const formattedPhone = formatPhoneNumber(phone);
    // If running in development, do NOT send OTPs to external services.
    if (process.env.NODE_ENV === 'development') {
        console.log(P + `Development mode: skipping SMS OTP send to ${formattedPhone}. OTP: ${otp}`);
        return { success: true, skipped: true, otp };
    }

    console.log(P + `Sending SMS to ${formattedPhone} with OTP: ${otp}`);

    const message = `Your ${BRAND_NAME} verification code is: ${otp}. This code expires in 10 minutes. Do not share this code with anyone.`;

    try {
        const response = await vonage.sms.send({
            to: formattedPhone,
            from: BRAND_NAME,
            text: message
        });

        const messageResponse = response.messages[0];

        if (messageResponse.status === '0') {
            console.log(T + `SMS sent successfully to ${formattedPhone}`);
            return {
                success: true,
                messageId: messageResponse['message-id']
            };
        } else {
            console.error(X + `SMS failed: ${messageResponse['error-text']}`);
            return {
                success: false,
                error: messageResponse['error-text']
            };
        }
    } catch (error) {
        console.error(X + 'SMS sending error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
};


// ============================================
// 2. SEND OTP VIA WHATSAPP
// ============================================

export const sendOTPviaWhatsApp = async (phone, otp) => {
    const formattedPhone = formatPhoneNumber(phone);

    // If running in development, do NOT send OTPs to external services.
    if (process.env.NODE_ENV === 'development') {
        console.log(P + `Development mode: skipping WhatsApp OTP send to ${formattedPhone}. OTP: ${otp}`);
        return { success: true, skipped: true, otp };
    }

    const message = `Your ${BRAND_NAME} verification code is: *${otp}*\n\nThis code expires in 10 minutes.\n\n_Do not share this code with anyone._`;

    try {
        const response = await vonage.messages.send({
            message_type: 'text',
            to: formattedPhone,
            from: WHATSAPP_NUMBER,
            channel: 'whatsapp',
            text: message
        });

        console.log(T + `WhatsApp message sent successfully to ${formattedPhone}`);
        return {
            success: true,
            messageId: response.message_uuid
        };
    } catch (error) {
        console.error(X + 'WhatsApp sending error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
};


// ============================================
// 3. SEND CUSTOM SMS
// ============================================

export const sendSMS = async (phone, message) => {
    const formattedPhone = formatPhoneNumber(phone);

    try {
        const response = await vonage.sms.send({
            to: formattedPhone,
            from: BRAND_NAME,
            text: message
        });

        const messageResponse = response.messages[0];

        if (messageResponse.status === '0') {
            return { success: true, messageId: messageResponse['message-id'] };
        } else {
            return { success: false, error: messageResponse['error-text'] };
        }
    } catch (error) {
        console.error(X + 'SMS error:', error.message);
        return { success: false, error: error.message };
    }
};


// ============================================
// 4. SEND CUSTOM WHATSAPP MESSAGE
// ============================================

export const sendWhatsApp = async (phone, message) => {
    const formattedPhone = formatPhoneNumber(phone);

    try {
        const response = await vonage.messages.send({
            message_type: 'text',
            to: formattedPhone,
            from: WHATSAPP_NUMBER,
            channel: 'whatsapp',
            text: message
        });

        return { success: true, messageId: response.message_uuid };
    } catch (error) {
        console.error(X + 'WhatsApp error:', error.message);
        return { success: false, error: error.message };
    }
};


// ============================================
// 5. SEND NOTIFICATION (Auto-selects method)
// ============================================

export const sendNotification = async (phone, message, preferWhatsApp = false) => {
    if (preferWhatsApp) {
        const whatsappResult = await sendWhatsApp(phone, message);
        if (whatsappResult.success) return whatsappResult;
        // Fallback to SMS if WhatsApp fails
        console.log('WhatsApp failed, falling back to SMS...');
    }
    return await sendSMS(phone, message);
};


// ============================================
// 6. VERIFY VONAGE CONNECTION
// ============================================

export const verifySMSConnection = async () => {
    try {
        // Check if credentials are configured
        if (!process.env.VONAGE_API_KEY || !process.env.VONAGE_API_SECRET) {
            console.warn(E + 'Vonage credentials not configured');
            return false;
        }

        // Get account balance as a connection test
        const balance = await vonage.accounts.getBalance();
        console.log(T + `Vonage connected. Balance: €${balance.value}`);
        return true;
    } catch (error) {
        console.error(X + 'Vonage connection failed:', error.message);
        return false;
    }
};


// ============================================
// DEFAULT EXPORT
// ============================================

export default {
    sendOTPviaSMS,
    sendOTPviaWhatsApp,
    sendSMS,
    sendWhatsApp,
    sendNotification,
    verifySMSConnection
};