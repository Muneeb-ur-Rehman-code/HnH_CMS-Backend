import { Router } from 'express';
import User from '../../models/Users/_UsersMain.mjs';
import StudentProfile from '../../models/Users/Student.mjs';
import Initial from '../../models/initial/Initial.mjs';
import Country from '../../models/Country/CountryModel.mjs';
import University from '../../models/University/UniModel.mjs';
import StaffProfile from '../../models/Users/StaffProfile.mjs';
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

const findOrCreateStudent = async (userId) => {
    let student = await StudentProfile.findOne({ userId });
    if (!student) {
        student = await StudentProfile.create({ userId });
    }
    return student;
};


// Create initial from walk-in
router.post('/initial', async (req, res) => {
    try {
        const { firstName, lastName, email, phoneNumber, visaType, preferredCountry, otherCountry, preferredUniversity, otherUniversity } = req.body || {};
        const receptionistUserId = req.user._id;

        // ============================================
        // VALIDATION
        // ============================================
        if (!firstName || !firstName.trim()) throw { status: 400, message: 'First name is required.', code: 'FIRST_NAME_REQUIRED' }
        if (!lastName || !lastName.trim()) throw { status: 400, message: 'Last name is required.', code: 'LAST_NAME_REQUIRED' }
        if (!email || !email.trim()) throw { status: 400, message: 'Email is required.', code: 'EMAIL_REQUIRED' }
        if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) throw { status: 400, message: 'Please provide a valid email address.', code: 'INVALID_EMAIL' }
        if (!phoneNumber || !phoneNumber.trim()) throw { status: 400, message: 'Phone number is required.', code: 'PHONE_REQUIRED' }
        if (!/^[1-9]\d{9,14}$/.test(phoneNumber.trim())) throw { status: 400, message: 'Please provide a valid phone number. eg 923123456789', code: 'INVALID_PHONE' }

        const type = visaType || INITIAL_TYPE.STUDY;
        if (type !== INITIAL_TYPE.STUDY && type !== INITIAL_TYPE.VISIT) throw { status: 400, message: 'Invalid visa type.', code: 'INVALID_VISA_TYPE' }

        // ============================================
        // Find or create user with verified phone
        // ============================================
        const user = await findOrCreateUser(email, firstName, lastName, phoneNumber);
        const student = await findOrCreateStudent(user._id);

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
            if (!preferredCountry) throw { status: 400, message: 'Preferred country is required for Visit visa.', code: 'COUNTRY_REQUIRED' }
            if (preferredCountry === 'OTHER') {
                if (!otherCountry || !otherCountry.trim()) throw { status: 400, message: 'Other country string is required when "OTHER" is selected.', code: 'OTHER_COUNTRY_REQUIRED' }
                countryId = 'OTHER';
                otherCountryText = otherCountry.trim();
            } else {
                if (!mongoose.Types.ObjectId.isValid(preferredCountry)) throw { status: 400, message: 'Invalid country ID format.', code: 'INVALID_COUNTRY_ID' }
                const country = await Country.findById(preferredCountry);
                if (!country || country.deactivatedAt) throw { status: 404, message: 'Country not found or is deactivated.', code: 'COUNTRY_NOT_FOUND' }
                countryId = country._id;

                if (country.visitConsultantId) {
                    const visitcon = await StaffProfile.findById(country.visitConsultantId);
                    if (visitcon && visitcon.verificationStatus === STAFF_VERIFICATION_STATUS.VERIFIED) {
                        assignedConsultantId = visitcon._id;
                        status = INITIAL_STATUS.APPROVED;
                        reviewedBy = receptionistUserId;
                        reviewedAt = new Date();
                    }

                }
            }

            universityId = null;
            otherUniversityText = null;

        } else if (type === INITIAL_TYPE.STUDY) {
            // Study Visa processing
            if (!preferredCountry) throw { status: 400, message: 'Preferred country is required for Study visa.', code: 'COUNTRY_REQUIRED' }
            if (!preferredUniversity) throw { status: 400, message: 'Preferred University is required for Study visa', code: 'UNIVERSITY_REQUIRED' }

            if (preferredCountry === 'OTHER') {

                if (!otherCountry || !otherCountry.trim()) throw { status: 400, message: 'Other country string is required when "OTHER" is selected.', code: 'OTHER_COUNTRY_REQUIRED' }
                countryId = 'OTHER';
                otherCountryText = otherCountry.trim();
                if (preferredUniversity !== 'OTHER') throw { status: 400, message: "Can't choose a specific university when the country is 'OTHER'.", code: 'UNIVERSITY_NOT_ALLOWED_FOR_OTHER_COUNTRY' };

            } else {

                if (!mongoose.Types.ObjectId.isValid(preferredCountry)) throw { status: 400, message: 'Invalid country ID format.', code: 'INVALID_COUNTRY_ID' }
                const country = await Country.findById(preferredCountry);
                if (!country || country.deactivatedAt) throw { status: 404, message: 'Country not found or is deactivated.', code: 'COUNTRY_NOT_FOUND' }
                countryId = country._id;

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


            if (preferredUniversity === 'OTHER') {
                if (!otherUniversity || !otherUniversity.trim()) throw { status: 400, message: 'Other university string is required when "OTHER" is selected.', code: 'OTHER_UNIVERSITY_REQUIRED' }
                universityId = 'OTHER';
                otherUniversityText = otherUniversity.trim();
            } else {
                if (!mongoose.Types.ObjectId.isValid(preferredUniversity)) throw { status: 400, message: 'Invalid university ID format.', code: 'INVALID_UNIVERSITY_ID' }

                const university = await University.findById(preferredUniversity);
                if (!university || university.deactivatedAt) throw { status: 404, message: 'University not found or is deactivated.', code: 'UNIVERSITY_NOT_FOUND' }
                if (university.country.toString() !== countryId.toString()) throw { status: 400, message: 'Selected university does not belong to the selected country.', code: 'UNIVERSITY_COUNTRY_MISMATCH' }
                universityId = university._id;
            }
        }

        // ============================================
        // CREATE INITIAL
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


        const initial = await Initial.create(initialData);

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

        return res.status(200).json({
            success: true,
            message: 'Initial created successfully',
            data: populatedInitial
        });

    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

export default router;

