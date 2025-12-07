// routes/receptionist/receptionist.mjs
import express from 'express';
import User from '../../models/Users/_UsersMain.mjs';
import Initial from '../../models/initial/Initial.mjs';
import { attachUser, requireRole } from '../../middlewares/Auth.mjs';
import { USER_ROLE, USER_SOURCE, USER_STATUS } from '../../models/Users/_UsersMain.mjs';
import { INITIAL_SOURCE, INITIAL_STATUS } from '../../models/initial/Initial.mjs';

const router = express.Router();

/**
 * POST /api/receptionist/walk-in
 * Create a walk-in student entry
 * Requires: Receptionist role
 */
router.post('/walk-in', attachUser, requireRole(USER_ROLE.RECEPTIONIST, USER_ROLE.MANAGER, USER_ROLE.ADMIN), async (req, res) => {
    try {
        const {
            email,
            firstName,
            lastName,
            phoneNumber,
            preferredCountry,
            preferredUniversity
        } = req.body;

        // Validate required fields
        if (!email || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'Email, first name, and last name are required'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if user already exists
        let user = await User.findOne({ email: normalizedEmail });

        // If user doesn't exist, create new user
        if (!user) {
            user = await User.create({
                email: normalizedEmail,
                firstName,
                lastName,
                phoneNumber: phoneNumber || null,
                role: USER_ROLE.STUDENT,
                source: USER_SOURCE.WALK_IN,
                status: USER_STATUS.ACTIVE
            });
        } else {
            // Update user info if user exists but has minimal info
            if (!user.firstName) user.firstName = firstName;
            if (!user.lastName) user.lastName = lastName;
            if (phoneNumber && !user.phoneNumber) user.phoneNumber = phoneNumber;
            if (user.source === USER_SOURCE.ONLINE && !user.password) {
                user.source = USER_SOURCE.WALK_IN;
            }
            await user.save();
        }

        // Create or update Initial entry
        let initial = await Initial.findOne({
            email: normalizedEmail,
            status: { $ne: INITIAL_STATUS.DONE }
        });

        if (initial) {
            // Update existing initial entry
            initial.firstName = firstName;
            initial.lastName = lastName;
            initial.phoneNumber = phoneNumber || null;
            initial.preferredCountry = preferredCountry || null;
            initial.preferredUniversity = preferredUniversity || null;
            initial.source = INITIAL_SOURCE.WALK_IN;
            initial.status = INITIAL_STATUS.APPROVED;
            await initial.save();
        } else {
            // Create new initial entry
            initial = await Initial.create({
                email: normalizedEmail,
                firstName,
                lastName,
                phoneNumber: phoneNumber || null,
                preferredCountry: preferredCountry || null,
                preferredUniversity: preferredUniversity || null,
                source: INITIAL_SOURCE.WALK_IN,
                status: INITIAL_STATUS.APPROVED
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Walk-in student registered successfully',
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phoneNumber: user.phoneNumber,
                    role: user.role,
                    source: user.source
                },
                initial: {
                    id: initial._id,
                    email: initial.email,
                    firstName: initial.firstName,
                    lastName: initial.lastName,
                    phoneNumber: initial.phoneNumber,
                    preferredCountry: initial.preferredCountry,
                    preferredUniversity: initial.preferredUniversity,
                    source: initial.source,
                    status: initial.status
                }
            }
        });

    } catch (error) {
        console.error('Walk-in registration error:', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ')
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to register walk-in student',
            error: error.message
        });
    }
});

/**
 * GET /api/receptionist/today-walk-ins
 * Get today's walk-in entries
 */
router.get('/today-walk-ins', attachUser, requireRole(USER_ROLE.RECEPTIONIST, USER_ROLE.MANAGER, USER_ROLE.ADMIN), async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const walkIns = await Initial.find({
            source: INITIAL_SOURCE.WALK_IN,
            createdAt: {
                $gte: today,
                $lt: tomorrow
            }
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: walkIns.length,
                walkIns
            }
        });

    } catch (error) {
        console.error('Get today walk-ins error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch walk-ins',
            error: error.message
        });
    }
});

export default router;