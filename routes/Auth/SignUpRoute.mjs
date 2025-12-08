// routes/auth/signup.mjs
import express from 'express';
import User from '../../models/Users/_UsersMain.mjs';
import { sendOTPEmail } from '../../utils/emailService.mjs';
import { sendOTPviaSMS } from '../../utils/smsService.mjs';
import { optionalAttachUser } from '../../middlewares/Auth.mjs';

const router = express.Router();

// ============================================
// EMAIL VERIFICATION
// ============================================

/**
 * POST /api/auth/signup/send-email-otp
 * Send OTP to email for signup
 */
router.post('/send-email-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if user exists
        let user = await User.findOne({ email: normalizedEmail });

        // If user exists and has password, they should login
        if (user && user.password) {
            return res.status(400).json({
                success: false,
                message: 'User already exists. Please login.',
                code: 'USER_EXISTS'
            });
        }

        // If user doesn't exist, create new user
        if (!user) {
            user = await User.create({
                email: normalizedEmail
            });
        }

        // Send OTP
        const result = await user.generateEmailOtp();

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message,
                cooldown: result.cooldown
            });
        }

        // Send email
        await sendOTPEmail(normalizedEmail, result.otp);

        return res.status(200).json({
            success: true,
            message: 'OTP sent to your email',
            data: {
                email: normalizedEmail,
                expiresIn: 600 // 10 minutes in seconds
            }
        });

    } catch (error) {
        console.error('Send email OTP error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to send OTP',
            error: error.message
        });
    }
});

/**
 * POST /api/auth/signup/verify-email-otp
 * Verify email OTP
 */
router.post('/verify-email-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify OTP
        const result = await user.verifyEmailOtp(otp);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Email verified successfully',
            data: {
                email: normalizedEmail,
                emailVerified: true
            }
        });

    } catch (error) {
        console.error('Verify email OTP error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify OTP',
            error: error.message
        });
    }
});

/**
 * POST /api/auth/signup/resend-email-otp
 * Resend email OTP
 */
router.post('/resend-email-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if already verified
        if (user.emailVerified) {
            return res.status(400).json({
                success: false,
                message: 'Email already verified'
            });
        }

        // Send OTP
        const result = await user.generateEmailOtp();

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message,
                cooldown: result.cooldown
            });
        }

        // Send email
        await sendOTPEmail(normalizedEmail, result.otp);

        return res.status(200).json({
            success: true,
            message: 'OTP resent to your email'
        });

    } catch (error) {
        console.error('Resend email OTP error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to resend OTP',
            error: error.message
        });
    }
});

// ============================================
// PASSWORD SETUP
// ============================================

/**
 * POST /api/auth/signup/set-password
 * Set password for new user
 */
router.post('/set-password', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if email is verified
        if (!user.emailVerified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your email first',
                code: 'EMAIL_NOT_VERIFIED'
            });
        }

        // Check if password already set
        if (user.password) {
            return res.status(400).json({
                success: false,
                message: 'Password already set. Please use login or password reset.',
                code: 'PASSWORD_ALREADY_SET'
            });
        }

        // Set password (will be hashed by pre-save hook)
        user.password = password;
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Password set successfully',
            data: {
                email: normalizedEmail
            }
        });

    } catch (error) {
        console.error('Set password error:', error);

        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ')
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to set password',
            error: error.message
        });
    }
});

// ============================================
// PHONE VERIFICATION
// ============================================

/**
 * POST /api/auth/signup/send-phone-otp
 * Send OTP to phone number
 */
router.post('/send-phone-otp', async (req, res) => {
    try {
        const { email, phoneNumber } = req.body;

        if (!email || !phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Email and phone number are required'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if password is set
        if (!user.password) {
            return res.status(403).json({
                success: false,
                message: 'Please set password first',
                code: 'PASSWORD_NOT_SET'
            });
        }

        // Update phone number if changed
        if (user.phoneNumber !== phoneNumber) {
            user.phoneNumber = phoneNumber;
            user.phoneVerified = false;
            await user.save();
        }

        // Send OTP
        const result = await user.sendPhoneOTP();

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message,
                cooldown: result.cooldown
            });
        }

        // Send SMS
        await sendOTPviaSMS(phoneNumber, result.otp);

        return res.status(200).json({
            success: true,
            message: 'OTP sent to your phone',
            data: {
                phoneNumber,
                expiresIn: 600
            }
        });

    } catch (error) {
        console.error('Send phone OTP error:', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ')
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to send OTP',
            error: error.message
        });
    }
});

/**
 * POST /api/auth/signup/verify-phone-otp
 * Verify phone OTP
 */
router.post('/verify-phone-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify OTP
        const result = await user.verifyPhoneOTP(otp);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Phone verified successfully',
            data: {
                phoneNumber: user.phoneNumber,
                phoneVerified: true
            }
        });

    } catch (error) {
        console.error('Verify phone OTP error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify OTP',
            error: error.message
        });
    }
});

/**
 * POST /api/auth/signup/resend-phone-otp
 * Resend phone OTP
 */
router.post('/resend-phone-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number not set'
            });
        }

        // Check if already verified
        if (user.phoneVerified) {
            return res.status(400).json({
                success: false,
                message: 'Phone already verified'
            });
        }

        // Send OTP
        const result = await user.sendPhoneOTP();

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message,
                cooldown: result.cooldown
            });
        }

        // Send SMS
        await sendOTPviaSMS(user.phoneNumber, result.otp);

        return res.status(200).json({
            success: true,
            message: 'OTP resent to your phone'
        });

    } catch (error) {
        console.error('Resend phone OTP error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to resend OTP',
            error: error.message
        });
    }
});

// ============================================
// STATUS & COOLDOWN
// ============================================

/**
 * GET /api/auth/signup/status
 * Get signup status for a user
 */
router.get('/status', async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                data: {
                    exists: false
                }
            });
        }

        // Check if user has password (completed signup)
        if (user.password) {
            return res.status(200).json({
                success: true,
                data: {
                    exists: true,
                    hasPassword: true,
                    message: 'Please login'
                }
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                exists: true,
                hasPassword: false,
                emailVerified: user.emailVerified,
                phoneNumber: user.phoneNumber ? true : false,
                phoneVerified: user.phoneVerified,
                firstName: user.firstName ? true : false,
                currentStep: user.emailVerified
                    ? (user.password ? (user.phoneVerified ? 'basic-info' : 'phone-verification') : 'set-password')
                    : 'email-verification'
            }
        });

    } catch (error) {
        console.error('Get status error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get status',
            error: error.message
        });
    }
});

/**
 * GET /api/auth/signup/otp-cooldown
 * Get OTP cooldown times
 */
router.get('/otp-cooldown', async (req, res) => {
    try {
        const { email, type } = req.query;

        if (!email || !type) {
            return res.status(400).json({
                success: false,
                message: 'Email and type (email/phone) are required'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        let cooldown = null;

        if (type === 'email') {
            cooldown = user.getEmailOTPCooldown();
        } else if (type === 'phone') {
            cooldown = user.getPhoneOTPCooldown();
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid type. Use email or phone'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                canResend: cooldown === 0,
                cooldown,
                cooldownMinutes: Math.ceil(cooldown / 60)
            }
        });

    } catch (error) {
        console.error('Get cooldown error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get cooldown',
            error: error.message
        });
    }
});

export default router;