// models/StaffProfile.mjs
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ============================================
// ENUMS
// ============================================
export const STAFF_ROLE = Object.freeze({
    MANAGER: 'MANAGER',
    RECEPTIONIST: 'RECEPTIONIST',
    ACCOUNTANT: 'ACCOUNTANT',
    AGENT: 'AGENT',
    CONSULTANT: 'CONSULTANT',
    ADMIN: 'ADMIN'
});

export const STAFF_VERIFICATION_STATUS = Object.freeze({
    PENDING: 'PENDING',
    VERIFIED: 'VERIFIED',
    REJECTED: 'REJECTED'
});

// ============================================
// SCHEMA DEFINITION
// ============================================
const staffProfileSchema = new Schema(
    {
        // ---- Link to User ----
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            unique: true,
            index: true
        },

        // ---- Staff Role ----
        staffRole: {
            type: String,
            enum: {
                values: Object.values(STAFF_ROLE),
                message: 'Invalid staff role: {VALUE}'
            },
            required: [true, 'Staff role is required'],
            index: true
        },

        // ---- Verification ----
        verificationStatus: {
            type: String,
            enum: {
                values: Object.values(STAFF_VERIFICATION_STATUS),
                message: 'Invalid verification status: {VALUE}'
            },
            default: STAFF_VERIFICATION_STATUS.PENDING,
            index: true
        },

        verifiedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        verifiedAt: {
            type: Date,
            default: null
        },

        rejectionReason: {
            type: String,
            trim: true,
            maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
            default: null
        },

        // ---- Additional Info ----
        notes: {
            type: String,
            trim: true,
            maxlength: [1000, 'Notes cannot exceed 1000 characters'],
            default: null
        },

        // ---- Soft Delete ----
        deletedAt: {
            type: Date,
            default: null,
            index: true
        }
    },
    {
        timestamps: true
    }
);

// ============================================
// INDEXES
// ============================================
staffProfileSchema.index({ staffRole: 1, verificationStatus: 1 });

// ============================================
// QUERY MIDDLEWARE - Exclude soft deleted
// ============================================
staffProfileSchema.pre(/^find/, function () {
    if (this.getOptions().includeSoftDeleted !== true) {
        this.where({ deletedAt: null });
    }
    // next();
});

// ============================================
// VIRTUALS
// ============================================
staffProfileSchema.virtual('isVerified').get(function () {
    return this.verificationStatus === STAFF_VERIFICATION_STATUS.VERIFIED;
});

staffProfileSchema.virtual('isPending').get(function () {
    return this.verificationStatus === STAFF_VERIFICATION_STATUS.PENDING;
});

staffProfileSchema.virtual('isRejected').get(function () {
    return this.verificationStatus === STAFF_VERIFICATION_STATUS.REJECTED;
});

staffProfileSchema.virtual('isDeleted').get(function () {
    return this.deletedAt !== null;
});

staffProfileSchema.virtual('user', {
    ref: 'User',
    localField: 'userId',
    foreignField: '_id',
    justOne: true
});

staffProfileSchema.virtual('assignedCountries', {
    ref: 'ConsultantCountry',
    localField: '_id',
    foreignField: 'staffProfileId'
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Verify staff member
 * @param {ObjectId} verifierId - ID of user performing verification
 * @returns {Promise<StaffProfile>}
 */
staffProfileSchema.methods.verify = function (verifierId) {
    if (this.verificationStatus === STAFF_VERIFICATION_STATUS.VERIFIED) {
        throw new Error('Staff member is already verified');
    }

    this.verificationStatus = STAFF_VERIFICATION_STATUS.VERIFIED;
    this.verifiedBy = verifierId;
    this.verifiedAt = new Date();
    this.rejectionReason = null;

    return this.save();
};

/**
 * Reject staff verification
 * @param {ObjectId} verifierId - ID of user performing rejection
 * @param {string} reason - Rejection reason
 * @returns {Promise<StaffProfile>}
 */
staffProfileSchema.methods.reject = function (verifierId, reason) {
    if (!reason) {
        throw new Error('Rejection reason is required');
    }

    this.verificationStatus = STAFF_VERIFICATION_STATUS.REJECTED;
    this.verifiedBy = verifierId;
    this.verifiedAt = new Date();
    this.rejectionReason = reason;

    return this.save();
};

/**
 * Reset to pending status
 * @returns {Promise<StaffProfile>}
 */
staffProfileSchema.methods.resetToPending = function () {
    this.verificationStatus = STAFF_VERIFICATION_STATUS.PENDING;
    this.verifiedBy = null;
    this.verifiedAt = null;
    this.rejectionReason = null;

    return this.save();
};

/**
 * Change staff role
 * @param {string} newRole - New staff role
 * @returns {Promise<StaffProfile>}
 */
staffProfileSchema.methods.changeRole = function (newRole) {
    if (!Object.values(STAFF_ROLE).includes(newRole)) {
        throw new Error('Invalid staff role');
    }

    this.staffRole = newRole;
    return this.save();
};

/**
 * Soft delete profile
 * @returns {Promise<StaffProfile>}
 */
staffProfileSchema.methods.softDelete = function () {
    this.deletedAt = new Date();
    return this.save();
};

/**
 * Restore soft deleted profile
 * @returns {Promise<StaffProfile>}
 */
staffProfileSchema.methods.restore = function () {
    this.deletedAt = null;
    return this.save();
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Find staff by user ID
 * @param {ObjectId} userId
 * @returns {Promise<StaffProfile>}
 */
staffProfileSchema.statics.findByUserId = function (userId) {
    return this.findOne({ userId }).populate('user');
};

/**
 * Find verified staff by role
 * @param {string} role
 * @returns {Promise<StaffProfile[]>}
 */
staffProfileSchema.statics.findVerifiedByRole = function (role) {
    return this.find({
        staffRole: role,
        verificationStatus: STAFF_VERIFICATION_STATUS.VERIFIED
    }).populate('user');
};

/**
 * Find pending verifications
 * @returns {Promise<StaffProfile[]>}
 */
staffProfileSchema.statics.findPendingVerifications = function () {
    return this.find({
        verificationStatus: STAFF_VERIFICATION_STATUS.PENDING
    }).populate('user');
};

/**
 * Get all consultants
 * @param {boolean} verifiedOnly - Only return verified consultants
 * @returns {Promise<StaffProfile[]>}
 */
staffProfileSchema.statics.findConsultants = function (verifiedOnly = true) {
    const query = { staffRole: STAFF_ROLE.CONSULTANT };
    if (verifiedOnly) {
        query.verificationStatus = STAFF_VERIFICATION_STATUS.VERIFIED;
    }
    return this.find(query).populate('user').populate('assignedCountries');
};

/**
 * Get all accountants
 * @param {boolean} verifiedOnly - Only return verified accountants
 * @returns {Promise<StaffProfile[]>}
 */
staffProfileSchema.statics.findAccountants = function (verifiedOnly = true) {
    const query = { staffRole: STAFF_ROLE.ACCOUNTANT };
    if (verifiedOnly) {
        query.verificationStatus = STAFF_VERIFICATION_STATUS.VERIFIED;
    }
    return this.find(query).populate('user');
};

// ============================================
// JSON TRANSFORM
// ============================================
staffProfileSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

staffProfileSchema.set('toObject', { virtuals: true });

// ============================================
// EXPORT
// ============================================
const StaffProfile = model('StaffProfile', staffProfileSchema);
export default StaffProfile;