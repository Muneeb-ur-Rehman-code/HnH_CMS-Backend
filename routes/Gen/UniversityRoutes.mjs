import { Router } from 'express';
import Country from '../../models/Country/CountryModel.mjs';
import University from '../../models/University/UniModel.mjs';
import { requireFullAuth, requireManager } from '../../middlewares/Auth.mjs';
import uploadMiddleware from '../../middlewares/upload.mjs';
import mongoose from 'mongoose';

const { uploadSingle, deleteFile } = uploadMiddleware;

const router = Router();

const sendResponse = (res, success, data, error) => {
    if (success) {
        if (Array.isArray(data)) {
            return res.status(200).json({ success: true, count: data.length, data });
        } else {
            return res.status(200).json({ success: true, data });
        }
    } else {
        if (error?.uploadedFile && deleteFile) {
            deleteFile(error.uploadedFile.path);
        }

        return res.status(error?.status || 500).json({
            success: false,
            message: error?.message || 'Server error',
            code: error?.code || 'SERVER_ERROR'
        });
    }
};

const managerAuth = [requireFullAuth, requireManager];

// Validate and format short name
const validateAndFormatShortName = (shortName) => {
    if (!shortName) return null;
    const cleanShortName = shortName.toUpperCase().trim();
    if (!/^[A-Z0-9]{3,10}$/.test(cleanShortName)) {
        const error = new Error('Short name must be 3 to 10 uppercase alphanumeric characters.');
        error.status = 400;
        error.code = 'INVALID_SHORT_NAME';
        throw error;
    }
    return cleanShortName;
};

// Validate country ID format
const validateCountryId = (countryId) => {
    if (!countryId) return false;
    if (!mongoose.Types.ObjectId.isValid(countryId)) {
        const error = new Error('Invalid Country ID format.');
        error.status = 400;
        error.code = 'INVALID_COUNTRY_ID';
        throw error;
    }
    return true;
};

// Validate country is not deactivated
const validateCountryActive = async (countryId) => {
    validateCountryId(countryId);
    const country = await Country.findById(countryId);
    if (!country || country.deactivatedAt !== null) {
        const error = new Error('Country is not found or is deactivated.');
        error.status = 404;
        error.code = 'COUNTRY_INACTIVE';
        throw error;
    }
    return true;
};

// Get all universities
router.get('/', async (req, res) => {
    try {
        const universities = await University.find({ deactivatedAt: null })
            .populate('country')
            .sort({ name: 1 });
        return sendResponse(res, true, universities);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Get universities by country
router.get('/country/:countryId', async (req, res) => {
    try {
        const { countryId } = req.params;

        if (!countryId) {
            const error = new Error('Country ID is required.');
            error.status = 400;
            error.code = 'COUNTRY_ID_REQUIRED';
            throw error;
        }

        validateCountryId(countryId);

        const universities = await University.find({
            country: countryId,
            deactivatedAt: null
        })
            .populate('country')
            .sort({ name: 1 });

        if (universities.length === 0) {
            const error = new Error(`No active universities found for country ID: ${countryId}.`);
            error.status = 404;
            error.code = 'NOT_FOUND';
            throw error;
        }

        return sendResponse(res, true, universities);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Search universities
router.get('/search', async (req, res) => {
    try {
        const { search } = req.query;

        if (!search || typeof search !== 'string' || search.trim().length < 2) {
            const error = new Error('Search term must be at least 2 characters long.');
            error.status = 400;
            error.code = 'INVALID_SEARCH_TERM';
            throw error;
        }

        const term = search.trim();
        const uppercaseTerm = term.toUpperCase();

        const query = {
            deactivatedAt: null,
            $or: [
                { name: { $regex: term, $options: 'i' } },
                { shortName: uppercaseTerm }
            ]
        };

        let universities = await University.find(query)
            .populate('country')
            .limit(10)
            .sort({ name: 1 });

        // If less than 10 results, try text search
        if (universities.length < 10) {
            const uniqueIds = new Set(universities.map(u => u._id.toString()));

            const textResults = await University.find({
                $text: { $search: term },
                deactivatedAt: null,
                _id: { $nin: Array.from(uniqueIds) }
            }, { score: { $meta: 'textScore' } })
                .populate('country')
                .sort({ score: { $meta: 'textScore' } })
                .limit(10 - universities.length);

            universities = [...universities, ...textResults];
        }

        if (universities.length === 0) {
            const error = new Error('No active universities matched the search term.');
            error.status = 404;
            error.code = 'NOT_FOUND';
            throw error;
        }

        return sendResponse(res, true, universities);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Get deactivated universities
router.get('/deactivated', managerAuth, async (req, res) => {
    try {
        const { countryId } = req.query;

        const query = { deactivatedAt: { $ne: null } };
        if (countryId) {
            validateCountryId(countryId);
            query.country = countryId;
        }

        const universities = await University.find(query, null, { includeDeactivated: true })
            .populate('country')
            .sort({ name: 1 });

        if (universities.length === 0) {
            const message = countryId
                ? `No deactivated universities found in country ID: ${countryId}.`
                : 'No deactivated universities found.';
            const error = new Error(message);
            error.status = 404;
            error.code = 'NOT_FOUND';
            throw error;
        }

        return sendResponse(res, true, universities);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Create university
router.post('/create', managerAuth, uploadSingle('image'), async (req, res) => {
    try {
        const { name, shortName, country, state, city, zip } = req.body;

        if (!name || !name.trim()) {
            const error = new Error('University name is required.');
            error.status = 400;
            error.code = 'NAME_REQUIRED';
            throw error;
        }

        if (!shortName) {
            const error = new Error('University short name is required.');
            error.status = 400;
            error.code = 'SHORT_NAME_REQUIRED';
            throw error;
        }

        if (!country) {
            const error = new Error('Country ID is required.');
            error.status = 400;
            error.code = 'COUNTRY_ID_REQUIRED';
            throw error;
        }

        if (!state || !state.trim()) {
            const error = new Error('State/Province is required.');
            error.status = 400;
            error.code = 'STATE_REQUIRED';
            throw error;
        }

        if (!city || !city.trim()) {
            const error = new Error('City is required.');
            error.status = 400;
            error.code = 'CITY_REQUIRED';
            throw error;
        }

        // Validate country is not deactivated
        await validateCountryActive(country);

        const formattedShortName = validateAndFormatShortName(shortName);

        const universityData = {
            name: name.trim(),
            shortName: formattedShortName,
            country,
            state: state.trim(),
            city: city.trim(),
            zip: zip ? zip.trim() : null
        };

        if (req.fileInfo) {
            universityData.imagePath = req.fileInfo.path;
        }

        const university = await University.create(universityData);
        const populatedUniversity = await University.findById(university._id).populate('country');

        return res.status(201).json({ success: true, data: populatedUniversity });
    } catch (error) {
        error.uploadedFile = req.fileInfo;
        if (error.code === 11000) {
            const duplicateError = new Error('A university with this short name already exists.');
            duplicateError.status = 409;
            duplicateError.code = 'DUPLICATE_SHORT_NAME';
            return sendResponse(res, false, null, duplicateError);
        }
        return sendResponse(res, false, null, error);
    }
});

// Update university (cannot change deactivatedAt)
router.put('/update/:id', managerAuth, uploadSingle('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, shortName, country, state, city, zip, imagePath, deactivatedAt } = req.body;

        if (!id) {
            const error = new Error('University ID is required.');
            error.status = 400;
            error.code = 'ID_REQUIRED';
            throw error;
        }

        // Prevent updating deactivatedAt through this route
        if (deactivatedAt !== undefined) {
            const error = new Error('Cannot update deactivatedAt through this route. Use activate or deactivate routes instead.');
            error.status = 400;
            error.code = 'INVALID_UPDATE_FIELD';
            throw error;
        }

        // Get existing university to check for old image
        const existingUniversity = await University.findOne({ _id: id }, 'imagePath', { includeDeactivated: true });
        if (!existingUniversity) {
            if (req.fileInfo) deleteFile(req.fileInfo.path);
            const error = new Error('University not found.');
            error.status = 404;
            error.code = 'NOT_FOUND';
            throw error;
        }

        const updateData = {};
        const oldImagePath = existingUniversity.imagePath;

        if (name !== undefined) {
            if (!name || !name.trim()) {
                const error = new Error('University name cannot be empty.');
                error.status = 400;
                error.code = 'INVALID_NAME';
                throw error;
            }
            updateData.name = name.trim();
        }

        if (shortName !== undefined) {
            updateData.shortName = validateAndFormatShortName(shortName);
        }

        if (country !== undefined) {
            await validateCountryActive(country);
            updateData.country = country;
        }

        if (state !== undefined) {
            if (!state || !state.trim()) {
                const error = new Error('State/Province cannot be empty.');
                error.status = 400;
                error.code = 'INVALID_STATE';
                throw error;
            }
            updateData.state = state.trim();
        }

        if (city !== undefined) {
            if (!city || !city.trim()) {
                const error = new Error('City cannot be empty.');
                error.status = 400;
                error.code = 'INVALID_CITY';
                throw error;
            }
            updateData.city = city.trim();
        }

        if (zip !== undefined) {
            updateData.zip = zip ? zip.trim() : null;
        }

        // Handle image
        if (req.fileInfo) {
            // New image uploaded
            if (oldImagePath && deleteFile) {
                await deleteFile(oldImagePath);
            }
            updateData.imagePath = req.fileInfo.path;
        } else if (imagePath === 'null' || imagePath === null) {
            // Explicitly requesting image removal
            if (oldImagePath && deleteFile) {
                await deleteFile(oldImagePath);
            }
            updateData.imagePath = null;
        }

        if (Object.keys(updateData).length === 0) {
            const error = new Error('No valid fields to update.');
            error.status = 400;
            error.code = 'NO_UPDATE_DATA';
            throw error;
        }

        const university = await University.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('country');

        if (!university) {
            const error = new Error('University not found.');
            error.status = 404;
            error.code = 'NOT_FOUND';
            throw error;
        }

        return sendResponse(res, true, university);
    } catch (error) {
        error.uploadedFile = req.fileInfo;
        if (error.code === 11000) {
            const duplicateError = new Error('The updated short name is already in use by another active university.');
            duplicateError.status = 409;
            duplicateError.code = 'DUPLICATE_SHORT_NAME';
            return sendResponse(res, false, null, duplicateError);
        }
        return sendResponse(res, false, null, error);
    }
});

// Activate university
router.put('/activate/:id', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            const error = new Error('University ID is required.');
            error.status = 400;
            error.code = 'ID_REQUIRED';
            throw error;
        }

        // Find university including deactivated ones
        const university = await University.findOne({ _id: id }, null, { includeDeactivated: true });
        if (!university) {
            const error = new Error('University not found.');
            error.status = 404;
            error.code = 'NOT_FOUND';
            throw error;
        }

        // Validate country is active
        await validateCountryActive(university.country);

        university.deactivatedAt = null;
        const activatedUniversity = await university.save();
        const populatedUniversity = await University.findById(activatedUniversity._id).populate('country');

        return sendResponse(res, true, populatedUniversity);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

// Deactivate university
router.delete('/deactivate/:id', managerAuth, async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            const error = new Error('University ID is required.');
            error.status = 400;
            error.code = 'ID_REQUIRED';
            throw error;
        }

        const university = await University.findById(id);
        if (!university) {
            const error = new Error('University not found.');
            error.status = 404;
            error.code = 'NOT_FOUND';
            throw error;
        }

        // Delete image if exists
        if (university.imagePath && deleteFile) {
            const deleteResult = await deleteFile(university.imagePath);
            if (deleteResult?.success) {
                university.imagePath = null;
            } else {
                console.error(`Failed to delete university image: ${deleteResult?.message}`);
            }
        }

        university.deactivatedAt = new Date();
        const deactivatedUniversity = await university.save();
        const populatedUniversity = await University.findById(deactivatedUniversity._id).populate('country');

        return sendResponse(res, true, populatedUniversity);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

export default router;
