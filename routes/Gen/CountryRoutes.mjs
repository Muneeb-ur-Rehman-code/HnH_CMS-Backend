import { Router } from 'express';
import Country from '../../models/Country/CountryModel.mjs';
import StaffProfile from '../../models/Users/StaffProfile.mjs';
import User from '../../models/Users/_UsersMain.mjs';
import University from '../../models/University/UniModel.mjs';
import { requireFullAuth, requireManager } from '../../middlewares/Auth.mjs';
import { STAFF_ROLE, STAFF_VERIFICATION_STATUS } from '../../models/Users/StaffProfile.mjs';
import { USER_STATUS } from '../../models/Users/_UsersMain.mjs';

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
const validateConsultant = async (staffProfileId) => {
    const staffProfile = await StaffProfile.findById(staffProfileId);
    if (!staffProfile) {
        const error = new Error('Consultant not found.');
        error.status = 404;
        error.code = 'CONSULTANT_NOT_FOUND';
        throw error;
    }

    if (staffProfile.staffRole !== STAFF_ROLE.CONSULTANT) {
        const error = new Error('Only consultants can be assigned to countries.');
        error.status = 400;
        error.code = 'INVALID_STAFF_ROLE';
        throw error;
    }

    const user = await User.findById(staffProfile.userId);
    if (!user || user.status !== USER_STATUS.ACTIVE) {
        const error = new Error('Consultant must be ACTIVE to be assigned to a country.');
        error.status = 400;
        error.code = 'CONSULTANT_NOT_ACTIVE';
        throw error;
    }
};

// Get all countries (without consultantId, excluding VST)
router.get('/', async (req, res) => {
    try {
        const countries = await Country.find({
            deactivatedAt: null,
            code: { $ne: 'VST' } // Exclude Visit Visa country
        })
            .select('-consultantId')
            .sort({ name: 1 });
        return sendResponse(res, true, countries);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Search countries (without consultantId)
router.get('/search', async (req, res) => {
    try {
        const { search } = req.query;

        if (!search || typeof search !== 'string' || search.trim().length < 2) {
            const error = new Error('Search term must be at least 2 characters long.');
            error.status = 400;
            error.code = 'INVALID_SEARCH_TERM';
            throw error;
        }

        const term = search.toLowerCase().trim();
        const uppercaseTerm = search.toUpperCase().trim();

        const query = {
            deactivatedAt: null,
            code: { $ne: 'VST' }, // Exclude Visit Visa country
            $or: [
                { name: { $regex: term, $options: 'i' } },
                { code: uppercaseTerm }
            ]
        };

        const countries = await Country.find(query)
            .select('-consultantId')
            .limit(10)
            .sort({ name: 1 });

        if (countries.length === 0) {
            const error = new Error('No active countries matched the search term.');
            error.status = 404;
            error.code = 'NOT_FOUND';
            throw error;
        }

        return sendResponse(res, true, countries);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Get deactivated countries
router.get('/deactivated', managerAuth, async (req, res) => {
    try {
        const countries = await Country.find({ deactivatedAt: { $ne: null } })
            .select('-consultantId')
            .sort({ name: 1 });
        return sendResponse(res, true, countries);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Create country (requires consultantId)
router.post('/create', managerAuth, async (req, res) => {
    try {
        const { name, code, consultantId } = req.body;

        if (!name || !name.trim()) {
            const error = new Error('Country name is required.');
            error.status = 400;
            error.code = 'NAME_REQUIRED';
            throw error;
        }

        if (!code) {
            const error = new Error('Country code is required.');
            error.status = 400;
            error.code = 'CODE_REQUIRED';
            throw error;
        }

        const formattedCode = validateAndFormatCode(code);

        // Prevent manual creation of VST (Visit Visa) country
        if (formattedCode === 'VST') {
            const error = new Error('VST code is system-reserved for Visit Visa country. Please use a different code.');
            error.status = 403;
            error.code = 'VST_CODE_RESERVED';
            throw error;
        }

        if (!consultantId) {
            const error = new Error('Consultant ID is required.');
            error.status = 400;
            error.code = 'CONSULTANT_ID_REQUIRED';
            throw error;
        }

        await validateConsultant(consultantId);

        const country = await Country.create({
            name: name.trim().toLowerCase(),
            code: formattedCode,
            consultantId
        });

        return res.status(201).json({ success: true, data: country });
    } catch (error) {
        if (error.code === 11000) {
            const duplicateError = new Error('A country with this code already exists.');
            duplicateError.status = 409;
            duplicateError.code = 'DUPLICATE_CODE';
            return sendResponse(res, false, null, duplicateError);
        }
        return sendResponse(res, false, null, error);
    }
});

// Update country (only name and code, not consultantId or deactivatedAt)
router.put('/update/:id', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, consultantId, deactivatedAt } = req.body;

        if (!id) {
            const error = new Error('Country ID is required.');
            error.status = 400;
            error.code = 'ID_REQUIRED';
            throw error;
        }

        // Prevent updating consultantId or deactivatedAt through this route
        if (consultantId !== undefined || deactivatedAt !== undefined) {
            const error = new Error('Cannot update consultantId or deactivatedAt through this route. Use assign-consultant, activate, or deactivate routes instead.');
            error.status = 400;
            error.code = 'INVALID_UPDATE_FIELD';
            throw error;
        }

        const updateData = {};
        if (name !== undefined) {
            if (!name || !name.trim()) {
                const error = new Error('Country name cannot be empty.');
                error.status = 400;
                error.code = 'INVALID_NAME';
                throw error;
            }
            updateData.name = name.trim().toLowerCase();
        }

        if (code !== undefined) {
            const formattedCode = validateAndFormatCode(code);

            // Prevent updating code to VST (Visit Visa) - reserved code
            if (formattedCode === 'VST') {
                const error = new Error('VST code is system-reserved for Visit Visa country. Please use a different code.');
                error.status = 403;
                error.code = 'VST_CODE_RESERVED';
                throw error;
            }

            updateData.code = formattedCode;
        }

        if (Object.keys(updateData).length === 0) {
            const error = new Error('No valid fields to update.');
            error.status = 400;
            error.code = 'NO_UPDATE_DATA';
            throw error;
        }

        const country = await Country.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!country) {
            const error = new Error('Country not found.');
            error.status = 404;
            error.code = 'NOT_FOUND';
            throw error;
        }

        return sendResponse(res, true, country);
    } catch (error) {
        if (error.code === 11000) {
            const duplicateError = new Error('A country with this code already exists.');
            duplicateError.status = 409;
            duplicateError.code = 'DUPLICATE_CODE';
            return sendResponse(res, false, null, duplicateError);
        }
        return sendResponse(res, false, null, error);
    }
});

// Activate country
router.put('/activate/:id', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            const error = new Error('Country ID is required.');
            error.status = 400;
            error.code = 'ID_REQUIRED';
            throw error;
        }

        const country = await Country.findByIdAndUpdate(
            id,
            { $set: { deactivatedAt: null } },
            { new: true, runValidators: true }
        );

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

        if (!id) {
            const error = new Error('Country ID is required.');
            error.status = 400;
            error.code = 'ID_REQUIRED';
            throw error;
        }

        // Deactivate associated universities
        await University.updateMany(
            { country: id, deactivatedAt: null },
            { $set: { deactivatedAt: new Date() } }
        );

        const country = await Country.findByIdAndUpdate(
            id,
            { $set: { deactivatedAt: new Date() } },
            { new: true }
        );

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

// Assign consultant (replaces previous consultant)
router.put('/assign-consultant/:id', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { consultantId } = req.body;

        if (!id) {
            const error = new Error('Country ID is required.');
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

        await validateConsultant(consultantId);

        const country = await Country.findByIdAndUpdate(
            id,
            { $set: { consultantId } },
            { new: true }
        );

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

// Get Visit Visa consultant
router.get('/visit-visa-consultant', managerAuth, async (req, res) => {
    try {
        const vstCountry = await Country.findOne({ code: 'VST', deactivatedAt: null })
            .populate('consultantId', 'staffRole verificationStatus')
            .populate({
                path: 'consultantId',
                populate: { path: 'userId', select: 'email firstName lastName phoneNumber status' }
            });

        if (!vstCountry || !vstCountry.consultantId) {
            return sendResponse(res, true, { consultant: null, isVisitVisaConsultant: false });
        }

        return sendResponse(res, true, {
            consultant: vstCountry.consultantId,
            isVisitVisaConsultant: true
        });
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Assign Visit Visa consultant
router.put('/visit-visa-consultant/assign', managerAuth, async (req, res) => {
    try {
        const { consultantId } = req.body;

        if (!consultantId) {
            const error = new Error('Consultant ID is required.');
            error.status = 400;
            error.code = 'CONSULTANT_ID_REQUIRED';
            throw error;
        }

        await validateConsultant(consultantId);

        // Check if consultant is verified
        const staffProfile = await StaffProfile.findById(consultantId);
        if (staffProfile.verificationStatus !== STAFF_VERIFICATION_STATUS.VERIFIED) {
            const error = new Error('Consultant must be verified to be assigned as Visit Visa consultant.');
            error.status = 400;
            error.code = 'CONSULTANT_NOT_VERIFIED';
            throw error;
        }

        // Find or create VST country (internal system use only)
        let vstCountry = await Country.findOne({ code: 'VST' });

        if (!vstCountry) {
            // Create VST country (internal)
            vstCountry = await Country.create({
                name: 'visit visa',
                code: 'VST',
                consultantId
            });
        } else {
            // Update existing VST country
            vstCountry.consultantId = consultantId;
            vstCountry.deactivatedAt = null; // Ensure it's active
            await vstCountry.save();
        }

        // Return only consultant information
        const consultant = await StaffProfile.findById(consultantId)
            .populate('userId', 'email firstName lastName phoneNumber status');

        return sendResponse(res, true, {
            consultant,
            isVisitVisaConsultant: true,
            message: 'Consultant assigned as Visit Visa consultant successfully'
        });
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Remove Visit Visa consultant
router.delete('/visit-visa-consultant', managerAuth, async (req, res) => {
    try {
        const vstCountry = await Country.findOne({ code: 'VST' });

        if (!vstCountry || !vstCountry.consultantId) {
            const error = new Error('Visit Visa consultant not found.');
            error.status = 404;
            error.code = 'NOT_FOUND';
            throw error;
        }

        // Delete VST country (internal system cleanup)
        await Country.findByIdAndDelete(vstCountry._id);

        return sendResponse(res, true, {
            message: 'Visit Visa consultant access removed successfully',
            isVisitVisaConsultant: false
        });
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

export default router;
