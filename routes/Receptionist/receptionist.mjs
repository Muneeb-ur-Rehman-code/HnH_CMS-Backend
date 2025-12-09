// routes/receptionist/receptionist.mjs
import express from 'express';
import User from '../../models/Users/_UsersMain.mjs';
import Initial from '../../models/initial/Initial.mjs';
import { attachUser, requireRole } from '../../middlewares/Auth.mjs';
import { USER_ROLE, USER_SOURCE, USER_STATUS } from '../../models/Users/_UsersMain.mjs';
import { STAFF_ROLE } from '../../models/Users/StaffProfile.mjs';
import { INITIAL_SOURCE, INITIAL_STATUS } from '../../models/initial/Initial.mjs';

const router = express.Router();

// POST /api/receptionist/walk-in
router.post('/walk-in', attachUser, requireRole(STAFF_ROLE.RECEPTIONIST, STAFF_ROLE.ADMIN), async (req, res) => {
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
                phone: phoneNumber ? { number: phoneNumber || null, otp: { verified: true } } : null,
                role: USER_ROLE.STUDENT,
                source: USER_SOURCE.WALK_IN,
                status: USER_STATUS.ACTIVE
            });
        } else {
            // Update user info if user exists but has minimal info
            if (!user.firstName) user.firstName = firstName;
            if (!user.lastName) user.lastName = lastName;

            // Ensure phone number is present and mark OTP verified by default for walk-ins
            if (phoneNumber) {
                if (!user.phone || !user.phone.number) {
                    user.phone = { number: phoneNumber, otp: { verified: true } };
                } else {
                    user.phone.number = user.phone.number || phoneNumber;
                    if (!user.phone.otp) user.phone.otp = { verified: true };
                    else user.phone.otp.verified = true;
                }
            }

            if (user.source === USER_SOURCE.ONLINE && !user.password) {
                user.source = USER_SOURCE.WALK_IN;
            }
            await user.save();
        }

        let initial = await Initial.findOne({
            email: normalizedEmail,
            status: { $ne: INITIAL_STATUS.APPROVED }
        });

        if (initial) {
            initial.firstName = firstName;
            initial.lastName = lastName;
            initial.phoneNumber = phoneNumber || null;
            initial.preferredCountry = preferredCountry || null;
            initial.preferredUniversity = preferredUniversity || null;
            initial.source = INITIAL_SOURCE.WALK_IN;
            initial.status = INITIAL_STATUS.APPROVED;
            initial.userId = user._id;
            await initial.save();
        } else {
            initial = await Initial.create({
                email: normalizedEmail,
                firstName,
                lastName,
                phoneNumber: phoneNumber || null,
                preferredCountry: preferredCountry || null,
                preferredUniversity: preferredUniversity || null,
                source: INITIAL_SOURCE.WALK_IN,
                status: INITIAL_STATUS.APPROVED,
                userId: user._id
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

export default router;