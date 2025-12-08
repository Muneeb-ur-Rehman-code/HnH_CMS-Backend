// middlewares/auth.mjs
import { verifyToken } from './jwt.mjs';
import User from '../models/Users/_UsersMain.mjs';
import StaffProfile from '../models/Users/StaffProfile.mjs';
import { USER_ROLE, USER_STATUS } from '../models/Users/_UsersMain.mjs';
import { STAFF_VERIFICATION_STATUS } from '../models/Users/StaffProfile.mjs';

// ============================================
// AUTHENTICATION MIDDLEWARES
// ============================================

/**
 * Attach user to request (REQUIRED - throws error if not authenticated)
 */
export const attachUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'No authorization token provided'
            });
        }

        // Verify token
        const decoded = verifyToken(authHeader);

        // Find user
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user is deleted
        if (user.isDeleted) {
            return res.status(403).json({
                success: false,
                message: 'Account has been deleted. Please contact administrator.'
            });
        }

        // Check if user is suspended
        if (user.status === USER_STATUS.SUSPENDED) {
            return res.status(403).json({
                success: false,
                message: 'Account is suspended. Please contact administrator.'
            });
        }

        // Check if user is inactive
        if (user.status === USER_STATUS.INACTIVE) {
            return res.status(403).json({
                success: false,
                message: 'Account is inactive. Please contact administrator.'
            });
        }

        // Attach user to request
        req.user = user;
        req.userId = user._id;

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: error.message || 'Authentication failed'
        });
    }
};

/**
 * Optionally attach user if token is present (doesn't throw error)
 */
export const optionalAttachUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return next();
        }

        const decoded = verifyToken(authHeader);
        const user = await User.findById(decoded.userId);

        if (user && !user.isDeleted && user.status === USER_STATUS.ACTIVE) {
            req.user = user;
            req.userId = user._id;
        }

        next();
    } catch (error) {
        // Silently fail for optional auth
        next();
    }
};

/**
 * Ensure user is authenticated (use after attachUser or optionalAttachUser)
 */
export const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }
    next();
};

// ============================================
// ROLE-BASED AUTHORIZATION
// ============================================

/**
 * Require specific role(s)
 * @param {...string} roles - Allowed roles
 */
export const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${roles.join(' or ')}`
            });
        }

        next();
    };
};

/**
 * Require student role
 */
export const requireStudent = requireRole(USER_ROLE.STUDENT);

/**
 * Require staff role (any staff)
 */
export const requireStaff = requireRole(
    USER_ROLE.STAFF,
    USER_ROLE.MANAGER,
    USER_ROLE.ADMIN
);

/**
 * Require manager role
 */
export const requireManager = requireRole(USER_ROLE.MANAGER, USER_ROLE.ADMIN);

/**
 * Require admin role
 */
export const requireAdmin = requireRole(USER_ROLE.ADMIN);

// ============================================
// VERIFICATION CHECKS
// ============================================

/**
 * Require email to be verified
 */
export const requireEmailVerified = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    try {
        const verified = await req.user.isEmailVerifiedAsync();
        if (!verified) {
            return res.status(403).json({
                success: false,
                message: 'Email verification required',
                code: 'EMAIL_NOT_VERIFIED'
            });
        }
        next();
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error checking email verification', error: err.message });
    }
};

/**
 * Require phone to be verified
 */
export const requirePhoneVerified = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    try {
        const phoneNumberPresent = !!(req.user.phoneNumber || req.user.phone?.number);
        if (!phoneNumberPresent) {
            return res.status(403).json({
                success: false,
                message: 'Phone number required',
                code: 'PHONE_NOT_SET'
            });
        }

        const verified = await req.user.isPhoneVerifiedAsync();
        if (!verified) {
            return res.status(403).json({
                success: false,
                message: 'Phone verification required',
                code: 'PHONE_NOT_VERIFIED'
            });
        }

        next();
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error checking phone verification', error: err.message });
    }
};

/**
 * Require password to be set
 */
export const requirePasswordSet = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    try {
        const hasPassword = await req.user.hasPasswordAsync();
        if (!hasPassword) {
            return res.status(403).json({
                success: false,
                message: 'Password not set. Please complete signup.',
                code: 'PASSWORD_NOT_SET'
            });
        }
        next();
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error checking password', error: err.message });
    }
};

/**
 * Require basic profile info (firstName, lastName, etc.)
 */
export const requireBasicInfo = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (!req.user.firstName || !req.user.lastName) {
        return res.status(403).json({
            success: false,
            message: 'Basic profile information required',
            code: 'BASIC_INFO_NOT_SET'
        });
    }

    next();
};

/**
 * Require full onboarding completion
 */
export const requireOnboardingComplete = [
    requireEmailVerified,
    requirePasswordSet,
    requirePhoneVerified,
    requireBasicInfo
];

/**
 * Require staff verification (for staff members)
 */
export const requireStaffVerified = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (req.user.role === USER_ROLE.STUDENT) {
        return next(); // Students don't need staff verification
    }

    try {
        const staffProfile = await StaffProfile.findOne({ userId: req.user._id });

        if (!staffProfile) {
            return res.status(403).json({
                success: false,
                message: 'Staff profile not found',
                code: 'STAFF_PROFILE_NOT_FOUND'
            });
        }

        if (staffProfile.verificationStatus !== STAFF_VERIFICATION_STATUS.VERIFIED) {
            return res.status(403).json({
                success: false,
                message: 'Staff account pending verification',
                code: 'STAFF_NOT_VERIFIED'
            });
        }

        // Attach staff profile to request
        req.staffProfile = staffProfile;

        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error checking staff verification',
            error: error.message
        });
    }
};

// ============================================
// ACCOUNT STATUS CHECKS
// ============================================

/**
 * Check if account is active
 */
export const requireActiveAccount = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (req.user.status !== USER_STATUS.ACTIVE) {
        return res.status(403).json({
            success: false,
            message: `Account is ${req.user.status.toLowerCase()}`,
            code: 'ACCOUNT_NOT_ACTIVE'
        });
    }

    next();
};

/**
 * Ensure user is not deleted
 */
export const requireNotDeleted = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (req.user.isDeleted) {
        return res.status(403).json({
            success: false,
            message: 'Account has been deleted',
            code: 'ACCOUNT_DELETED'
        });
    }

    next();
};

// ============================================
// COMBINED MIDDLEWARES
// ============================================

/**
 * Full authentication + verification check
 */
export const requireFullAuth = [
    attachUser,
    requireActiveAccount,
    requireNotDeleted,
    requireEmailVerified,
    requirePasswordSet
];

/**
 * Staff authentication with verification
 */
export const requireVerifiedStaff = [
    attachUser,
    requireStaff,
    requireStaffVerified
];

// ============================================
// EXPORT ALL
// ============================================
export default {
    attachUser,
    optionalAttachUser,
    requireAuth,
    requireRole,
    requireStudent,
    requireStaff,
    requireManager,
    requireAdmin,
    requireEmailVerified,
    requirePhoneVerified,
    requirePasswordSet,
    requireBasicInfo,
    requireOnboardingComplete,
    requireStaffVerified,
    requireActiveAccount,
    requireNotDeleted,
    requireFullAuth,
    requireVerifiedStaff
};