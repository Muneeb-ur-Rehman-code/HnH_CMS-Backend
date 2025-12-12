import { Router } from 'express';
import User from '../../models/Users/_UsersMain.mjs';
import StudentProfile from '../../models/Users/Student.mjs';
import Initial from '../../models/initial/Initial.mjs';
import Country from '../../models/Country/CountryModel.mjs';
import University from '../../models/University/UniModel.mjs';
import StaffProfile from '../../models/Users/StaffProfile.mjs';
import { requireReceptionist } from '../../middlewares/Auth.mjs';
import { USER_ROLE, USER_STATUS, USER_SOURCE } from '../../models/Users/_UsersMain.mjs';
import { INITIAL_STATUS, INITIAL_SOURCE, INITIAL_TYPE } from '../../models/initial/Initial.mjs';
import { STAFF_VERIFICATION_STATUS } from '../../models/Users/StaffProfile.mjs';
import mongoose from 'mongoose';

const router = Router();

const sendResponse = (res, success, data, error) => {
    if (success) {
        return res.status(200).json({ success: true, data });
    } else {
        return res.status(error?.status || 500).json({
            success: false,
            message: error?.message || 'Server error',
            code: error?.code || 'SERVER_ERROR'
        });
    }
};

// Helper: Find or create user with verified phone
const findOrCreateUser = async (email, firstName, lastName, phoneNumber) => {
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
        // Create user with email not verified, password not set, phone verified
        user = await User.create({
            email: email.toLowerCase(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: {
                number: phoneNumber.trim(),
                otp: {
                    verified: true
                }
            },
            role: USER_ROLE.STUDENT,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.CONSULTANT
        });
    } else {
        // Update phone and make it verified
        if (!user.phone) user.phone = {};
        if (!user.phone.otp) user.phone.otp = {};
        user.phone.number = phoneNumber.trim();
        user.phone.otp.verified = true;
        await user.save();
    }

    return user;
};

// Helper: Find or create student profile
const findOrCreateStudent = async (userId) => {
    let student = await StudentProfile.findOne({ userId });
    if (!student) {
        student = await StudentProfile.create({ userId });
    }
    return student;
};

// Helper: Get Visit Visa consultant
const getVisitVisaConsultant = async () => {
    const vstCountry = await Country.findOne({ code: 'VST', deactivatedAt: null });
    if (!vstCountry || !vstCountry.consultantId) {
        return null;
    }

    const consultant = await StaffProfile.findById(vstCountry.consultantId);
    if (!consultant || consultant.verificationStatus !== STAFF_VERIFICATION_STATUS.VERIFIED) {
        return null;
    }

    return consultant._id;
};

// Create initial from walk-in
router.post('/initial', requireReceptionist, async (req, res) => {
    try {
        const { firstName, lastName, email, phoneNumber, visaType, preferredCountry, otherCountry, preferredUniversity, otherUniversity } = req.body;
        const receptionistUserId = req.user._id;

        // ============================================
        // VALIDATION
        // ============================================
        if (!firstName || !firstName.trim()) {
            const error = new Error('First name is required.');
            error.status = 400;
            error.code = 'FIRST_NAME_REQUIRED';
            throw error;
        }

        if (!lastName || !lastName.trim()) {
            const error = new Error('Last name is required.');
            error.status = 400;
            error.code = 'LAST_NAME_REQUIRED';
            throw error;
        }

        if (!email || !email.trim()) {
            const error = new Error('Email is required.');
            error.status = 400;
            error.code = 'EMAIL_REQUIRED';
            throw error;
        }

        // Validate email format
        if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) {
            const error = new Error('Please provide a valid email address.');
            error.status = 400;
            error.code = 'INVALID_EMAIL';
            throw error;
        }

        if (!phoneNumber || !phoneNumber.trim()) {
            const error = new Error('Phone number is required.');
            error.status = 400;
            error.code = 'PHONE_REQUIRED';
            throw error;
        }

        // Validate phone format
        if (!/^[1-9]\d{9,14}$/.test(phoneNumber.trim())) {
            const error = new Error('Phone number must be in format: country code + number (e.g., 923001234567).');
            error.status = 400;
            error.code = 'INVALID_PHONE_FORMAT';
            throw error;
        }

        // Validate visa type
        const type = visaType || INITIAL_TYPE.STUDY;
        if (!Object.values(INITIAL_TYPE).includes(type)) {
            const error = new Error('Invalid visa type. Must be STUDY or VISIT.');
            error.status = 400;
            error.code = 'INVALID_VISA_TYPE';
            throw error;
        }

        // ============================================
        // STEP 1: Find or create user with verified phone
        // ============================================
        const user = await findOrCreateUser(email, firstName, lastName, phoneNumber);
        const student = await findOrCreateStudent(user._id);

        // ============================================
        // STEP 2: Check for existing initial
        // ============================================
        let initial = await Initial.findOne({
            studentId: student._id,
            status: { $in: [INITIAL_STATUS.PENDING, INITIAL_STATUS.APPROVED, INITIAL_STATUS.REJECTED] }
        });

        // ============================================
        // PROCESS BASED ON VISA TYPE
        // ============================================
        let countryId = null;
        let otherCountryText = null;
        let universityId = null;
        let otherUniversityText = null;
        let assignedConsultantId = null;
        let status = INITIAL_STATUS.PENDING;
        let reviewedBy = null;
        let reviewedAt = null;

        if (type === INITIAL_TYPE.VISIT) {
            // Visit Visa processing
            if (preferredCountry) {
                if (preferredCountry === 'OTHER') {
                    if (!otherCountry || !otherCountry.trim()) {
                        const error = new Error('Other country string is required when "OTHER" is selected.');
                        error.status = 400;
                        error.code = 'OTHER_COUNTRY_REQUIRED';
                        throw error;
                    }
                    countryId = 'OTHER';
                    otherCountryText = otherCountry.trim();
                } else {
                    // Validate country ID
                    if (!mongoose.Types.ObjectId.isValid(preferredCountry)) {
                        const error = new Error('Invalid country ID format.');
                        error.status = 400;
                        error.code = 'INVALID_COUNTRY_ID';
                        throw error;
                    }

                    const country = await Country.findById(preferredCountry);
                    if (!country || country.deactivatedAt) {
                        const error = new Error('Country not found or is deactivated.');
                        error.status = 404;
                        error.code = 'COUNTRY_NOT_FOUND';
                        throw error;
                    }

                    countryId = country._id;
                }
            }

            // Check for Visit Visa consultant
            const visitConsultantId = await getVisitVisaConsultant();
            if (!visitConsultantId) {
                const error = new Error('Visit Visa consultant is not available.');
                error.status = 400;
                error.code = 'VISIT_CONSULTANT_NOT_AVAILABLE';
                throw error;
            }

            assignedConsultantId = visitConsultantId;
            status = INITIAL_STATUS.APPROVED;
            reviewedBy = receptionistUserId;
            reviewedAt = new Date();

            // Discard university info for Visit visa
            universityId = null;
            otherUniversityText = null;

        } else if (type === INITIAL_TYPE.STUDY) {
            // Study Visa processing
            if (!preferredCountry) {
                const error = new Error('Preferred country is required for Study visa.');
                error.status = 400;
                error.code = 'COUNTRY_REQUIRED';
                throw error;
            }

            if (preferredCountry === 'OTHER') {
                if (!otherCountry || !otherCountry.trim()) {
                    const error = new Error('Other country string is required when "OTHER" is selected.');
                    error.status = 400;
                    error.code = 'OTHER_COUNTRY_REQUIRED';
                    throw error;
                }
                countryId = 'OTHER';
                otherCountryText = otherCountry.trim();
                // Status remains PENDING for OTHER country
            } else {
                // Validate country ID
                if (!mongoose.Types.ObjectId.isValid(preferredCountry)) {
                    const error = new Error('Invalid country ID format.');
                    error.status = 400;
                    error.code = 'INVALID_COUNTRY_ID';
                    throw error;
                }

                const country = await Country.findById(preferredCountry);
                if (!country || country.deactivatedAt) {
                    const error = new Error('Country not found or is deactivated.');
                    error.status = 404;
                    error.code = 'COUNTRY_NOT_FOUND';
                    throw error;
                }

                countryId = country._id;

                // Get consultant from country
                if (country.consultantId) {
                    const consultant = await StaffProfile.findById(country.consultantId);
                    if (consultant && consultant.verificationStatus === STAFF_VERIFICATION_STATUS.VERIFIED) {
                        assignedConsultantId = consultant._id;
                        status = INITIAL_STATUS.APPROVED;
                        reviewedBy = receptionistUserId;
                        reviewedAt = new Date();
                    }
                }
            }

            // Process university (only if country is not OTHER)
            if (preferredUniversity && countryId && countryId !== 'OTHER') {
                if (preferredUniversity === 'OTHER') {
                    if (!otherUniversity || !otherUniversity.trim()) {
                        const error = new Error('Other university string is required when "OTHER" is selected.');
                        error.status = 400;
                        error.code = 'OTHER_UNIVERSITY_REQUIRED';
                        throw error;
                    }
                    universityId = 'OTHER';
                    otherUniversityText = otherUniversity.trim();
                } else {
                    // Validate university ID
                    if (!mongoose.Types.ObjectId.isValid(preferredUniversity)) {
                        const error = new Error('Invalid university ID format.');
                        error.status = 400;
                        error.code = 'INVALID_UNIVERSITY_ID';
                        throw error;
                    }

                    const university = await University.findById(preferredUniversity);
                    if (!university || university.deactivatedAt) {
                        const error = new Error('University not found or is deactivated.');
                        error.status = 404;
                        error.code = 'UNIVERSITY_NOT_FOUND';
                        throw error;
                    }

                    // Check if university belongs to selected country
                    if (university.country.toString() !== countryId.toString()) {
                        const error = new Error('Selected university does not belong to the selected country.');
                        error.status = 400;
                        error.code = 'UNIVERSITY_COUNTRY_MISMATCH';
                        throw error;
                    }

                    universityId = university._id;
                }
            }
        }

        // ============================================
        // CREATE OR UPDATE INITIAL
        // ============================================
        const initialData = {
            studentId: student._id,
            type,
            preferredCountry: countryId,
            otherCountry: otherCountryText,
            preferredUniversity: universityId,
            otherUniversity: otherUniversityText,
            assignedConsultantId,
            source: INITIAL_SOURCE.WALK_IN,
            status,
            reviewedBy,
            reviewedAt
        };

        const wasExisting = !!initial;

        if (initial) {
            // Update existing initial
            Object.assign(initial, initialData);
            await initial.save();
        } else {
            // Create new initial
            initial = await Initial.create(initialData);
        }

        // Populate and return
        const populatedInitial = await Initial.findById(initial._id)
            .populate('studentId', 'userId nationality')
            .populate({
                path: 'studentId',
                populate: { path: 'userId', select: 'email firstName lastName phone' }
            })
            .populate('preferredCountry')
            .populate('preferredUniversity')
            .populate('assignedConsultantId', 'staffRole verificationStatus')
            .populate({
                path: 'assignedConsultantId',
                populate: { path: 'userId', select: 'email firstName lastName' }
            })
            .populate('reviewedBy', 'email firstName lastName');

        return res.status(wasExisting ? 200 : 201).json({
            success: true,
            message: wasExisting ? 'Initial updated successfully' : 'Initial created successfully',
            data: populatedInitial
        });

    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

export default router;

