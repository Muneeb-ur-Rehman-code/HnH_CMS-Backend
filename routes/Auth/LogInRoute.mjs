// routes/auth/login.mjs
import express from 'express';
import User from '../../models/Users/_UsersMain.mjs';
import { generateToken } from '../../middlewares/jwt.mjs';
import { USER_STATUS } from '../../models/Users/_UsersMain.mjs';

const router = express.Router();

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if account is deleted
        if (user.isDeleted) {
            return res.status(403).json({
                success: false,
                message: 'Account has been deleted. Please contact administrator.'
            });
        }

        // Check if account is suspended
        if (user.status === USER_STATUS.SUSPENDED) {
            return res.status(403).json({
                success: false,
                message: 'Account is suspended. Please contact administrator.'
            });
        }

        // Check if account is inactive
        if (user.status === USER_STATUS.INACTIVE) {
            return res.status(403).json({
                success: false,
                message: 'Account is inactive. Please contact administrator.'
            });
        }

        // Check if password is set
        if (!(await user.hasPasswordAsync())) {
            return res.status(400).json({
                success: false,
                message: 'Password not set. Please complete signup first.',
                code: 'PASSWORD_NOT_SET'
            });
        }

        // Verify password
        const isPasswordValid = await user.verifyPassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate token
        const token = generateToken({
            userId: user._id,
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
            phoneNumber: user.phoneNumber,
            dateOfBirth: user.dateOfBirth,
            gender: user.gender,
            source: user.source
        };

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: userData,
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

/**
 * POST /api/auth/logout
 * Logout (client-side should clear token)
 */
router.post('/logout', (req, res) => {
    // In a stateless JWT system, logout is handled client-side
    // This endpoint is optional and can be used for logging purposes
    return res.status(200).json({
        success: true,
        message: 'Logout successful. Please clear your token.'
    });
});

export default router;