// routes/auth/signup-staff.mjs
import express from 'express';
import User from '../../models/Users/_UsersMain.mjs';
import StaffProfile from '../../models/Users/StaffProfile.mjs';
import { USER_ROLE, USER_SOURCE, USER_STATUS } from '../../models/Users/_UsersMain.mjs';
import { STAFF_ROLE, STAFF_VERIFICATION_STATUS } from '../../models/Users/StaffProfile.mjs';
import { sendOTPEmail } from '../../utils/emailService.mjs';
import { generateToken } from '../../middlewares/jwt.mjs';

const router = express.Router();


// /api/auth/signup-staff/send-email-otp
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

        let user = await User.findOne({ email: normalizedEmail });

        if (user) {
            if (await user.hasPasswordAsync()) {
                return res.status(400).json({
                    success: false,
                    message: 'User already exists. Please login.',
                    code: 'USER_EXISTS'
                });
            }
        }

        if (!user) {
            user = await User.create({
                email: normalizedEmail,
                role: USER_ROLE.STAFF,
                source: USER_SOURCE.ONLINE
            });
        } else {
            const hasPasswordExisting = await user.hasPasswordAsync();
            if (!hasPasswordExisting && user.role === USER_ROLE.STUDENT) {
                user.role = USER_ROLE.STAFF;
                await user.save();
            }
        }

        const result = await user.generateEmailOtp();

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message,
                cooldown: result.cooldown
            });
        }

        await sendOTPEmail(normalizedEmail, result.otp);

        return res.status(200).json({
            success: true,
            message: 'OTP sent to your email',
            data: {
                email: normalizedEmail,
                expiresIn: 600
            }
        });

    } catch (error) {
        console.error('Send staff email OTP error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to send OTP',
            error: error.message
        });
    }
});

// /api/auth/signup-staff/verify-email-otp
router.post('/verify-email-otp', async (req, res) => {
    try {
        const { email, otp, staffRole } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        if (!staffRole) {
            return res.status(400).json({
                success: false,
                message: 'Staff role is required'
            });
        }

        const validStaffRoles = Object.values(STAFF_ROLE);
        if (!validStaffRoles.includes(staffRole)) {
            return res.status(400).json({
                success: false,
                message: `Invalid staff role. Valid roles: ${validStaffRoles.join(', ')}`
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

        const result = await user.verifyEmailOtp(otp);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        let staffProfile = await StaffProfile.findOne({ userId: user._id });

        if (!staffProfile) {
            staffProfile = await StaffProfile.create({
                userId: user._id,
                staffRole,
                verificationStatus: STAFF_VERIFICATION_STATUS.UNVERIFIED
            });
        } else {
            staffProfile.staffRole = staffRole;
            staffProfile.verificationStatus = STAFF_VERIFICATION_STATUS.UNVERIFIED;
            await staffProfile.save();
        }

        const token = generateToken({ userId: user._id.toString(), purpose: 'set_password' }, { expiresIn: '15m' });

        return res.status(200).json({
            success: true,
            message: 'Email verified successfully. Your staff account is pending verification by an administrator.',
            data: {
                email: normalizedEmail,
                emailVerified: true,
                staffRole,
                verificationStatus: STAFF_VERIFICATION_STATUS.UNVERIFIED,
                token
            }
        });

    } catch (error) {
        console.error('Verify staff email OTP error:', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ')
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to verify OTP',
            error: error.message
        });
    }
});

// /api/auth/signup-staff/resend-email-otp
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

        if (await user.isEmailVerifiedAsync()) {
            return res.status(400).json({
                success: false,
                message: 'Email already verified'
            });
        }

        const result = await user.sendEmailOTP();

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message,
                cooldown: result.cooldown
            });
        }

        await sendOTPEmail(normalizedEmail, result.otp);

        return res.status(200).json({
            success: true,
            message: 'OTP resent to your email'
        });

    } catch (error) {
        console.error('Resend staff email OTP error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to resend OTP',
            error: error.message
        });
    }
});

// /api/auth/signup-staff/status
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

        const reg = await user.getRegistrationStatus();

        const staffProfile = await StaffProfile.findOne({ userId: user._id });

        if (reg.hasPassword) {
            return res.status(200).json({
                success: true,
                data: {
                    exists: true,
                    hasPassword: true,
                    emailVerified: reg.isEmailVerified,
                    // phoneNumber: reg.phoneNumber ? true : false,
                    // phoneVerified: reg.isPhoneVerified,
                    staffRole: staffProfile?.staffRole || null,
                    verificationStatus: staffProfile?.verificationStatus || null,
                    message: staffProfile?.verificationStatus === STAFF_VERIFICATION_STATUS.VERIFIED
                        ? 'Please login'
                        : 'Staff account pending verification'
                }
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                exists: true,
                hasPassword: false,
                emailVerified: reg.isEmailVerified,
                // phoneNumber: reg.phoneNumber ? true : false,
                // phoneVerified: reg.isPhoneVerified,
                staffRole: staffProfile?.staffRole || null,
                verificationStatus: staffProfile?.verificationStatus || null,
                currentStep: reg.currentStep
            }
        });

    } catch (error) {
        console.error('Get staff status error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get status',
            error: error.message
        });
    }
});

export default router;