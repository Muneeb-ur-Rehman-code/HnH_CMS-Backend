import jwt from 'jsonwebtoken';
import User from '../models/Users/_UsersMain.mjs';
import { E, x } from "../config/constants.mjs"

export const attachTokenPayload = (req, res, next) => {
    const headerValue = req.header('authorization');

    if (headerValue && headerValue.startsWith('Bearer ')) {
        token = headerValue.split(' ')[1];
    } else {
        token = null;
    }

    if (token) {
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            req.userPayload = payload;
        } catch (error) {
            console.error(E + 'JWT verification failed:', error.message);
        }
    }
    next();

};

export const attachUserInfoOptional = async (req, res, next) => {
    attachTokenPayload(req, res, async () => {
        if (req.userPayload && req.userPayload.userId) {
            try {
                const user = await User.findById(req.userPayload.userId)
                    .select('email firstName lastName phone role')
                    .lean();

                if (user) {
                    req.user = user;
                } else {
                    console.warn(E + 'Token userId found but user not in DB.');
                }
            } catch (error) {
                console.error(X + 'Database lookup failed for userId:', req.userPayload.userId, error.message);
            }
        }
        next();
    });
};

export const requireSignInPayload = (req, res, next) => {
    attachTokenPayload(req, res, () => {
        if (!req.userPayload) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. Please sign in.'
            });
        }
        next();
    });
};

export const requireSignInInfo = (req, res, next) => {
    attachUserInfoOptional(req, res, () => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. Please sign in with a valid user account.'
            });
        }
        next();
    });
};

const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        requireSignInPayload(req, res, () => {
            const userRole = req.userPayload.role;

            if (userRole && allowedRoles.includes(userRole)) {
                next();
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden. Insufficient permissions for this resource.'
                });
            }
        });
    };
};

export const isManager = checkRole(['Admin', 'Manager']);
export const isStudent = checkRole(['Admin', 'Student']);
export const isBackend = checkRole(['Admin', 'BackendOfficer']);
export const isConsultant = checkRole(['Admin', 'Consultant']);
export const isAccountant = checkRole(['Admin', 'Accountant']);
export const isReception = checkRole(['Admin', 'Receptionist']);


export const authorizeRoles = (...roles) => checkRole(roles);