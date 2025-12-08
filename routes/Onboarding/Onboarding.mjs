// routes/onboarding/onboarding.mjs
import express from 'express';
import User from '../../models/Users/_UsersMain.mjs';
import { attachUser, requireAuth, requireEmailVerified, requirePasswordSet, requirePhoneVerified } from '../../middlewares/Auth.mjs';
import { generateToken } from '../../middlewares/jwt.mjs';

const router = express.Router();


// /api/onboarding/basic-info
router.post('/basic-info', attachUser, requireAuth, requireEmailVerified, requirePasswordSet, requirePhoneVerified, async (req, res) => {
    try {
        const { firstName, lastName, dateOfBirth, gender } = req.body;

        const user = req.user;

        if (user.firstName) {
            return res.status(400).json({
                success: false,
                message: 'Basic information already set. Use update endpoint to modify.',
                code: 'BASIC_INFO_ALREADY_SET'
            });
        }

        // Validate required fields
        if (!firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'First name and last name are required'
            });
        }

        // Update user (use `dob` field from schema)
        user.firstName = firstName;
        user.lastName = lastName;
        if (dateOfBirth !== undefined) {
            if (dateOfBirth === null) {
                user.dob = null;
            } else {
                const parsedDob = new Date(dateOfBirth);
                if (isNaN(parsedDob.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid dateOfBirth format'
                    });
                }
                user.dob = parsedDob;
            }
        }
        if (gender) user.gender = gender;

        await user.save();

        // Generate new token with updated info
        const token = generateToken({
            userId: user._id,
            email: user.email,
            role: user.role
        });

        return res.status(200).json({
            success: true,
            message: 'Basic information saved successfully',
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    dateOfBirth: user.dob,
                    gender: user.gender,
                    role: user.role,
                    emailVerified: await user.isEmailVerifiedAsync(),
                    phoneVerified: await user.isPhoneVerifiedAsync()
                },
                token
            }
        });

    } catch (error) {
        console.error('Submit basic info error:', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ')
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to save basic information',
            error: error.message
        });
    }
});

// PUT /api/onboarding/basic-info
router.put('/basic-info', attachUser, requireAuth, requireEmailVerified, requirePasswordSet, requirePhoneVerified, async (req, res) => {
    try {
        const user = req.user;
        // Ensure that the basic info has been set via POST at least once
        if (!user.firstName) {
            return res.status(400).json({
                success: false,
                message: 'Please set your basic information first using the POST endpoint.',
                code: 'BASIC_INFO_NOT_SET'
            });
        }
        const { firstName, lastName, dateOfBirth, gender } = req.body || {};

        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (dateOfBirth !== undefined) {
            if (dateOfBirth === null) {
                user.dob = null;
            } else {
                const parsedDob = new Date(dateOfBirth);
                if (isNaN(parsedDob.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid dateOfBirth format'
                    });
                }
                user.dob = parsedDob;
            }
        }
        if (gender !== undefined) user.gender = gender;

        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Basic information updated successfully',
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    dateOfBirth: user.dob,
                    gender: user.gender,
                    role: user.role
                }
            }
        });

    } catch (error) {
        console.error('Update basic info error:', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ')
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to update basic information',
            error: error.message
        });
    }
});

// GET /api/onboarding/status
router.get('/status', attachUser, async (req, res) => {
    try {
        const user = req.user;

        const status = {
            emailVerified: await user.isEmailVerifiedAsync(),
            passwordSet: await user.hasPasswordAsync(),
            phoneNumberSet: !!(user.phone?.number),
            phoneVerified: await user.isPhoneVerifiedAsync(),
            basicInfoSet: !!(user.firstName)
        };

        status.onboardingComplete = !!(
            status.emailVerified &&
            status.passwordSet &&
            status.phoneVerified &&
            user.firstName
        );

        // Determine current step
        let currentStep = 'complete';
        if (!status.emailVerified) {
            currentStep = 'email-verification';
        } else if (!status.passwordSet) {
            currentStep = 'set-password';
        } else if (!status.phoneVerified) {
            currentStep = 'phone-verification';
        } else if (!status.basicInfoSet) {
            currentStep = 'basic-info';
        }

        return res.status(200).json({
            success: true,
            data: {
                ...status,
                currentStep,
                user: {
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phoneNumber: user.phone?.number,
                    role: user.role
                }
            }
        });

    } catch (error) {
        console.error('Get onboarding status error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get onboarding status',
            error: error.message
        });
    }
});

export default router;