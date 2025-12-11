// middlewares/auth.mjs
import { verifyToken } from './jwt.mjs';
import User from '../models/Users/_UsersMain.mjs';
import StaffProfile from '../models/Users/StaffProfile.mjs';
import { USER_ROLE, USER_STATUS } from '../models/Users/_UsersMain.mjs';
import { STAFF_VERIFICATION_STATUS, STAFF_ROLE } from '../models/Users/StaffProfile.mjs';







async function attachUserCore(req) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        const err = new Error('No authorization token provided');
        err.status = 401;
        err.success = false;
        throw err;
    }

    let decoded;
    try {
        decoded = verifyToken(authHeader);
    } catch (e) {
        const err = new Error('Invalid or expired token');
        err.status = 401;
        err.success = false;
        throw err;
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
        const err = new Error('User not found');
        err.status = 401;
        err.success = false;
        throw err;
    }

    if (user.status === USER_STATUS.SUSPENDED) {
        const err = new Error('Account is suspended. Please contact administrator.');
        err.status = 403;
        err.success = false;
        throw err;
    }

    req.user = user;
    req.userId = user._id;
    return user;
}

export const attachUser = async (req, res, next) => {
    try {
        await attachUserCore(req);
        return next();
    } catch (error) {
        return res.status(error.status || 401).json({ success: false, message: error.message });
    }
};

export const optionalAttachUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return next();

        await attachUserCore(req);
        return next();
    } catch (error) {
        return next();
    }
};

export const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }
    next();
};







export const requireRole = (...roles) => {
    return async (req, res, next) => {
        try {
            if (!req.user) await attachUserCore(req);
        } catch (err) {
            return res.status(err.status || 401).json({ success: false, message: err.message });
        }

        if (req.user.status !== USER_STATUS.ACTIVE) return res.status(403).json({ success: false, message: `Account is ${req.user.status.toLowerCase()}`, code: 'ACCOUNT_NOT_ACTIVE' });

        const allowedRoles = roles.filter(Boolean);

        if (allowedRoles.includes(req.user.role)) return next();

        if (req.user.role === USER_ROLE.STAFF) {
            try {
                const staffRoleValues = Object.values(STAFF_ROLE);
                const requestedStaffRoles = allowedRoles.filter(r => staffRoleValues.includes(r));

                if (requestedStaffRoles.length === 0) {
                    return res.status(403).json({ success: false, message: `Access denied. Required role: ${allowedRoles.join(' or ')}` });
                }

                const staffProfile = req.staffProfile || await StaffProfile.findOne({ userId: req.user._id });
                if (!staffProfile) {
                    return res.status(403).json({ success: false, message: 'Staff profile not found', code: 'STAFF_PROFILE_NOT_FOUND' });
                }

                if (staffProfile.verificationStatus !== STAFF_VERIFICATION_STATUS.VERIFIED) {
                    return res.status(403).json({ success: false, message: 'Staff account not verified', code: 'STAFF_NOT_VERIFIED' });
                }

                if (requestedStaffRoles.includes(staffProfile.staffRole)) {
                    if (!req.staffProfile) req.staffProfile = staffProfile;
                    return next();
                }

                return res.status(403).json({ success: false, message: `Access denied. Required role: ${allowedRoles.join(' or ')}` });
            } catch (err) {
                return res.status(500).json({ success: false, message: 'Error checking staff role', error: err.message });
            }
        }

        return res.status(403).json({ success: false, message: `Access denied. Required role: ${allowedRoles.join(' or ')}` });
    };
};

export const requireStaffVerified = async (req, res, next) => {
    try {
        if (!req.user) await attachUserCore(req);
    } catch (err) {
        return res.status(err.status || 401).json({ success: false, message: err.message });
    }

    if (req.user.role === USER_ROLE.STUDENT) return next();

    try {
        const staffProfile = req.staffProfile || await StaffProfile.findOne({ userId: req.user._id });
        if (!staffProfile) return res.status(403).json({ success: false, message: 'Staff profile not found', code: 'STAFF_PROFILE_NOT_FOUND' });
        if (staffProfile.verificationStatus !== STAFF_VERIFICATION_STATUS.VERIFIED) return res.status(403).json({ success: false, message: 'Staff account not verified', code: 'STAFF_NOT_VERIFIED' });

        req.staffProfile = staffProfile;
        return next();
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error checking staff verification', error: error.message });
    }
};

export const requireActiveAccount = async (req, res, next) => {
    try {
        if (!req.user) await attachUserCore(req);
    } catch (err) {
        return res.status(err.status || 401).json({ success: false, message: err.message });
    }

    if (req.user.status !== USER_STATUS.ACTIVE) return res.status(403).json({ success: false, message: `Account is ${req.user.status.toLowerCase()}`, code: 'ACCOUNT_NOT_ACTIVE' });
    return next();
};


export const requireStudent = requireRole(USER_ROLE.STUDENT);
export const requireStaff = requireRole(USER_ROLE.STAFF);

export const requireManager = requireRole(STAFF_ROLE.MANAGER, STAFF_ROLE.ADMIN);
export const requireAdmin = requireRole(STAFF_ROLE.ADMIN);
export const requireConsultant = requireRole(STAFF_ROLE.CONSULTANT);
export const requireAccountant = requireRole(STAFF_ROLE.ACCOUNTANT);
export const requireReceptionist = requireRole(STAFF_ROLE.RECEPTIONIST);
export const requireAgent = requireRole(STAFF_ROLE.AGENT);






export const requireEmailVerified = async (req, res, next) => {
    try {
        if (!req.user) await attachUserCore(req);
    } catch (err) {
        return res.status(err.status || 401).json({ success: false, message: err.message });
    }

    if (req.user.status !== USER_STATUS.ACTIVE) return res.status(403).json({ success: false, message: `Account is ${req.user.status.toLowerCase()}`, code: 'ACCOUNT_NOT_ACTIVE' });

    try {
        const verified = await req.user.isEmailVerifiedAsync();
        if (!verified) return res.status(403).json({ success: false, message: 'Email verification required', code: 'EMAIL_NOT_VERIFIED' });
        return next();
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error checking email verification', error: err.message });
    }
};

export const requirePhoneVerified = async (req, res, next) => {
    try {
        if (!req.user) await attachUserCore(req);
    } catch (err) {
        return res.status(err.status || 401).json({ success: false, message: err.message });
    }

    try {
        const hasPassword = await req.user.hasPasswordAsync();
        if (!hasPassword) return res.status(403).json({ success: false, message: 'Password not set. Please complete signup first.', code: 'PASSWORD_NOT_SET' });

        const phoneNumberPresent = !!(req.user.phoneNumber || req.user.phone?.number);
        if (!phoneNumberPresent) return res.status(403).json({ success: false, message: 'Phone number required', code: 'PHONE_NOT_SET' });

        const verified = await req.user.isPhoneVerifiedAsync();
        if (!verified) return res.status(403).json({ success: false, message: 'Phone verification required', code: 'PHONE_NOT_VERIFIED' });

        return next();
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error checking phone verification', error: err.message });
    }
};

export const requirePasswordSet = async (req, res, next) => {
    try {
        if (!req.user) await attachUserCore(req);
    } catch (err) {
        return res.status(err.status || 401).json({ success: false, message: err.message });
    }

    try {
        const emailVerified = await req.user.isEmailVerifiedAsync();
        if (!emailVerified) return res.status(403).json({ success: false, message: 'Email verification required first', code: 'EMAIL_NOT_VERIFIED' });

        const hasPassword = await req.user.hasPasswordAsync();
        if (!hasPassword) return res.status(403).json({ success: false, message: 'Password not set. Please complete signup.', code: 'PASSWORD_NOT_SET' });
        return next();
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error checking password', error: err.message });
    }
};

export const requireBasicInfo = async (req, res, next) => {
    try {
        if (!req.user) await attachUserCore(req);
    } catch (err) {
        return res.status(err.status || 401).json({ success: false, message: err.message });
    }

    try {
        const hasPassword = await req.user.hasPasswordAsync();
        if (!hasPassword) return res.status(403).json({ success: false, message: 'Password not set. Please complete signup first.', code: 'PASSWORD_NOT_SET' });

        if (!req.user.firstName || !req.user.lastName) return res.status(403).json({ success: false, message: 'Basic profile information required', code: 'BASIC_INFO_NOT_SET' });
        return next();
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error checking basic info', error: err.message });
    }
};

export const requireOnboardingComplete = [
    requireEmailVerified,
    requirePasswordSet,
    // requirePhoneVerified,
    requireBasicInfo
];






export const requireFullAuth = [
    attachUser,
    requireActiveAccount,
    requireNotDeleted,
    requireEmailVerified,
    requirePasswordSet
];

export const requireVerifiedStaff = [
    attachUser,
    requireStaff,
    requireStaffVerified
];


export default {
    attachUser,
    optionalAttachUser,
    requireAuth,
    requireRole,
    requireStudent,
    requireStaff,
    requireManager,
    requireAdmin,
    requireConsultant,
    requireAccountant,
    requireReceptionist,
    requireAgent,
    requireEmailVerified,
    requirePhoneVerified,
    requirePasswordSet,
    requireBasicInfo,
    requireOnboardingComplete,
    requireStaffVerified,
    requireActiveAccount,
    requireFullAuth,
    requireVerifiedStaff
};