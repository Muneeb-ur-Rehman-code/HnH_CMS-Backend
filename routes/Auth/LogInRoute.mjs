// routes/auth/login.mjs
import express from 'express';
import User from '../../models/Users/_UsersMain.mjs';
import StaffProfile from '../../models/Users/StaffProfile.mjs';
import { generateToken } from '../../middlewares/jwt.mjs';
import { USER_STATUS, USER_ROLE } from '../../models/Users/_UsersMain.mjs';

const router = express.Router();

// /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        if (user.status === USER_STATUS.SUSPENDED) {
            return res.status(403).json({
                success: false,
                message: 'Account is suspended. Please contact administrator.'
            });
        }

        if (!(await user.hasPasswordAsync())) {
            return res.status(400).json({
                success: false,
                message: 'Password not set. Please complete signup first.',
                code: 'PASSWORD_NOT_SET'
            });
        }

        const isPasswordValid = await user.verifyPassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // user.lastLogin = new Date();
        // await user.save();
        await user.updateLastLogin();

        // Generate token
        const token = generateToken({
            userId: user._id.toString(),
            email: user.email,
            role: user.role
        });

        // Prepare user data (without sensitive info)
        const userData = {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            status: user.status,
            emailVerified: await user.isEmailVerifiedAsync(),
            phoneVerified: await user.isPhoneVerifiedAsync(),
            phoneNumber: user.phone?.number || null,
            dateOfBirth: user.dob || null,
            gender: user.gender,
            source: user.source
        };

        // Fetch staff profile if user is a staff member
        let staffData = null;
        if (user.role === USER_ROLE.STAFF) {
            const staffProfile = await StaffProfile.findByUserId(user._id);
            if (staffProfile) {
                staffData = {
                    id: staffProfile._id,
                    staffRole: staffProfile.staffRole,
                    verificationStatus: staffProfile.verificationStatus,
                    isVerified: staffProfile.isVerified,
                };
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: userData,
                staff: staffData,
                token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during login',
            error: error.message
        });
    }
});

// /api/auth/logout
router.post('/logout', (req, res) => {
    // Dummy endpoint
    return res.status(200).json({
        success: true,
        message: 'Logout successful. Please clear your token.'
    });
});

export default router;