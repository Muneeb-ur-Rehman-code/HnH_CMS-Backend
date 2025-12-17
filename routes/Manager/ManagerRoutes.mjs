import { Router } from 'express';
import StaffProfile from '../../models/Users/StaffProfile.mjs';
import User from '../../models/Users/_UsersMain.mjs';
import StudentProfile from '../../models/Users/Student.mjs';
import Initial from '../../models/initial/Initial.mjs';
import Country from '../../models/Country/CountryModel.mjs';
import { requireFullAuth, requireManager } from '../../middlewares/Auth.mjs';
import { STAFF_ROLE, STAFF_VERIFICATION_STATUS } from '../../models/Users/StaffProfile.mjs';
import { INITIAL_STATUS, INITIAL_SOURCE, INITIAL_TYPE } from '../../models/initial/Initial.mjs';
import { USER_ROLE, USER_STATUS, USER_SOURCE } from '../../models/Users/_UsersMain.mjs';
import mongoose from 'mongoose';

const router = Router();

const sendResponse = (res, success, data, error) => {
    if (success) {
        if (Array.isArray(data)) {
            return res.status(200).json({ success: true, count: data.length, data });
        } else {
            return res.status(200).json({ success: true, data });
        }
    } else {
        return res.status(error?.status || 500).json({
            success: false,
            message: error?.message || 'Server error',
            code: error?.code || 'SERVER_ERROR'
        });
    }
};

const managerAuth = [requireFullAuth, requireManager];

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
        // Update phone if not verified
        if (!user.phone?.otp?.verified && phoneNumber) {
            if (!user.phone) user.phone = {};
            if (!user.phone.otp) user.phone.otp = {};
            user.phone.number = phoneNumber.trim();
            user.phone.otp.verified = true;
            await user.save();
        }
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

// Helper: Match country by name
const matchCountry = async (countryName) => {
    if (!countryName || !countryName.trim()) return null;

    const searchTerm = countryName.trim().toLowerCase();
    const country = await Country.findOne({
        name: searchTerm,
        deactivatedAt: null,
        code: { $ne: 'VST' } // Exclude VST
    });

    if (country) {
        return country._id;
    }
    return 'OTHER';
};

// Helper: Match university by name
const matchUniversity = async (universityName, countryId) => {
    if (!universityName || !universityName.trim()) return null;
    if (!countryId || countryId === 'OTHER') return null;

    const University = mongoose.model('University');
    const searchTerm = universityName.trim();
    const university = await University.findOne({
        $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { shortName: searchTerm.toUpperCase() }
        ],
        country: countryId,
        deactivatedAt: null
    });

    if (university) {
        return university._id;
    }
    return 'OTHER';
};

// Helper: Get Visit Visa consultant country
const getVisitVisaCountry = async () => {
    return await Country.findOne({ code: 'VST', deactivatedAt: null });
};

// ============================================
// STAFF MANAGEMENT
// ============================================

// Get all staff list
router.get('/staff', managerAuth, async (req, res) => {
    try {
        const { roles, verificationStatus } = req.query;
        let query = {
            staffRole: { $ne: STAFF_ROLE.ADMIN },
            userId: { $ne: req.userId }
        };

        if (roles) {
            const roleArray = roles.split(',').map(role => role.trim().toUpperCase());
            const safeRoles = roleArray.filter(role => role !== STAFF_ROLE.ADMIN && Object.values(STAFF_ROLE).includes(role));
            const invalidRoles = roleArray.filter(role => !validRoles.includes(role));

            if (invalidRoles.length > 0) {
                return sendResponse(res, false, null, {
                    status: 400,
                    message: `Invalid role(s) provided: ${invalidRoles.join(', ')}`,
                    code: 'INVALID_ROLE_FILTER'
                });
            }

            query.staffRole = { $in: safeRoles };
        }

        if (verificationStatus) {
            const statusUpper = verificationStatus.toUpperCase();
            if (Object.values(STAFF_VERIFICATION_STATUS).includes(statusUpper)) {
                query.verificationStatus = statusUpper;
            }
        }

        const staff = await StaffProfile.find(query)
            .populate('userId', 'email firstName lastName phone status')
            .sort({ createdAt: -1 });

        return sendResponse(res, true, staff);
    } catch (error) {
        console.error('Error fetching staff list:', error);
        return sendResponse(res, false, null, error);
    }
});


// Verify a staff
router.put('/staff/:id/verify', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) throw { status: 400, message: 'Invalid Staff ID format.', code: 'INVALID_ID' };


        const staff = await StaffProfile.findById(id);

        if (!staff) throw { status: 404, message: 'Staff not found.', code: 'NOT_FOUND' };
        if (staff.userId.toString() === req.userId.toString()) throw { status: 403, message: 'You cannot verify yourself.', code: 'SELF_ACTION_FORBIDDEN' };
        if (staff.verificationStatus === STAFF_VERIFICATION_STATUS.VERIFIED) throw { status: 400, message: 'Already verified.', code: 'ALREADY_VERIFIED' };

        staff.verificationStatus = STAFF_VERIFICATION_STATUS.VERIFIED;
        staff.rejectionReason = null;
        await staff.save();

        const result = await StaffProfile.findById(id).populate('userId', 'email firstName lastName phoneNumber status');

        return sendResponse(res, true, result);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Reject a staff
router.put('/staff/:id/reject', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(id)) throw { status: 400, message: 'Invalid Staff ID format.', code: 'INVALID_ID' };

        const staff = await StaffProfile.findById(id);

        if (!staff) throw { status: 404, message: 'Staff profile not found.', code: 'NOT_FOUND' };
        if (staff.userId.toString() === req.userId.toString()) throw { status: 403, message: 'You cannot reject your own profile.', code: 'SELF_ACTION_FORBIDDEN' };
        if (staff.staffRole === STAFF_ROLE.ADMIN) throw { status: 403, message: 'Managers cannot reject Admin staff.', code: 'ACCESS_DENIED' };

        staff.verificationStatus = STAFF_VERIFICATION_STATUS.REJECTED;
        staff.rejectionReason = reason?.trim() || 'No reason provided by manager.';
        await staff.save();

        const populatedStaff = await StaffProfile.findById(id).populate('userId', 'email firstName lastName phoneNumber status');
        return sendResponse(res, true, populatedStaff);

    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Edit a staff role
router.put('/staff/:id/role', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { staffRole } = req.body || {};


        if (!mongoose.Types.ObjectId.isValid(id)) throw { status: 400, message: 'Invalid Staff ID format.', code: 'INVALID_ID' };

        if (!staffRole) throw { status: 400, message: 'New role is required.', code: 'ROLE_REQUIRED' };
        if (staffRole === STAFF_ROLE.ADMIN) throw { status: 403, message: 'Managers cannot promote users to Admin.', code: 'PRIVILEGE_ESCALATION_DENIED' };

        if (!Object.values(STAFF_ROLE).includes(staffRole)) throw { status: 400, message: 'Invalid staff role.', code: 'INVALID_ROLE' };

        const staff = await StaffProfile.findById(id);
        if (!staff) throw { status: 404, message: 'Staff not found.', code: 'NOT_FOUND' };

        staff.staffRole = staffRole;
        await staff.save();

        const result = await StaffProfile.findById(id).populate('userId', 'email firstName lastName phoneNumber status');
        return sendResponse(res, true, result);

    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});



// ============================================
// INITIAL MANAGEMENT
// ============================================

// Get all initials
router.get('/initials', managerAuth, async (req, res) => {
    try {
        const { status, source, type } = req.query;

        const query = {};
        if (status && Object.values(INITIAL_STATUS).includes(status)) {
            query.status = status;
        }
        if (source && Object.values(INITIAL_SOURCE).includes(source)) {
            query.source = source;
        }
        if (type && Object.values(INITIAL_TYPE).includes(type)) {
            query.type = type;
        }

        const initials = await Initial.find(query)
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
            .populate('reviewedBy', 'email firstName lastName')
            .populate('markedBy', 'staffRole')
            .populate({
                path: 'markedBy',
                populate: { path: 'userId', select: 'email firstName lastName' }
            })
            .sort({ createdAt: -1 });

        return sendResponse(res, true, initials);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Get initial by ID
router.get('/initials/:id', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const initial = await Initial.findById(id)
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
            .populate('reviewedBy', 'email firstName lastName')
            .populate('markedBy', 'staffRole')
            .populate({
                path: 'markedBy',
                populate: { path: 'userId', select: 'email firstName lastName' }
            });

        if (!initial) {
            const error = new Error('Initial not found.');
            error.status = 404;
            error.code = 'NOT_FOUND';
            throw error;
        }

        return sendResponse(res, true, initial);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Create single initial
router.post('/initials', managerAuth, async (req, res) => {
    try {
        const { email, firstName, lastName, phoneNumber, type, preferredCountry, otherCountry, preferredUniversity, otherUniversity, notes } = req.body;

        // Validate required fields
        if (!email || !email.trim()) {
            const error = new Error('Email is required.');
            error.status = 400;
            error.code = 'EMAIL_REQUIRED';
            throw error;
        }

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

        if (!phoneNumber || !phoneNumber.trim()) {
            const error = new Error('Phone number is required.');
            error.status = 400;
            error.code = 'PHONE_REQUIRED';
            throw error;
        }

        if (!/^[1-9]\d{9,14}$/.test(phoneNumber.trim())) {
            const error = new Error('Phone number must be in format: country code + number (e.g., 923001234567).');
            error.status = 400;
            error.code = 'INVALID_PHONE_FORMAT';
            throw error;
        }

        // Find or create user with verified phone
        const user = await findOrCreateUser(email, firstName, lastName, phoneNumber);

        // Check if phone is verified
        const isPhoneVerified = await user.isPhoneVerifiedAsync();
        if (!isPhoneVerified) {
            const error = new Error('Phone number must be verified to create initial.');
            error.status = 400;
            error.code = 'PHONE_NOT_VERIFIED';
            throw error;
        }

        // Find or create student profile
        const student = await findOrCreateStudent(user._id);

        // Match country
        let countryId = null;
        let otherCountryText = null;
        if (preferredCountry) {
            if (mongoose.Types.ObjectId.isValid(preferredCountry)) {
                countryId = preferredCountry;
            } else {
                countryId = await matchCountry(preferredCountry);
                if (countryId === 'OTHER') {
                    otherCountryText = preferredCountry;
                }
            }
        }

        // Match university (only for STUDY type)
        let universityId = null;
        let otherUniversityText = null;
        if (type === INITIAL_TYPE.STUDY && preferredUniversity && countryId && countryId !== 'OTHER') {
            if (mongoose.Types.ObjectId.isValid(preferredUniversity)) {
                universityId = preferredUniversity;
            } else {
                universityId = await matchUniversity(preferredUniversity, countryId);
                if (universityId === 'OTHER') {
                    otherUniversityText = preferredUniversity;
                }
            }
        }

        // Create initial
        const initial = await Initial.create({
            studentId: student._id,
            type: type || INITIAL_TYPE.STUDY,
            preferredCountry: countryId,
            otherCountry: otherCountryText || otherCountry,
            preferredUniversity: universityId,
            otherUniversity: otherUniversityText || otherUniversity,
            notes: notes ? notes.trim() : null,
            source: INITIAL_SOURCE.MARKETING,
            status: INITIAL_STATUS.PENDING
        });

        const populatedInitial = await Initial.findById(initial._id)
            .populate('studentId', 'userId nationality')
            .populate({
                path: 'studentId',
                populate: { path: 'userId', select: 'email firstName lastName phone' }
            })
            .populate('preferredCountry')
            .populate('preferredUniversity');

        return res.status(201).json({ success: true, data: populatedInitial });
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Import initials from spreadsheet
router.post('/initials/import', managerAuth, async (req, res) => {
    try {
        const { data } = req.body;

        if (!Array.isArray(data)) {
            const error = new Error('Data must be an array.');
            error.status = 400;
            error.code = 'INVALID_DATA_FORMAT';
            throw error;
        }

        if (data.length === 0) {
            return sendResponse(res, true, {
                total: 0,
                imported: 0,
                updated: 0,
                skipped: [],
                errors: []
            });
        }

        const summary = {
            total: data.length,
            imported: 0,
            updated: 0,
            skipped: [],
            errors: []
        };

        for (let i = 0; i < data.length; i++) {
            const record = data[i];
            const rowNumber = i + 1;

            try {
                // Validate required fields
                if (!record.email || !record.firstName || !record.lastName || !record.phoneNumber) {
                    summary.errors.push({
                        row: rowNumber,
                        email: record.email || 'N/A',
                        reason: 'Missing required fields: email, firstName, lastName, or phoneNumber'
                    });
                    continue;
                }

                // Find or create user with verified phone
                const user = await findOrCreateUser(
                    record.email,
                    record.firstName,
                    record.lastName,
                    record.phoneNumber
                );

                // Check if phone is verified
                const isPhoneVerified = await user.isPhoneVerifiedAsync();
                if (!isPhoneVerified) {
                    summary.skipped.push({
                        row: rowNumber,
                        email: record.email,
                        reason: 'Phone number not verified'
                    });
                    continue;
                }

                // Find or create student profile
                const student = await findOrCreateStudent(user._id);

                // Find existing initial
                let initial = await Initial.findOne({ studentId: student._id });

                // Match country
                let countryId = null;
                let otherCountryText = null;
                if (record.preferredCountry) {
                    if (mongoose.Types.ObjectId.isValid(record.preferredCountry)) {
                        countryId = record.preferredCountry;
                    } else {
                        countryId = await matchCountry(record.preferredCountry);
                        if (countryId === 'OTHER') {
                            otherCountryText = record.preferredCountry;
                        }
                    }
                }

                // Match university (only for STUDY type)
                let universityId = null;
                let otherUniversityText = null;
                const visaType = record.visaType || INITIAL_TYPE.STUDY;
                if (visaType === INITIAL_TYPE.STUDY && record.preferredUniversity && countryId && countryId !== 'OTHER') {
                    if (mongoose.Types.ObjectId.isValid(record.preferredUniversity)) {
                        universityId = record.preferredUniversity;
                    } else {
                        universityId = await matchUniversity(record.preferredUniversity, countryId);
                        if (universityId === 'OTHER') {
                            otherUniversityText = record.preferredUniversity;
                        }
                    }
                }

                if (initial) {
                    // Update existing initial - only add data if not present
                    const updateData = {};

                    if (!initial.type && visaType) {
                        updateData.type = visaType;
                    }

                    if (!initial.preferredCountry && countryId) {
                        updateData.preferredCountry = countryId;
                        if (countryId === 'OTHER' && otherCountryText) {
                            updateData.otherCountry = otherCountryText;
                        }
                    }

                    if (!initial.preferredUniversity && universityId) {
                        updateData.preferredUniversity = universityId;
                        if (universityId === 'OTHER' && otherUniversityText) {
                            updateData.otherUniversity = otherUniversityText;
                        }
                    }

                    if (!initial.notes && record.notes) {
                        updateData.notes = record.notes.trim();
                    }

                    if (!initial.source) {
                        updateData.source = INITIAL_SOURCE.MARKETING;
                    }

                    if (Object.keys(updateData).length > 0) {
                        await Initial.findByIdAndUpdate(initial._id, { $set: updateData });
                        summary.updated++;
                    } else {
                        summary.skipped.push({
                            row: rowNumber,
                            email: record.email,
                            reason: 'Initial already exists with all data'
                        });
                    }
                } else {
                    // Create new initial
                    await Initial.create({
                        studentId: student._id,
                        type: visaType,
                        preferredCountry: countryId,
                        otherCountry: otherCountryText,
                        preferredUniversity: universityId,
                        otherUniversity: otherUniversityText,
                        notes: record.notes ? record.notes.trim() : null,
                        source: INITIAL_SOURCE.MARKETING,
                        status: INITIAL_STATUS.PENDING
                    });
                    summary.imported++;
                }
            } catch (error) {
                summary.errors.push({
                    row: rowNumber,
                    email: record.email || 'N/A',
                    reason: error.message
                });
            }
        }

        return sendResponse(res, true, summary);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Edit Initial document
router.put('/initials/:id', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            type,
            preferredCountry,
            otherCountry,
            preferredUniversity,
            otherUniversity,
            notes,
            assignedConsultantId
        } = req.body;

        if (!id) {
            const error = new Error('Initial ID is required.');
            error.status = 400;
            error.code = 'ID_REQUIRED';
            throw error;
        }

        const initial = await Initial.findById(id);
        if (!initial) {
            const error = new Error('Initial not found.');
            error.status = 404;
            error.code = 'NOT_FOUND';
            throw error;
        }

        const updateData = {};

        if (type !== undefined && Object.values(INITIAL_TYPE).includes(type)) {
            updateData.type = type;
        }

        if (preferredCountry !== undefined) {
            updateData.preferredCountry = preferredCountry || null;
        }

        if (otherCountry !== undefined) {
            updateData.otherCountry = otherCountry ? otherCountry.trim() : null;
        }

        if (preferredUniversity !== undefined) {
            updateData.preferredUniversity = preferredUniversity || null;
        }

        if (otherUniversity !== undefined) {
            updateData.otherUniversity = otherUniversity ? otherUniversity.trim() : null;
        }

        if (notes !== undefined) {
            updateData.notes = notes ? notes.trim() : null;
        }

        if (assignedConsultantId !== undefined) {
            if (assignedConsultantId) {
                // Validate consultant
                const consultant = await StaffProfile.findById(assignedConsultantId);
                if (!consultant || consultant.staffRole !== STAFF_ROLE.CONSULTANT) {
                    const error = new Error('Invalid consultant ID.');
                    error.status = 400;
                    error.code = 'INVALID_CONSULTANT';
                    throw error;
                }
                if (consultant.verificationStatus !== STAFF_VERIFICATION_STATUS.VERIFIED) {
                    const error = new Error('Consultant must be verified.');
                    error.status = 400;
                    error.code = 'CONSULTANT_NOT_VERIFIED';
                    throw error;
                }
            }
            updateData.assignedConsultantId = assignedConsultantId || null;
        }

        if (Object.keys(updateData).length === 0) {
            const error = new Error('No valid fields to update.');
            error.status = 400;
            error.code = 'NO_UPDATE_DATA';
            throw error;
        }

        const updatedInitial = await Initial.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        )
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

        return sendResponse(res, true, updatedInitial);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Assign consultant to initial
router.put('/initials/:id/assign-consultant', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { consultantId } = req.body;

        if (!id) {
            const error = new Error('Initial ID is required.');
            error.status = 400;
            error.code = 'ID_REQUIRED';
            throw error;
        }

        if (!consultantId) {
            const error = new Error('Consultant ID is required.');
            error.status = 400;
            error.code = 'CONSULTANT_ID_REQUIRED';
            throw error;
        }

        const initial = await Initial.findById(id);
        if (!initial) {
            const error = new Error('Initial not found.');
            error.status = 404;
            error.code = 'NOT_FOUND';
            throw error;
        }

        // Validate consultant
        const consultant = await StaffProfile.findById(consultantId);
        if (!consultant || consultant.staffRole !== STAFF_ROLE.CONSULTANT) {
            const error = new Error('Invalid consultant ID.');
            error.status = 400;
            error.code = 'INVALID_CONSULTANT';
            throw error;
        }

        if (consultant.verificationStatus !== STAFF_VERIFICATION_STATUS.VERIFIED) {
            const error = new Error('Consultant must be verified.');
            error.status = 400;
            error.code = 'CONSULTANT_NOT_VERIFIED';
            throw error;
        }

        initial.assignedConsultantId = consultantId;
        await initial.save();

        const populatedInitial = await Initial.findById(id)
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

        return sendResponse(res, true, populatedInitial);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Change Initial status (with consultant assignment logic)
router.put('/initials/:id/status', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        if (!id) {
            const error = new Error('Initial ID is required.');
            error.status = 400;
            error.code = 'ID_REQUIRED';
            throw error;
        }

        if (!status) {
            const error = new Error('Status is required.');
            error.status = 400;
            error.code = 'STATUS_REQUIRED';
            throw error;
        }

        if (!Object.values(INITIAL_STATUS).includes(status)) {
            const error = new Error('Invalid status.');
            error.status = 400;
            error.code = 'INVALID_STATUS';
            throw error;
        }

        // Cannot set to DONE or DECLINED (consultant does that)
        if (status === INITIAL_STATUS.DONE || status === INITIAL_STATUS.DECLINED) {
            const error = new Error('Cannot set status to DONE or DECLINED through this route.');
            error.status = 400;
            error.code = 'CANNOT_SET_STATUS';
            throw error;
        }

        const initial = await Initial.findById(id)
            .populate('preferredCountry')
            .populate('assignedConsultantId');

        if (!initial) {
            const error = new Error('Initial not found.');
            error.status = 404;
            error.code = 'NOT_FOUND';
            throw error;
        }

        // Validate status transitions
        const currentStatus = initial.status;
        const validTransitions = {
            [INITIAL_STATUS.PENDING]: [INITIAL_STATUS.APPROVED, INITIAL_STATUS.REJECTED],
            [INITIAL_STATUS.APPROVED]: [INITIAL_STATUS.PENDING, INITIAL_STATUS.REJECTED],
            [INITIAL_STATUS.REJECTED]: [INITIAL_STATUS.PENDING, INITIAL_STATUS.APPROVED]
        };

        if (!validTransitions[currentStatus]?.includes(status)) {
            const error = new Error(`Cannot change status from ${currentStatus} to ${status}.`);
            error.status = 400;
            error.code = 'INVALID_STATUS_TRANSITION';
            throw error;
        }

        // If rejecting, require reason
        if (status === INITIAL_STATUS.REJECTED && (!rejectionReason || !rejectionReason.trim())) {
            const error = new Error('Rejection reason is required when rejecting.');
            error.status = 400;
            error.code = 'REJECTION_REASON_REQUIRED';
            throw error;
        }

        // If approving, check and assign consultant
        if (status === INITIAL_STATUS.APPROVED) {
            // Check if consultant is already assigned
            if (initial.assignedConsultantId) {
                const consultant = await StaffProfile.findById(initial.assignedConsultantId);
                if (!consultant || consultant.verificationStatus !== STAFF_VERIFICATION_STATUS.VERIFIED) {
                    // Remove invalid consultant
                    initial.assignedConsultantId = null;
                    const error = new Error('Assigned consultant is not verified. Please assign a verified consultant.');
                    error.status = 400;
                    error.code = 'CONSULTANT_NOT_VERIFIED';
                    throw error;
                }
            } else {
                // No consultant assigned, assign based on type
                if (initial.type === INITIAL_TYPE.VISIT) {
                    // Check for Visit Visa consultant
                    const vstCountry = await getVisitVisaCountry();
                    if (!vstCountry || !vstCountry.consultantId) {
                        const error = new Error('Visit Visa consultant is not available.');
                        error.status = 400;
                        error.code = 'VISIT_CONSULTANT_NOT_AVAILABLE';
                        throw error;
                    }

                    const visitConsultant = await StaffProfile.findById(vstCountry.consultantId);
                    if (!visitConsultant || visitConsultant.verificationStatus !== STAFF_VERIFICATION_STATUS.VERIFIED) {
                        const error = new Error('Visit Visa consultant is not verified.');
                        error.status = 400;
                        error.code = 'VISIT_CONSULTANT_NOT_VERIFIED';
                        throw error;
                    }

                    initial.assignedConsultantId = visitConsultant._id;
                } else if (initial.type === INITIAL_TYPE.STUDY) {
                    // Check if country is available and not OTHER
                    if (!initial.preferredCountry || initial.preferredCountry === 'OTHER') {
                        const error = new Error('Either assign a consultant or select a valid country.');
                        error.status = 400;
                        error.code = 'COUNTRY_OR_CONSULTANT_REQUIRED';
                        throw error;
                    }

                    const country = await Country.findById(initial.preferredCountry);
                    if (!country || country.deactivatedAt) {
                        const error = new Error('Selected country is not available.');
                        error.status = 400;
                        error.code = 'COUNTRY_NOT_AVAILABLE';
                        throw error;
                    }

                    if (!country.consultantId) {
                        const error = new Error('No consultant assigned to selected country.');
                        error.status = 400;
                        error.code = 'NO_COUNTRY_CONSULTANT';
                        throw error;
                    }

                    const countryConsultant = await StaffProfile.findById(country.consultantId);
                    if (!countryConsultant || countryConsultant.verificationStatus !== STAFF_VERIFICATION_STATUS.VERIFIED) {
                        const error = new Error('Country consultant is not verified.');
                        error.status = 400;
                        error.code = 'COUNTRY_CONSULTANT_NOT_VERIFIED';
                        throw error;
                    }

                    initial.assignedConsultantId = countryConsultant._id;
                }
            }
        }

        // Update status and reviewedBy
        initial.status = status;
        initial.reviewedBy = req.userId;
        initial.reviewedAt = new Date();

        // Set or clear rejection reason
        if (status === INITIAL_STATUS.REJECTED) {
            initial.rejectionReason = rejectionReason.trim();
        } else {
            initial.rejectionReason = null;
        }

        await initial.save();

        const populatedInitial = await Initial.findById(id)
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

        return sendResponse(res, true, populatedInitial);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

export default router;
