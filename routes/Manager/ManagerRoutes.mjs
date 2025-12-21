import { Router } from 'express';
import StaffProfile from '../../models/Users/StaffProfile.mjs';
import User from '../../models/Users/_UsersMain.mjs';
import StudentProfile from '../../models/Users/Student.mjs';
import Initial from '../../models/initial/Initial.mjs';
import Country from '../../models/Country/CountryModel.mjs';
import University from '../../models/University/UniModel.mjs';
import Process from '../../models/Process/Process.mjs';
import { PROCESS_STATUS } from '../../config/enums.mjs';
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


const validateIdentity = (data) => {
    if (!data.firstName?.trim()) throw { status: 400, message: 'First name is required.', code: 'FIRST_NAME_REQUIRED' };
    if (!data.lastName?.trim()) throw { status: 400, message: 'Last name is required.', code: 'LAST_NAME_REQUIRED' };
    if (!data.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        throw { status: 400, message: 'A valid email address is required.', code: 'INVALID_EMAIL' };
    }
    if (!data.phoneNumber?.trim() || !/^[1-9]\d{9,14}$/.test(data.phoneNumber.trim())) {
        throw { status: 400, message: 'Valid phone number required (e.g., 923...).', code: 'INVALID_PHONE' };
    }
};

const matchCountry = async (text) => {
    // Check if text exists and isn't just whitespace
    if (!text || typeof text !== 'string' || !text.trim()) return 'OTHER';

    const found = await Country.findOne({
        name: { $regex: new RegExp(`^${text.trim()}$`, 'i') },
        deactivatedAt: null
    });
    return found ? found._id : 'OTHER';
};

const matchUniversity = async (text, countryId) => {
    // If country is OTHER or text is missing, we can't match a real Uni ID
    if (countryId === 'OTHER' || !text || typeof text !== 'string' || !text.trim()) {
        return 'OTHER';
    }

    const found = await University.findOne({
        name: { $regex: new RegExp(`^${text.trim()}$`, 'i') },
        country: countryId,
        deactivatedAt: null
    });
    console.log("found:" + found)
    return found ? found._id : 'OTHER';
};
// ============================================
// STAFF MANAGEMENT
// ============================================

router.get('/staff', async (req, res) => {
    try {
        const { roles, verificationStatus } = req.query;
        let query = {
            staffRole: { $ne: STAFF_ROLE.ADMIN },
            userId: { $ne: req.userId }
        };

        if (roles) {
            const roleArray = roles.split(',').map(role => role.trim().toUpperCase());
            const safeRoles = roleArray.filter(role => role !== STAFF_ROLE.ADMIN && Object.values(STAFF_ROLE).includes(role));
            const validRoles = Object.values(STAFF_ROLE);
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


router.put('/staff/:id/verify', async (req, res) => {
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

router.put('/staff/:id/reject', async (req, res) => {
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

router.put('/staff/:id/role', async (req, res) => {
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

router.get('/initials', async (req, res) => {
    try {
        const { status } = req.query;
        const type = req.rtype; // Derived from middleware (STUDY or VISIT)

        if (type !== INITIAL_TYPE.STUDY && type !== INITIAL_TYPE.VISIT) throw { status: 403, message: 'Access Denied. Invalid initial type.', code: 'INVALID_TYPE' };

        const query = { type };

        // Manager can see all statuses, but we filter if one is provided in query
        if (status && Object.values(INITIAL_STATUS).includes(status)) {
            query.status = status;
        }

        const initials = await Initial.find(query)
            .populate({
                path: 'studentId',
                populate: { path: 'userId', select: 'email firstName lastName phone' }
            })
            .populate('preferredCountry')
            .populate('preferredUniversity')
            .populate({
                path: 'assignedConsultantId',
                populate: { path: 'userId', select: 'email firstName lastName' }
            })
            .sort({ createdAt: -1 });

        return sendResponse(res, true, initials);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

router.get('/initials/:id', async (req, res) => {
    try {
        const type = req.rtype;
        if (type !== INITIAL_TYPE.STUDY && type !== INITIAL_TYPE.VISIT) throw { status: 403, message: 'Access Denied. Invalid initial type.', code: 'INVALID_TYPE' };
        const initial = await Initial.findOne({ _id: req.params.id, type: type })
            .populate({
                path: 'studentId',
                populate: { path: 'userId', select: 'email firstName lastName phone' }
            })
            .populate('preferredCountry')
            .populate('preferredUniversity')
            .populate({
                path: 'assignedConsultantId',
                populate: { path: 'userId', select: 'email firstName lastName' }
            })
            .populate({
                path: 'reviewedBy',
                select: 'firstName lastName email'
            });

        if (!initial) throw { status: 404, message: 'Initial record not found.', code: 'NOT_FOUND' };

        return sendResponse(res, true, initial);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

router.post('/initials', async (req, res) => {
    try {
        const type = req.rtype;
        if (type !== INITIAL_TYPE.STUDY && type !== INITIAL_TYPE.VISIT) {
            throw { status: 403, message: 'Access Denied.', code: 'INVALID_TYPE' };
        }

        validateIdentity(req.body);
        const { preferredCountry, preferredUniversity, assignedConsultantId, notes } = req.body;

        const user = await findOrCreateUser(req.body.email, req.body.firstName, req.body.lastName, req.body.phoneNumber);
        const student = await findOrCreateStudent(user._id);

        // Basic verification for manual assignment
        let finalConsultant = assignedConsultantId || null;
        if (finalConsultant) {
            const staff = await StaffProfile.findById(finalConsultant);
            if (!staff || staff.verificationStatus !== STAFF_VERIFICATION_STATUS.VERIFIED) {
                throw { status: 400, message: 'Assigned consultant is unverified or invalid.', code: 'CONSULTANT_INVALID' };
            }
        }

        const initial = await Initial.create({
            studentId: student._id,
            type,
            preferredCountry,
            otherCountry: preferredCountry === 'OTHER' ? req.body.otherCountry : null,
            preferredUniversity: type === INITIAL_TYPE.STUDY ? preferredUniversity : null,
            otherUniversity: preferredUniversity === 'OTHER' ? req.body.otherUniversity : null,
            assignedConsultantId: finalConsultant,
            notes,
            source: INITIAL_SOURCE.MANAGER,
            status: INITIAL_STATUS.PENDING
        });

        return sendResponse(res, true, initial);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

router.post('/initials/import', async (req, res) => {
    try {
        const type = req.rtype;
        if (type !== INITIAL_TYPE.STUDY && type !== INITIAL_TYPE.VISIT) {
            throw { status: 403, message: 'Access Denied.', code: 'INVALID_TYPE' };
        }

        const { data } = req.body;
        const summary = { total: data.length, imported: 0, skipped: [] };

        for (const record of data) {
            try {
                console.log("1 record:" + record.universityText);
                // 1. Basic Validation
                validateIdentity(record);

                const user = await findOrCreateUser(record.email, record.firstName, record.lastName, record.phoneNumber);
                const student = await findOrCreateStudent(user._id);

                // 2. Resolve Country
                const countryId = await matchCountry(record.countryText);
                const isCountryOther = (countryId === 'OTHER');
                console.log("2record:" + record.universityText);

                // 3. Resolve University (Only for Study)
                let universityId = null;
                let otherUniText = null;

                if (type === INITIAL_TYPE.STUDY) {
                    console.log("3record:" + record.universityText);

                    universityId = await matchUniversity(record.universityText, countryId);
                    console.log("4record:" + record.universityText);

                    if (universityId === 'OTHER') {
                        otherUniText = record.universityText?.trim() || 'Not Specified';
                    }
                }

                // 4. Resolve Consultant (Auto-assign only if country is NOT other)
                let assignedConsultantId = null;
                if (!isCountryOther) {
                    const country = await Country.findById(countryId);
                    const cid = (type === INITIAL_TYPE.VISIT) ? country?.visitConsultantId : country?.consultantId;
                    if (cid) {
                        const staff = await StaffProfile.findById(cid);
                        if (staff?.verificationStatus === STAFF_VERIFICATION_STATUS.VERIFIED) {
                            assignedConsultantId = staff._id;
                        }
                    }
                }

                // 5. Save the record
                await Initial.create({
                    studentId: student._id,
                    type,
                    preferredCountry: countryId,
                    // If Country is OTHER, store the text. If Country is ID, otherCountry is null.
                    otherCountry: isCountryOther ? (record.countryText?.trim() || 'Not Specified') : null,
                    preferredUniversity: universityId,
                    otherUniversity: otherUniText,
                    assignedConsultantId,
                    source: INITIAL_SOURCE.MARKETING,
                    status: INITIAL_STATUS.PENDING
                });

                summary.imported++;
            } catch (err) {
                summary.skipped.push({
                    email: record.email || 'Unknown',
                    reason: err.message // This will now catch actual errors, not just .trim() crashes
                });
            }
        }
        return sendResponse(res, true, summary);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

const processStatusChange = async (initial, newStatus, manualConsultantId, userId, type) => {
    const allowed = {
        [INITIAL_STATUS.PENDING]: [INITIAL_STATUS.APPROVED, INITIAL_STATUS.REJECTED],
        [INITIAL_STATUS.APPROVED]: [INITIAL_STATUS.PENDING, INITIAL_STATUS.REJECTED],
        [INITIAL_STATUS.REJECTED]: [INITIAL_STATUS.PENDING, INITIAL_STATUS.APPROVED],
        [INITIAL_STATUS.REFUSED]: [INITIAL_STATUS.PENDING],
        [INITIAL_STATUS.DECLINED]: [INITIAL_STATUS.PENDING, INITIAL_STATUS.APPROVED]
    };

    if (!allowed[initial.status]?.includes(newStatus)) {
        throw new Error(`Transition from ${initial.status} to ${newStatus} is not allowed.`);
    }

    if (newStatus === INITIAL_STATUS.APPROVED) {
        // Handle Assignment
        if (manualConsultantId) {
            const staff = await StaffProfile.findById(manualConsultantId);
            if (!staff || staff.verificationStatus !== STAFF_VERIFICATION_STATUS.VERIFIED) throw new Error('Selected consultant is unverified.');
            initial.assignedConsultantId = staff._id;
        } else if (!initial.assignedConsultantId) {
            // Auto-assign logic
            if (initial.preferredCountry === 'OTHER') throw new Error('Must manually assign consultant for "OTHER" country.');
            const country = await Country.findById(initial.preferredCountry);
            const cid = (type === INITIAL_TYPE.VISIT) ? country?.visitConsultantId : country?.consultantId;
            const staff = cid ? await StaffProfile.findById(cid) : null;
            if (!staff || staff.verificationStatus !== STAFF_VERIFICATION_STATUS.VERIFIED) throw new Error('No verified consultant found for this country.');
            initial.assignedConsultantId = staff._id;
        }
    }

    initial.status = newStatus;
    initial.reviewedBy = userId;
    initial.reviewedAt = new Date();
    // Clean up reason if moving to any state other than REJECTED
    if (newStatus !== INITIAL_STATUS.REJECTED) initial.rejectionReason = "";

    return initial;
};

router.put('/initials/:id/status', async (req, res) => {
    try {
        const initial = await Initial.findOne({ _id: req.params.id, type: req.rtype });
        if (!initial) throw { status: 404, message: 'Not found.' };

        await processStatusChange(initial, req.body.status, req.body.assignedConsultantId, req.user._id, req.rtype);
        if (req.body.status === INITIAL_STATUS.REJECTED) initial.rejectionReason = req.body.rejectionReason;

        await initial.save();
        return sendResponse(res, true, initial);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

router.patch('/initials/bulk-status', async (req, res) => {
    try {
        const { ids, status } = req.body;
        const initials = await Initial.find({ _id: { $in: ids }, type: req.rtype });

        for (let initial of initials) {
            await processStatusChange(initial, status, null, req.user._id, req.rtype);
            await initial.save();
        }
        return sendResponse(res, true, { updated: initials.length });
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

router.put('/initials/:id/assign', async (req, res) => {
    try {
        const { consultantId } = req.body;
        const type = req.rtype;

        // 1. Basic Checks
        const initial = await Initial.findOne({ _id: req.params.id, type });
        if (!initial) throw { status: 404, message: 'Initial not found.', code: 'NOT_FOUND' };

        // 2. Consultant Validation
        const staff = await StaffProfile.findById(consultantId);
        if (!staff || staff.verificationStatus !== STAFF_VERIFICATION_STATUS.VERIFIED) {
            throw { status: 400, message: 'Consultant is invalid or unverified.', code: 'CONSULTANT_INVALID' };
        }

        // 3. Update without changing status
        initial.assignedConsultantId = staff._id;
        await initial.save();

        return sendResponse(res, true, initial);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

router.patch('/initials/bulk-assign', async (req, res) => {
    try {
        const { ids, consultantId } = req.body;
        const type = req.rtype;

        if (!Array.isArray(ids) || ids.length === 0) {
            throw { status: 400, message: 'Please provide an array of IDs.', code: 'IDS_REQUIRED' };
        }

        // 1. Validate the Consultant first
        const staff = await StaffProfile.findById(consultantId);
        if (!staff || staff.verificationStatus !== STAFF_VERIFICATION_STATUS.VERIFIED) {
            throw { status: 400, message: 'Selected consultant is invalid.', code: 'CONSULTANT_INVALID' };
        }

        // 2. Perform Bulk Update
        // We only update initials belonging to the correct req.rtype
        const result = await Initial.updateMany(
            {
                _id: { $in: ids },
                type: type
            },
            {
                $set: { assignedConsultantId: staff._id }
            }
        );

        return sendResponse(res, true, {
            message: `Successfully assigned ${result.modifiedCount} initials.`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

router.patch('/initials/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const currentType = req.rtype;

        // 1. Destructure and block restricted fields
        const {
            type: newType,
            preferredCountry,
            otherCountry,
            preferredUniversity,
            otherUniversity,
            notes
        } = req.body;

        if (req.body.status || req.body.assignedConsultantId) {
            throw { status: 400, message: 'Restricted fields detected.', code: 'RESTRICTED_FIELDS' };
        }

        const initial = await Initial.findOne({ _id: id, type: currentType });
        if (!initial) throw { status: 404, message: 'Record not found.', code: 'NOT_FOUND' };

        // 2. Verify Country (if provided)
        if (preferredCountry) {
            if (preferredCountry === 'OTHER') {
                initial.preferredCountry = 'OTHER';
                initial.otherCountry = otherCountry?.trim() || 'Not Specified';
            } else {
                if (!mongoose.Types.ObjectId.isValid(preferredCountry)) {
                    throw { status: 400, message: 'Invalid Country ID format.', code: 'INVALID_ID' };
                }
                const country = await Country.findOne({ _id: preferredCountry, deactivatedAt: null });
                if (!country) throw { status: 404, message: 'Country not found or inactive.', code: 'COUNTRY_NOT_FOUND' };

                initial.preferredCountry = country._id;
                initial.otherCountry = null;
            }
        }

        // 3. Handle Type Transition
        const typeChanging = newType && newType !== initial.type;
        if (typeChanging) {
            if (newType !== INITIAL_TYPE.STUDY && newType !== INITIAL_TYPE.VISIT) {
                throw { status: 400, message: 'Invalid target type.', code: 'INVALID_TYPE' };
            }
            initial.type = newType;
            initial.assignedConsultantId = null; // Always reset consultant on type change
        }

        // 4. Verify University Logic
        // This runs if we are in STUDY mode (either originally or just switched to it)
        if (initial.type === INITIAL_TYPE.STUDY) {

            // Logic for Visit -> Study transition without Uni info provided
            if (typeChanging && !preferredUniversity) {
                initial.preferredUniversity = 'OTHER';
                initial.otherUniversity = 'Not Specified';
            }

            // Logic if a University update is actually provided
            else if (preferredUniversity) {
                if (preferredUniversity === 'OTHER') {
                    initial.preferredUniversity = 'OTHER';
                    initial.otherUniversity = otherUniversity?.trim() || 'Not Specified';
                } else {
                    if (!mongoose.Types.ObjectId.isValid(preferredUniversity)) {
                        throw { status: 400, message: 'Invalid University ID format.', code: 'INVALID_ID' };
                    }
                    const uni = await University.findOne({ _id: preferredUniversity, deactivatedAt: null });
                    if (!uni) throw { status: 404, message: 'University not found.', code: 'UNIVERSITY_NOT_FOUND' };

                    // Cross-check: Does this university belong to the selected country?
                    if (initial.preferredCountry !== 'OTHER' && uni.country.toString() !== initial.preferredCountry.toString()) {
                        throw { status: 400, message: 'University does not belong to the selected country.', code: 'MISMATCH' };
                    }

                    initial.preferredUniversity = uni._id;
                    initial.otherUniversity = null;
                }
            }
        } else {
            // If type is VISIT (or switched to it), clear university fields
            initial.preferredUniversity = null;
            initial.otherUniversity = null;
        }

        if (notes !== undefined) initial.notes = notes.trim();

        await initial.save();
        return sendResponse(res, true, initial);

    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// ============================================
// REFUND MANAGEMENT (Manager Only)
// ============================================

// Set process status to REFUND-APPR (Refund Approved)
router.patch('/processes/:processId/refund-approve', async (req, res) => {
    try {
        const { processId } = req.params;
        const { notes } = req.body;

        const process = await Process.findById(processId);
        if (!process) {
            return sendResponse(res, false, null, { status: 404, message: 'Process not found', code: 'NOT_FOUND' });
        }

        if (process.status !== 'REFUND-PEND') {
            return sendResponse(res, false, null, { status: 400, message: 'Process must be in REFUND-PEND status', code: 'INVALID_STATUS' });
        }

        process.status = 'REFUND-APPR';
        if (notes) process.reason = notes;
        await process.save();

        return sendResponse(res, true, process);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: error.message, code: 'UPDATE_ERROR' });
    }
});

// Set process status to REFUND-REJC (Refund Rejected)
router.patch('/processes/:processId/refund-reject', async (req, res) => {
    try {
        const { processId } = req.params;
        const { notes } = req.body;

        if (!notes || notes.trim().length === 0) {
            return sendResponse(res, false, null, { status: 400, message: 'Rejection reason is required', code: 'REASON_REQUIRED' });
        }

        const process = await Process.findById(processId);
        if (!process) {
            return sendResponse(res, false, null, { status: 404, message: 'Process not found', code: 'NOT_FOUND' });
        }

        if (process.status !== 'REFUND-PEND') {
            return sendResponse(res, false, null, { status: 400, message: 'Process must be in REFUND-PEND status', code: 'INVALID_STATUS' });
        }

        process.status = 'REFUND-REJC';
        process.reason = notes.trim();
        await process.save();

        return sendResponse(res, true, process);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: error.message, code: 'UPDATE_ERROR' });
    }
});

// Set process status to REFUND-COMP (Refund Completed)
router.patch('/processes/:processId/refund-complete', async (req, res) => {
    try {
        const { processId } = req.params;
        const { notes } = req.body;

        const process = await Process.findById(processId);
        if (!process) {
            return sendResponse(res, false, null, { status: 404, message: 'Process not found', code: 'NOT_FOUND' });
        }

        if (process.status !== 'REFUND-APPR') {
            return sendResponse(res, false, null, { status: 400, message: 'Process must be in REFUND-APPR status', code: 'INVALID_STATUS' });
        }

        process.status = 'REFUND-COMP';
        if (notes) process.reason = notes;
        await process.save();

        return sendResponse(res, true, process);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: error.message, code: 'UPDATE_ERROR' });
    }
});

/**
 * PATCH /manager/processes/:processId/mark-verified
 * Change DONE process status to VERIFIED
 */
router.patch('/processes/:processId/mark-verified', async (req, res) => {
    try {
        const { processId } = req.params;
        const { notes } = req.body;

        const process = await Process.findById(processId);
        if (!process) {
            return sendResponse(res, false, null, { status: 404, message: 'Process not found', code: 'NOT_FOUND' });
        }

        if (process.status !== PROCESS_STATUS.DONE) {
            return sendResponse(res, false, null, { status: 400, message: 'Process must be in DONE status', code: 'INVALID_STATUS' });
        }

        process.status = PROCESS_STATUS.VERIFIED;
        if (notes) process.notes = notes;
        await process.save();

        const populated = await Process.findById(processId)
            .populate('studentId')
            .populate('consultantId')
            .populate('agentId')
            .populate('universityId')
            .populate('countryId');

        return sendResponse(res, true, populated);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: error.message, code: 'UPDATE_ERROR' });
    }
});

/**
 * PATCH /manager/processes/:processId/mark-rejected
 * Change DONE process status to REJECTED
 */
router.patch('/processes/:processId/mark-rejected', async (req, res) => {
    try {
        const { processId } = req.params;
        const { notes } = req.body;

        const process = await Process.findById(processId);
        if (!process) {
            return sendResponse(res, false, null, { status: 404, message: 'Process not found', code: 'NOT_FOUND' });
        }

        if (process.status !== PROCESS_STATUS.DONE) {
            return sendResponse(res, false, null, { status: 400, message: 'Process must be in DONE status', code: 'INVALID_STATUS' });
        }

        process.status = PROCESS_STATUS.REJECTED;
        if (notes) process.notes = notes;
        await process.save();

        const populated = await Process.findById(processId)
            .populate('studentId')
            .populate('consultantId')
            .populate('agentId')
            .populate('universityId')
            .populate('countryId');

        return sendResponse(res, true, populated);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: error.message, code: 'UPDATE_ERROR' });
    }
});

export default router;
