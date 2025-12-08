// middlewares/auth.mjs
import { verifyToken } from './jwt.mjs';
import User from '../models/Users/_UsersMain.mjs';
import StaffProfile from '../models/Users/StaffProfile.mjs';
import { USER_ROLE, USER_STATUS } from '../models/Users/_UsersMain.mjs';
import { STAFF_VERIFICATION_STATUS, STAFF_ROLE } from '../models/Users/StaffProfile.mjs';

// ============================================
// AUTHENTICATION MIDDLEWARES
// ============================================

// Attach user to request (REQUIRED - throws error if not authenticated)
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

// Optionally attach user if token is present (doesn't throw error)
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

//Ensure user is authenticated (use after attachUser or optionalAttachUser)
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
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Normalize and filter roles (remove falsy values)
        const allowedRoles = roles.filter(Boolean);

        // If the user's top-level role matches any allowed role, grant access
        if (allowedRoles.includes(req.user.role)) {
            return next();
        }

        // If the user is a staff member, allow checks against staff-specific roles
        if (req.user.role === USER_ROLE.STAFF) {
            try {
                // Determine if any of the allowed roles are staff-level roles
                const staffRoleValues = Object.values(STAFF_ROLE);
                const requestedStaffRoles = allowedRoles.filter(r => staffRoleValues.includes(r));

                // If no staff-level role was requested, deny access
                if (requestedStaffRoles.length === 0) {
                    return res.status(403).json({
                        success: false,
                        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
                    });
                }

                // Use attached staffProfile if present, otherwise fetch it
                const staffProfile = req.staffProfile || await StaffProfile.findOne({ userId: req.user._id });

                if (!staffProfile) {
                    return res.status(403).json({
                        success: false,
                        message: 'Staff profile not found',
                        code: 'STAFF_PROFILE_NOT_FOUND'
                    });
                }

                // If the staff's role matches any of the requested staff roles, allow
                if (requestedStaffRoles.includes(staffProfile.staffRole)) {
                    // attach profile if not already
                    if (!req.staffProfile) req.staffProfile = staffProfile;
                    return next();
                }

                return res.status(403).json({
                    success: false,
                    message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
                });
            } catch (err) {
                return res.status(500).json({ success: false, message: 'Error checking staff role', error: err.message });
            }
        }

        // Default deny
        return res.status(403).json({
            success: false,
            message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
        });
    };
};


export const requireStudent = requireRole(USER_ROLE.STUDENT);


export const requireStaff = requireRole(
    USER_ROLE.STAFF,
    STAFF_ROLE.MANAGER,
    STAFF_ROLE.ADMIN
);

export const requireManager = requireRole(STAFF_ROLE.MANAGER, STAFF_ROLE.ADMIN);

export const requireAdmin = requireRole(STAFF_ROLE.ADMIN);

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

export const requireOnboardingComplete = [
    requireEmailVerified,
    requirePasswordSet,
    // requirePhoneVerified,
    requireBasicInfo
];

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