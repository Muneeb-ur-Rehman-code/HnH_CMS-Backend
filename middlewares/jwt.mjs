// middlewares/jwt.mjs
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

/**
 * Generate JWT token for a user
 * @param {Object} payload - Data to encode in token
 * @returns {string} - Bearer token
 */
export const generateToken = (payload, options = {}) => {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const expiresIn = options.expiresIn || JWT_EXPIRY;

    const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn
    });

    return `Bearer ${token}`;
};

/**
 * Verify and decode JWT token
 * @param {string} token - JWT token (with or without Bearer prefix)
 * @returns {Object} - Decoded payload
 */
export const verifyToken = (token) => {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in environment variables');
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

    try {
        return jwt.verify(cleanToken, JWT_SECRET);
    } catch (error) {
        console.error('JWT Verification Error:', {
            name: error.name,
            message: error.message,
            tokenLength: cleanToken.length,
            secretLength: JWT_SECRET.length
        });

        if (error.name === 'TokenExpiredError') {
            throw new Error('Token has expired');
        }
        if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid token');
        }
        throw error;
    }
};

/**
 * Decode token without verification (useful for debugging)
 * @param {string} token - JWT token
 * @returns {Object} - Decoded payload
 */
export const decodeToken = (token) => {
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    return jwt.decode(cleanToken);
};