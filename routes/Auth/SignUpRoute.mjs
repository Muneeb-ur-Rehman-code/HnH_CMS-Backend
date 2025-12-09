// routes/auth/signup.mjs
import express from 'express';
import User from '../../models/Users/_UsersMain.mjs';
import { sendOTPEmail } from '../../utils/emailService.mjs';
import { sendOTPviaSMS } from '../../utils/smsService.mjs';
import { optionalAttachUser } from '../../middlewares/Auth.mjs';
import { generateToken, verifyToken } from '../../middlewares/jwt.mjs';
import { attachUser } from '../../middlewares/Auth.mjs';

const router = express.Router();

// Helper to extract and verify an action token from request
const requireActionToken = (req, res) => {
    const authHeader = req.headers.authorization || req.body.token || req.query.token;
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Authorization token required' });
        return null;
    }

    try {
        const decoded = verifyToken(authHeader);
        return decoded;
    } catch (err) {
        res.status(401).json({ success: false, message: err.message || 'Invalid token' });
        return null;
    }
};





//  /api/auth/signup/send-email-otp
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
        if (user) {
            const hasPassword = await user.hasPasswordAsync();
            if (hasPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'User already exists. Please login.',
                    code: 'USER_EXISTS'
                });
            }
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

        // Check for cooldown error
        if (error.message.includes('Please wait')) {
            return res.status(429).json({
                success: false,
                message: error.message,
                code: 'COOLDOWN_ACTIVE'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to send OTP',
            error: error.message
        });
    }
});

// /api/auth/signup/verify-email-otp
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

        // Generate a short-lived action token for completing signup (setting password)
        const token = generateToken({ userId: user._id.toString(), purpose: 'set_password' }, { expiresIn: '15m' });

        return res.status(200).json({
            success: true,
            message: 'Email verified successfully',
            data: {
                email: normalizedEmail,
                emailVerified: true,
                token
            }
        });

    } catch (error) {
        console.error('Verify email OTP error:', error);

        // Check for common OTP errors
        if (error.message.includes('Invalid OTP')) {
            return res.status(400).json({
                success: false,
                message: error.message,
                code: 'INVALID_OTP'
            });
        }

        if (error.message.includes('expired') || error.message.includes('exceeded')) {
            return res.status(400).json({
                success: false,
                message: error.message,
                code: 'OTP_ERROR'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to verify OTP',
            error: error.message
        });
    }
});

// /api/auth/signup/resend-email-otp 
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
        if (await user.isEmailVerifiedAsync()) {
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

        // Check for cooldown error
        if (error.message.includes('Please wait')) {
            return res.status(429).json({
                success: false,
                message: error.message,
                code: 'COOLDOWN_ACTIVE'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to resend OTP',
            error: error.message
        });
    }
});

// /api/auth/signup/set-password
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

        // Require action token issued after email verification
        const decoded = requireActionToken(req, res);
        if (!decoded) return; // response already sent by helper

        if (decoded.purpose !== 'set_password') {
            return res.status(403).json({ success: false, message: 'Invalid token purpose' });
        }

        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Ensure token belongs to this email (extra safety)
        if (user.email && user.email.toLowerCase().trim() !== normalizedEmail) {
            return res.status(403).json({ success: false, message: 'Token does not match email' });
        }

        // Check if password already set
        if (await user.hasPasswordAsync()) {
            return res.status(400).json({
                success: false,
                message: 'Password already set. Please use login or password reset.',
                code: 'PASSWORD_ALREADY_SET'
            });
        }

        // Set password (will be hashed by pre-save hook)
        await user.setPassword(password);
        // await user.save();

        // Issue a normal auth token (uses default expiry from env/JWT_EXPIRY)
        const authToken = generateToken({ userId: user._id.toString() });

        user.updateLastLogin();

        return res.status(200).json({
            success: true,
            message: 'Password set successfully',
            data: {
                email: normalizedEmail,
                token: authToken
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

// /api/auth/signup/send-phone-otp
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

        // Require a valid token (either action token or regular auth) matching this user
        const decoded = requireActionToken(req, res);
        if (!decoded) return;

        const user = await User.findById(decoded.userId);

        if (!user || (user.email && user.email.toLowerCase().trim() !== normalizedEmail)) {
            return res.status(404).json({
                success: false,
                message: 'User not found or token mismatch'
            });
        }

        // Check if password is set
        if (!(await user.hasPasswordAsync())) {
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

        // Send OTP (model method)
        const result = await user.setPhoneAndGenerateOtp(phoneNumber);

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

        // Check for cooldown error
        if (error.message.includes('Please wait')) {
            return res.status(429).json({
                success: false,
                message: error.message,
                code: 'COOLDOWN_ACTIVE'
            });
        }

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

// /api/auth/signup/verify-phone-otp
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

        // Require a valid token and ensure it matches the user
        const decoded = requireActionToken(req, res);
        if (!decoded) return;

        const user = await User.findById(decoded.userId);

        if (!user || (user.email && user.email.toLowerCase().trim() !== normalizedEmail)) {
            return res.status(404).json({ success: false, message: 'User not found or token mismatch' });
        }

        // Verify OTP
        const result = await user.verifyPhoneOtp(otp);

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

        // Check for common OTP errors
        if (error.message.includes('Please wait')) {
            return res.status(429).json({
                success: false,
                message: error.message,
                code: 'COOLDOWN_ACTIVE'
            });
        }

        if (error.message.includes('Invalid OTP')) {
            return res.status(400).json({
                success: false,
                message: error.message,
                code: 'INVALID_OTP'
            });
        }

        if (error.message.includes('expired') || error.message.includes('exceeded')) {
            return res.status(400).json({
                success: false,
                message: error.message,
                code: 'OTP_ERROR'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to verify OTP',
            error: error.message
        });
    }
});

// /api/auth/signup/resend-phone-otp
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

        // Require token and ensure it matches the user
        const decoded = requireActionToken(req, res);
        if (!decoded) return;

        const user = await User.findById(decoded.userId);

        if (!user || (user.email && user.email.toLowerCase().trim() !== normalizedEmail)) {
            return res.status(404).json({ success: false, message: 'User not found or token mismatch' });
        }

        if (!user.phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number not set'
            });
        }

        // Check if already verified
        if (await user.isPhoneVerifiedAsync()) {
            return res.status(400).json({
                success: false,
                message: 'Phone already verified'
            });
        }

        // Send OTP
        const result = await user.resendPhoneOtp();

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

        // Check for cooldown error
        if (error.message.includes('Please wait')) {
            return res.status(429).json({
                success: false,
                message: error.message,
                code: 'COOLDOWN_ACTIVE'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to resend OTP',
            error: error.message
        });
    }
});

// /api/auth/signup/del-phone
router.delete('/del-phone', attachUser, async (req, res) => {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        if (!user.phone.number) {
            return res.status(400).json({
                success: false,
                message: 'Phone number not set'
            });
        }

        user.phone.number = null;
        await user.save();
        return res.status(200).json({
            success: true,
            message: 'Phone number deleted successfully'
        });

    }
    catch (error) {

    }
});

// /api/auth/signup/status
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

        // Use model helper that fetches sensitive fields to compute registration status
        const reg = await user.getRegistrationStatus();

        // if (reg.hasPassword) {
        //     return res.status(200).json({
        //         success: true,
        //         data: {
        //             exists: true,
        //             hasPassword: true,
        //             message: 'Please login'
        //         }
        //     });
        // }

        return res.status(200).json({
            success: true,
            data: {
                exists: true,
                hasPassword: reg.hasPassword,
                emailVerified: reg.isEmailVerified,
                // phoneVerified: reg.isPhoneVerified,
                firstName: reg.firstName ? true : false,
                currentStep: reg.currentStep
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

// /api/auth/signup/otp-cooldown
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
            cooldown = await user.getEmailOtpCooldownRemaining();
        } else if (type === 'phone') {
            cooldown = await user.getPhoneOtpCooldownRemaining();
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