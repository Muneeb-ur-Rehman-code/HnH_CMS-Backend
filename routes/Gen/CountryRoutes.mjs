import { Router } from 'express';
import Country from '../../models/Country/CountryModel.mjs';
import { requireFullAuth, requireManager } from '../../middlewares/Auth.mjs';

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
        const countries = await Country.getAllActiveCountries();
        return sendResponse(res, true, countries);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

router.get('/search', async (req, res) => {
    const { search } = req.query;
    try {
        const countries = await Country.searchActiveCountries(search);
        return sendResponse(res, true, countries);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

router.get('/deactivated', managerAuth, async (req, res) => {
    try {
        const countries = await Country.getDeactivatedCountries();
        return sendResponse(res, true, countries);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

router.post('/create', managerAuth, async (req, res) => {
    try {
        const country = await Country.createCountry(req.body);
        return res.status(201).json({ success: true, data: country });
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

router.put('/update/:id', managerAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const country = await Country.updateCountry(id, req.body);
        return sendResponse(res, true, country);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

router.put('/activate/:id', managerAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const country = await Country.activateCountry(id);
        return sendResponse(res, true, country);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

router.delete('/deactivate/:id', managerAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const country = await Country.deactivateCountry(id);
        return sendResponse(res, true, { message: 'Country deactivated successfully', data: country }, null);
    } catch (error) {
        return sendResponse(res, false, null, error);
    }
});

export default router;