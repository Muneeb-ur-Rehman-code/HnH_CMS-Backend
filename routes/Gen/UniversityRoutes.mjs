import { Router } from 'express';
import Country from '../../models/Country/CountryModel.mjs';
import University from '../../models/University/UniModel.mjs'; // Assuming the model is here
import { requireFullAuth, requireManager } from '../../middlewares/Auth.mjs';
import uploadMiddleware from '../../middlewares/upload.mjs'; // Assuming path to upload.mjs
import mongoose from 'mongoose';

const { uploadSingle, deleteFile } = uploadMiddleware;

const router = Router();

const sendResponse = (res, success, data, error) => {
    if (success) {
        if (Array.isArray(data)) {
            return res.status(200).json({ success: true, count: data.length, data });
        } else if (data && data.message) {
            return res.status(200).json({ success: true, message: data.message, data: data.data });
        } else {
            return res.status(200).json({ success: true, data });
        }
    } else {
        if (error.uploadedFile && deleteFile) {
            deleteFile(error.uploadedFile.path);
        }

        return res.status(error.status || 500).json({
            success: false,
            message: error.message,
            code: error.code || 'SERVER_ERROR'
        });
    }
};

const managerAuth = [requireFullAuth, requireManager];



router.get('/', async (req, res) => {
    try {
        const universities = await University.getAllActiveUniversities();
        return sendResponse(res, true, universities);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});


router.get('/country/:countryId', async (req, res) => {
    const { countryId } = req.params;
    try {
        const universities = await University.getActiveUniversitiesByCountry(countryId);
        return sendResponse(res, true, universities);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});


router.get('/search', async (req, res) => {
    const { search } = req.query;
    try {
        const universities = await University.searchActiveUniversities(search);
        return sendResponse(res, true, universities);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});


router.get('/deactivated', managerAuth, async (req, res) => {
    const { countryId } = req.query;
    try {
        const universities = await University.getDeactivatedUniversities(countryId);
        return sendResponse(res, true, universities);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});


router.post('/create', managerAuth, uploadSingle('image'), async (req, res) => {
    try {
        let universityData = req.body;

        if (req.fileInfo) {
            universityData.imagePath = req.fileInfo.path;
        }

        const university = await University.createUniversity(universityData);
        return res.status(201).json({ success: true, data: university });
    } catch (error) {
        error.uploadedFile = req.fileInfo;
        return sendResponse(res, false, null, error);
    }
});


router.put('/update/:id', managerAuth, uploadSingle('image'), async (req, res) => {
    const { id } = req.params;
    try {
        let updateData = req.body;
        const university = await University.findOne({ _id: id }, 'imagePath', { includeDeactivated: true });

        if (!university) {
            if (req.fileInfo) deleteFile(req.fileInfo.path);
            const error = new Error('University not found.');
            error.status = 404; error.success = false; error.code = 'NOT_FOUND';
            throw error;
        }

        const oldImagePath = university.imagePath;

        if (req.fileInfo) {
            updateData.imagePath = req.fileInfo.path;
        } else if (updateData.imagePath === 'null') {
            updateData.imagePath = null;
        } else {
            delete updateData.imagePath;
        }

        const updatedUniversity = await University.updateUniversity(id, updateData, oldImagePath, deleteFile);
        return sendResponse(res, true, updatedUniversity);
    } catch (error) {
        error.uploadedFile = req.fileInfo;
        return sendResponse(res, false, null, error);
    }
});


router.put('/activate/:id', managerAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const university = await University.activateUniversity(id);
        return sendResponse(res, true, university);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});


router.delete('/deactivate/:id', managerAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const university = await University.deactivateUniversity(id, deleteFile);
        return sendResponse(res, true, { message: 'University deactivated successfully', data: university }, null);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

export default router;