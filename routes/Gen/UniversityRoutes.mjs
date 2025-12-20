import { Router } from 'express';
import mongoose from 'mongoose';
import Country from '../../models/Country/CountryModel.mjs';
import University from '../../models/University/UniModel.mjs';
import StaffProfile from '../../models/Users/StaffProfile.mjs';
import { STAFF_ROLE, STAFF_VERIFICATION_STATUS } from '../../models/Users/StaffProfile.mjs';
import { requireFullAuth, requireManager, optionalAttachUser } from '../../middlewares/Auth.mjs';
import uploadMiddleware from '../../middlewares/upload.mjs';

const { uploadSingle, deleteFile } = uploadMiddleware;
const router = Router();

// --- CONFIGURATION & CONSTANTS ---
const managerAuth = [requireFullAuth, requireManager];

// Field Masking: What the public sees vs what the Manager sees
const PUBLIC_FIELDS = 'name shortName imagePath city state country zip';
const MANAGER_POPULATION = {
    path: 'country',
    select: 'name code consultantId visitConsultantId'
};
const PUBLIC_POPULATION = {
    path: 'country',
    select: 'name code'
};

// --- HELPERS ---

const sendResponse = (res, success, data, error) => {
    if (success) {
        return res.status(200).json({
            success: true,
            count: Array.isArray(data) ? data.length : undefined,
            data
        });
    }

    // Cleanup: If a file was uploaded but the DB operation failed, delete it
    if (error?.uploadedFile?.path) {
        deleteFile(error.uploadedFile.path);
    }

    return res.status(error?.status || 500).json({
        success: false,
        message: error?.message || 'Server error',
        code: error?.code || 'SERVER_ERROR'
    });
};

const validateId = (id, type = 'University') => {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw { status: 400, message: `Invalid ${type} ID format.`, code: 'INVALID_ID' };
    }
};

const getValidatedActiveCountry = async (countryId) => {
    validateId(countryId, 'Country');
    const country = await Country.findById(countryId);
    if (!country || country.deactivatedAt) {
        throw { status: 404, message: 'Country not found or is currently deactivated.', code: 'COUNTRY_INACTIVE' };
    }
    return country;
};

const validateAndFormatShortName = (shortName) => {
    const clean = shortName?.toUpperCase().trim();
    if (!clean || !/^[A-Z0-9]{3,10}$/.test(clean)) {
        throw { status: 400, message: 'Short name must be 3-10 alphanumeric characters.', code: 'INVALID_SHORT_NAME' };
    }
    return clean;
};

// --- PUBLIC ROUTES ---

// Get all active universities
router.get('/', optionalAttachUser, async (req, res) => {
    try {
        const staff = req.user ? await StaffProfile.findOne({ userId: req.user._id }) : null;
        const isManager = (staff?.staffRole === STAFF_ROLE.MANAGER || staff?.staffRole === STAFF_ROLE.ADMIN) && staff?.verificationStatus === STAFF_VERIFICATION_STATUS.VERIFIED;

        let query = University.find();
        if (isManager) {
            query = query
                .populate(MANAGER_POPULATION)
                .select('+deactivatedAt +createdAt +updatedAt');
        } else {
            query = query
                .where({ deactivatedAt: null })
                .select(PUBLIC_FIELDS)
                .populate(PUBLIC_POPULATION);
        }

        const universities = await query.sort({ name: 1 });

        return sendResponse(res, true, universities);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Get universities by country (Public)
router.get('/country/:countryId', optionalAttachUser, async (req, res) => {
    try {
        const { countryId } = req.params;
        const staff = req.user ? await StaffProfile.findOne({ userId: req.user._id }) : null;
        const isManager = (staff?.staffRole === STAFF_ROLE.MANAGER || staff?.staffRole === STAFF_ROLE.ADMIN) && staff?.verificationStatus === STAFF_VERIFICATION_STATUS.VERIFIED;

        validateId(countryId, 'Country');

        const country = await Country.findById(countryId);
        if (!country || (country.deactivatedAt && !isManager)) {
            throw {
                status: 404,
                message: 'Country not found or is currently unavailable.',
                code: 'COUNTRY_NOT_FOUND'
            };
        }

        const findQuery = { country: countryId };
        if (!isManager) {
            findQuery.deactivatedAt = null;
        }

        let query = University.find(findQuery);

        if (isManager) {
            query = query
                .populate(MANAGER_POPULATION)
                .select('+deactivatedAt +createdAt +updatedAt');
        } else {
            query = query
                .select(PUBLIC_FIELDS)
                .populate(PUBLIC_POPULATION);
        }

        const universities = await query.sort({ name: 1 });

        return sendResponse(res, true, universities);

    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Search universities
router.get('/search', optionalAttachUser, async (req, res) => {
    try {
        const { search } = req.query || {};
        const staff = req.user ? await StaffProfile.findOne({ userId: req.user._id }) : null;
        const isManager = (staff?.staffRole === STAFF_ROLE.MANAGER || staff?.staffRole === STAFF_ROLE.ADMIN) && staff?.verificationStatus === STAFF_VERIFICATION_STATUS.VERIFIED;

        if (!search || typeof search !== 'string' || search.trim().length < 2) {
            throw { status: 400, message: 'Search term must be at least 2 characters.', code: 'INVALID_SEARCH' };
        }

        const term = search.trim();

        const regex = new RegExp(term, 'i');

        const findQuery = {
            $or: [
                { name: { $regex: regex } },
                { shortName: { $regex: regex } },
                { city: { $regex: regex } },
                { state: { $regex: regex } }
            ]
        };

        if (!isManager) {
            findQuery.deactivatedAt = null;
        }

        let query = University.find(findQuery);

        if (isManager) {
            query = query
                .populate(MANAGER_POPULATION)
                .select('+deactivatedAt +createdAt +updatedAt');
        } else {
            query = query
                .select(PUBLIC_FIELDS)
                .populate(PUBLIC_POPULATION);
        }

        const universities = await query.sort({ name: 1 });

        return sendResponse(res, true, universities);

    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// --- MANAGER ROUTES ---

// Create university
router.post('/create', managerAuth, uploadSingle('image'), async (req, res) => {
    try {
        const { name, shortName, country, state, city, zip } = req.body || {};

        if (!name?.trim()) throw { status: 400, message: 'University name is required.', code: 'NAME_REQUIRED' };

        await getValidatedActiveCountry(country);
        const formattedShortName = validateAndFormatShortName(shortName);

        const university = await University.create({
            name: name.trim(),
            shortName: formattedShortName,
            country,
            state: state?.trim(),
            city: city?.trim(),
            zip: zip?.trim() || null,
            imagePath: req.fileInfo?.path || null
        });

        const result = await University.findById(university._id).populate(MANAGER_POPULATION);
        return sendResponse(res, true, result);
    } catch (error) {
        error.uploadedFile = req.fileInfo; // Pass to helper for deletion
        if (error.code === 11000) {
            return sendResponse(res, false, null, { status: 409, message: 'Short name already exists.', code: 'DUPLICATE' });
        }
        return sendResponse(res, false, null, error);
    }
});

// Update university
router.put('/update/:id', managerAuth, uploadSingle('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body || {};
        validateId(id);

        const existing = await University.findById(id, null, { includeDeactivated: true });
        if (!existing) throw { status: 404, message: 'University not found.', code: 'NOT_FOUND' };

        const updateData = {};
        if (body.name?.trim()) updateData.name = body.name.trim();
        if (body.shortName) updateData.shortName = validateAndFormatShortName(body.shortName);
        if (body.state?.trim()) updateData.state = body.state.trim();
        if (body.city?.trim()) updateData.city = body.city.trim();
        if (body.zip !== undefined) updateData.zip = body.zip?.trim() || null;

        if (body.country) {
            await getValidatedActiveCountry(body.country);
            updateData.country = body.country;
        }

        // Image Swap Logic
        if (req.fileInfo) {
            if (existing.imagePath) deleteFile(existing.imagePath);
            updateData.imagePath = req.fileInfo.path;
        } else if (body.removeImage === 'true') {
            if (existing.imagePath) deleteFile(existing.imagePath);
            updateData.imagePath = null;
        }

        const updated = await University.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate(MANAGER_POPULATION);

        return sendResponse(res, true, updated);
    } catch (error) {
        error.uploadedFile = req.fileInfo;
        return sendResponse(res, false, null, error);
    }
});

// Activate university
router.put('/activate/:id', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;
        validateId(id);

        const university = await University.findById(id, null, { includeDeactivated: true });
        if (!university) throw { status: 404, message: 'University not found.' };

        // Ensure the parent country is active before allowing uni activation
        await getValidatedActiveCountry(university.country);

        university.deactivatedAt = null;
        await university.save();

        return sendResponse(res, true, await university.populate(MANAGER_POPULATION));
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Soft Delete / Deactivate
router.delete('/deactivate/:id', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;
        validateId(id);

        const university = await University.findByIdAndUpdate(
            id,
            { $set: { deactivatedAt: new Date() } },
            { new: true }
        ).populate(MANAGER_POPULATION);

        if (!university) throw { status: 404, message: 'University not found.' };
        return sendResponse(res, true, university);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Get all deactivated (Audit list for Managers)
router.get('/deactivated', managerAuth, async (req, res) => {
    try {
        const universities = await University.find({ deactivatedAt: { $ne: null } }, null, { includeDeactivated: true })
            .populate(MANAGER_POPULATION)
            .sort({ deactivatedAt: -1 });

        return sendResponse(res, true, universities);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

export default router;