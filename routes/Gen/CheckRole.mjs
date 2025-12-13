import { Router } from 'express';
import User from '../../models/Users/_UsersMain.mjs'
import StaffProfile from '../../models/Users/StaffProfile.mjs'

import { optionalAttachUser } from '../../middlewares/Auth.mjs';

const router = Router();

router.get('/', optionalAttachUser, async (req, res) => {
    try {
        let code = 'NO_TOKEN';
        let data = null;
        let userRole = null;

        if (req.user) {
            data = req.user;
            userRole = req.user.role;

            if (req.user.role === 'STUDENT') {
                code = 'STUDENT';
            } else if (req.user.role === 'STAFF') {
                code = 'NON_APPROVED_STAFF';
                const staffProfile = await StaffProfile.findOne({ userId: req.user._id });
                if (staffProfile && staffProfile.verificationStatus === 'VERIFIED') {
                    code = staffProfile.staffRole || 'NON_APPROVED_STAFF';
                }
            }
        }

        return res.status(200).json({ success: true, data, type: userRole, code });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

export default router;