import { Router } from 'express';
import Country from '../../models/Country/CountryModel.mjs';
import StaffProfile from '../../models/Users/StaffProfile.mjs';
import User from '../../models/Users/_UsersMain.mjs';
import University from '../../models/University/UniModel.mjs';
import { requireFullAuth, requireManager, optionalAttachUser } from '../../middlewares/Auth.mjs';
import { STAFF_ROLE, STAFF_VERIFICATION_STATUS } from '../../models/Users/StaffProfile.mjs';
import { USER_STATUS, USER_ROLE } from '../../models/Users/_UsersMain.mjs';

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

// Validate and format country code
const validateAndFormatCode = (code) => {
    if (!code) return null;
    const cleanCode = code.toUpperCase().trim();
    if (!/^[A-Z]{3}$/.test(cleanCode)) {
        const error = new Error('Code must be exactly 3 uppercase letters (e.g., USA, PAK).');
        error.status = 400;
        error.code = 'INVALID_CODE';
        throw error;
    }
    return cleanCode;
};

// Validate consultant is active and has CONSULTANT role
const validateStaffForAssignment = async (staffId, expectedRole) => {
    // 1. Check if ID was even provided
    if (!staffId) {
        throw { status: 400, message: `${expectedRole} consultant ID is required.`, code: 'ID_REQUIRED' };
    }

    // 2. Fetch and populate user
    const staff = await StaffProfile.findById(staffId).populate('userId');

    if (!staff) {
        throw { status: 404, message: 'Consultant profile not found.', code: 'STAFF_NOT_FOUND' };
    }

    // 3. Check Role
    if (staff.staffRole !== expectedRole) {
        throw { status: 400, message: `Invalid Role: Expected ${expectedRole}, got ${staff.staffRole}`, code: 'INVALID_ROLE' };
    }

    // 4. Check Verification
    if (staff.verificationStatus !== STAFF_VERIFICATION_STATUS.VERIFIED) {
        throw { status: 403, message: 'Consultant must be VERIFIED by a manager first.', code: 'CONSULTANT_NOT_VERIFIED' };
    }

    // 5. Check User Account Status
    if (!staff.userId || staff.userId.status !== USER_STATUS.ACTIVE) {
        throw { status: 403, message: 'The user account for this consultant is not active.', code: 'USER_INACTIVE' };
    }

    return staff;
};

const MANAGER_POPULATION = [
    {
        path: 'consultantId',
        select: 'userId staffRole verificationStatus',
        populate: { path: 'userId', select: 'firstName lastName email' }
    },
    {
        path: 'visitConsultantId',
        select: 'userId staffRole verificationStatus',
        populate: { path: 'userId', select: 'firstName lastName email' }
    }
];

// Combined Get All
router.get('/', optionalAttachUser, async (req, res) => {
    try {
        const staff = req.user ? await StaffProfile.findOne({ userId: req.userId }) : null;
        const isManager = staff?.staffRole === STAFF_ROLE.MANAGER && staff?.verificationStatus === STAFF_VERIFICATION_STATUS.VERIFIED;

        let query = Country.find().sort({ name: 1 });

        if (isManager) {
            query = query.populate(MANAGER_POPULATION);
        } else {
            query = query.select('name code'); // Public view: Hide ALL consultant IDs
        }

        const countries = await query;
        return sendResponse(res, true, countries);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});


// Search countries (without consultantId)
router.get('/search', optionalAttachUser, async (req, res) => {
    try {
        const { search } = req.query;
        if (!search || search.trim().length < 2) {
            throw { status: 400, message: 'Search term must be at least 2 chars', code: 'INVALID_SEARCH' };
        }

        const staff = req.user?.role === USER_ROLE.STAFF ? await StaffProfile.findOne({ userId: req.userId }) : null;
        const isVerifiedManager = staff?.staffRole === STAFF_ROLE.MANAGER && staff?.verificationStatus === STAFF_VERIFICATION_STATUS.VERIFIED;

        const term = search.trim();
        const filter = {
            deactivatedAt: null,
            $or: [
                { name: { $regex: term, $options: 'i' } },
                { code: term.toUpperCase() }
            ]
        };

        let query = Country.find(filter).limit(10).sort({ name: 1 });

        if (isVerifiedManager) {
            query = query.populate(MANAGER_POPULATION);
        } else {
            query = query.select('name code');
        }

        const countries = await query;
        return sendResponse(res, true, countries);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Get deactivated countries
router.get('/deactivated', managerAuth, async (req, res) => {
    try {
        const query = Country.find({ deactivatedAt: { $ne: null } });
        query.setOptions({ includeDeactivated: true });
        const countries = await query
            .select('-consultantId')
            .sort({ name: 1 });
        return sendResponse(res, true, countries);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});
/*
// Create country (requires consultantId)
// router.post('/create', managerAuth, async (req, res) => {
//     try {
//         const { name, code, consultantId, visitConsultantId } = req.body || {};

//         // Validation Block
//         if (!name?.trim()) throw { status: 400, message: 'Country name is required.', code: 'NAME_REQUIRED' };
//         if (!code) throw { status: 400, message: 'Country code is required.', code: 'CODE_REQUIRED' };

//         const formattedCode = validateAndFormatCode(code);

//         // Required Consultant Validations
//         await validateStaffForAssignment(consultantId, STAFF_ROLE.CONSULTANT); // Study
//         await validateStaffForAssignment(visitConsultantId, STAFF_ROLE.VISIT);   // Visit

//         const country = await Country.create({
//             name: name.trim().toLowerCase(),
//             code: formattedCode,
//             consultantId,
//             visitConsultantId
//         });

//         return sendResponse(res, true, country);
//     } catch (error) {
//         if (error.code === 11000) {
//             return sendResponse(res, false, null, { status: 409, message: 'Country code already exists.', code: 'DUPLICATE' });
//         }
//         return sendResponse(res, false, null, error);
//     }
// });

// Update country (only name and code, not consultantId or deactivatedAt)
// router.put('/update/:id', managerAuth, async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { name, code, consultantId, visitConsultantId, deactivatedAt } = req.body || {};

//         if (!id) {
//             const error = new Error('Country ID is required.');
//             error.status = 400;
//             error.code = 'ID_REQUIRED';
//             throw error;
//         }

//         // Prevent updating consultantId or deactivatedAt through this route
//         if (consultantId !== undefined || deactivatedAt !== undefined || visitConsultantId !== undefined) {
//             const error = new Error('Cannot update consultantId or deactivatedAt through this route. Use assign-consultant, activate, or deactivate routes instead.');
//             error.status = 400;
//             error.code = 'INVALID_UPDATE_FIELD';
//             throw error;
//         }

//         const updateData = {};
//         if (name !== undefined) {
//             if (!name || !name.trim()) {
//                 const error = new Error('Country name cannot be empty.');
//                 error.status = 400;
//                 error.code = 'INVALID_NAME';
//                 throw error;
//             }
//             updateData.name = name.trim().toLowerCase();
//         }

//         if (code !== undefined) {
//             const formattedCode = validateAndFormatCode(code);

//             // Prevent updating code to VST (Visit Visa) - reserved code
//             if (formattedCode === 'VST') {
//                 const error = new Error('VST code is system-reserved for Visit Visa country. Please use a different code.');
//                 error.status = 403;
//                 error.code = 'VST_CODE_RESERVED';
//                 throw error;
//             }

//             updateData.code = formattedCode;
//         }

//         if (Object.keys(updateData).length === 0) {
//             const error = new Error('No valid fields to update.');
//             error.status = 400;
//             error.code = 'NO_UPDATE_DATA';
//             throw error;
//         }

//         const country = await Country.findByIdAndUpdate(
//             id,
//             { $set: updateData },
//             { new: true, runValidators: true }
//         );

//         if (!country) {
//             const error = new Error('Country not found.');
//             error.status = 404;
//             error.code = 'NOT_FOUND';
//             throw error;
//         }

//         return sendResponse(res, true, country);
//     } catch (error) {
//         if (error.code === 11000) {
//             const duplicateError = new Error('A country with this code already exists.');
//             duplicateError.status = 409;
//             duplicateError.code = 'DUPLICATE_CODE';
//             return sendResponse(res, false, null, duplicateError);
//         }
//         return sendResponse(res, false, null, error);
//     }
// });
*/

// Activate country
router.put('/activate/:id', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) throw { status: 400, message: 'Country ID is required.', code: 'ID_REQUIRED' };

        const countryToCheck = await Country.findById(id).setOptions({ includeDeactivated: true });
        if (!countryToCheck) throw { status: 404, message: 'Country not found.', code: 'NOT_FOUND' };

        if (!countryToCheck.consultantId || !countryToCheck.visitConsultantId) throw { status: 400, message: 'Cannot activate: Both Study and Visit consultants must be assigned first.', code: 'ASSIGNMENT_REQUIRED' };
        await Promise.all([
            validateStaffForAssignment(countryToCheck.consultantId, STAFF_ROLE.CONSULTANT),
            validateStaffForAssignment(countryToCheck.visitConsultantId, STAFF_ROLE.VISIT)
        ]);

        const country = await Country.findByIdAndUpdate(
            id,
            { $set: { deactivatedAt: null } },
            {
                new: true,
                runValidators: true,
                includeDeactivated: true
            }
        ).populate(MANAGER_POPULATION);

        if (!country) {
            const error = new Error('Country not found.');
            error.status = 404;
            error.code = 'NOT_FOUND';
            throw error;
        }
        return sendResponse(res, true, country);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Deactivate country
router.delete('/deactivate/:id', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) throw { message: 'Country ID is required.', code: 'ID_REQUIRED', status: 400 }

        // Deactivate associated universities
        const country = await Country.findByIdAndUpdate(
            id,
            { $set: { deactivatedAt: new Date() } },
            { new: true }
        ).populate(MANAGER_POPULATION);

        if (!country) throw { message: 'Country not found.', code: 'NOT_FOUND', status: 404 }

        return sendResponse(res, true, country);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});


// Assign consultant (replaces previous consultant)
router.put('/assign-study/:id', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { consultantId } = req.body || {};

        if (!id) throw { status: 400, message: 'Country ID required', code: 'ID_MISSING' };

        await validateStaffForAssignment(consultantId, STAFF_ROLE.CONSULTANT);

        const country = await Country.findByIdAndUpdate(
            id,
            { $set: { consultantId } },
            { new: true, includeDeactivated: true }
        ).populate(MANAGER_POPULATION);

        if (!country) throw { status: 404, message: 'Country not found', code: 'NOT_FOUND' };
        return sendResponse(res, true, country);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Assign/Swap Visit Consultant
router.put('/assign-visit/:id', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { visitConsultantId } = req.body || {};

        if (!id) throw { status: 400, message: 'Country ID required', code: 'ID_MISSING' };

        await validateStaffForAssignment(visitConsultantId, STAFF_ROLE.VISIT);

        const country = await Country.findByIdAndUpdate(
            id,
            { $set: { visitConsultantId } },
            { new: true, includeDeactivated: true }
        ).populate(MANAGER_POPULATION);

        if (!country) throw { status: 404, message: 'Country not found', code: 'NOT_FOUND' };
        return sendResponse(res, true, country);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});


export default router;
