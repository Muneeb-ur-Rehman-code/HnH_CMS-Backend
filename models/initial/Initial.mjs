// models/Initial.mjs
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ============================================
// ENUMS
// ============================================
export const INITIAL_SOURCE = Object.freeze({
    MARKETING: 'MARKETING',
    WALK_IN: 'WALK_IN',
    ONLINE: 'ONLINE'
});

export const INITIAL_STATUS = Object.freeze({
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    DONE: 'DONE'
});

// ============================================
// SCHEMA DEFINITION
// ============================================
const initialSchema = new Schema(
    {
        // ---- Core Fields ----
        email: {
            type: String,
            required: [true, 'Email is required'],
            lowercase: true,
            trim: true,
            validate: {
                validator: function (value) {
                    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
                },
                message: 'Please provide a valid email address'
            },
            index: true
        },

        firstName: {
            type: String,
            required: [true, 'First name is required'],
            trim: true,
            minlength: [2, 'First name must be at least 2 characters'],
            maxlength: [50, 'First name cannot exceed 50 characters'],
            validate: {
                validator: function (value) {
                    return /^[a-zA-Z\s'-]+$/.test(value);
                },
                message: 'First name can only contain letters, spaces, hyphens, and apostrophes'
            }
        },

        lastName: {
            type: String,
            required: [true, 'Last name is required'],
            trim: true,
            minlength: [2, 'Last name must be at least 2 characters'],
            maxlength: [50, 'Last name cannot exceed 50 characters'],
            validate: {
                validator: function (value) {
                    return /^[a-zA-Z\s'-]+$/.test(value);
                },
                message: 'Last name can only contain letters, spaces, hyphens, and apostrophes'
            }
        },

        phoneNumber: {
            type: String,
            trim: true,
            default: null,
            validate: {
                validator: function (value) {
                    if (!value) return true;
                    return /^[1-9]\d{9,14}$/.test(value);
                },
                message: 'Phone number must be in format: country code + number (e.g., 923001234567)'
            }
        },

        // ---- Preferences ----
        preferredCountry: {
            type: String,
            trim: true,
            maxlength: [100, 'Preferred country cannot exceed 100 characters'],
            default: null
        },

        preferredUniversity: {
            type: String,
            trim: true,
            maxlength: [200, 'Preferred university cannot exceed 200 characters'],
            default: null
        },

        // ---- Additional Notes (from marketing) ----
        notes: {
            type: String,
            trim: true,
            maxlength: [500, 'Notes cannot exceed 500 characters'],
            default: null
        },

        // ---- Source & Status ----
        source: {
            type: String,
            enum: {
                values: Object.values(INITIAL_SOURCE),
                message: 'Invalid source: {VALUE}'
            },
            required: [true, 'Source is required'],
            index: true
        },

        status: {
            type: String,
            enum: {
                values: Object.values(INITIAL_STATUS),
                message: 'Invalid status: {VALUE}'
            },
            default: INITIAL_STATUS.PENDING,
            index: true
        },

        // ---- Link to User (if registered) ----
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true
        },

        // ---- Approval/Rejection Info ----
        reviewedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        reviewedAt: {
            type: Date,
            default: null
        },

        rejectionReason: {
            type: String,
            trim: true,
            maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
            default: null
        },

        // ---- Done Info (when application is created) ----
        markedDoneBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        markedDoneAt: {
            type: Date,
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
initialSchema.index({ email: 1, status: 1 });
initialSchema.index({ source: 1, status: 1 });
initialSchema.index({ preferredCountry: 1, status: 1 });
initialSchema.index({ createdAt: -1 });

// ============================================
// QUERY MIDDLEWARE - Exclude soft deleted
// ============================================
initialSchema.pre(/^find/, function () {
    if (this.getOptions().includeSoftDeleted !== true) {
        this.where({ deletedAt: null });
    }
    // next();
});

// ============================================
// VIRTUALS
// ============================================
initialSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

initialSchema.virtual('isPending').get(function () {
    return this.status === INITIAL_STATUS.PENDING;
});

initialSchema.virtual('isApproved').get(function () {
    return this.status === INITIAL_STATUS.APPROVED;
});

initialSchema.virtual('isRejected').get(function () {
    return this.status === INITIAL_STATUS.REJECTED;
});

initialSchema.virtual('isDone').get(function () {
    return this.status === INITIAL_STATUS.DONE;
});

initialSchema.virtual('isDeleted').get(function () {
    return this.deletedAt !== null;
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Approve the initial record
 * @param {ObjectId} reviewerId - ID of user approving
 * @returns {Promise<Initial>}
 */
initialSchema.methods.approve = function (reviewerId) {
    if (this.status !== INITIAL_STATUS.PENDING) {
        throw new Error(`Cannot approve record with status: ${this.status}`);
    }

    this.status = INITIAL_STATUS.APPROVED;
    this.reviewedBy = reviewerId;
    this.reviewedAt = new Date();
    this.rejectionReason = null;

    return this.save();
};

/**
 * Reject the initial record
 * @param {ObjectId} reviewerId - ID of user rejecting
 * @param {string} reason - Rejection reason
 * @returns {Promise<Initial>}
 */
initialSchema.methods.reject = function (reviewerId, reason) {
    if (this.status !== INITIAL_STATUS.PENDING) {
        throw new Error(`Cannot reject record with status: ${this.status}`);
    }

    if (!reason) {
        throw new Error('Rejection reason is required');
    }

    this.status = INITIAL_STATUS.REJECTED;
    this.reviewedBy = reviewerId;
    this.reviewedAt = new Date();
    this.rejectionReason = reason;

    return this.save();
};

/**
 * Mark as done (when application is created)
 * @param {ObjectId} consultantId - ID of consultant who created application
 * @returns {Promise<Initial>}
 */
initialSchema.methods.markAsDone = function (consultantId) {
    if (this.status !== INITIAL_STATUS.APPROVED) {
        throw new Error('Only approved records can be marked as done');
    }

    this.status = INITIAL_STATUS.DONE;
    this.markedDoneBy = consultantId;
    this.markedDoneAt = new Date();

    return this.save();
};

/**
 * Reset to pending status
 * @returns {Promise<Initial>}
 */
initialSchema.methods.resetToPending = function () {
    this.status = INITIAL_STATUS.PENDING;
    this.reviewedBy = null;
    this.reviewedAt = null;
    this.rejectionReason = null;
    this.markedDoneBy = null;
    this.markedDoneAt = null;

    return this.save();
};

/**
 * Link to user
 * @param {ObjectId} userId
 * @returns {Promise<Initial>}
 */
initialSchema.methods.linkToUser = function (userId) {
    this.userId = userId;
    return this.save();
};

/**
 * Soft delete the record
 * @returns {Promise<Initial>}
 */
initialSchema.methods.softDelete = function () {
    this.deletedAt = new Date();
    return this.save();
};

/**
 * Restore soft deleted record
 * @returns {Promise<Initial>}
 */
initialSchema.methods.restore = function () {
    this.deletedAt = null;
    return this.save();
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Find by email
 * @param {string} email
 * @returns {Promise<Initial>}
 */
initialSchema.statics.findByEmail = function (email) {
    return this.findOne({ email: email.toLowerCase() });
};

/**
 * Find active (non-DONE) record by email
 * @param {string} email
 * @returns {Promise<Initial>}
 */
initialSchema.statics.findActiveByEmail = function (email) {
    return this.findOne({
        email: email.toLowerCase(),
        status: { $ne: INITIAL_STATUS.DONE }
    });
};

/**
 * Find pending records
 * @returns {Promise<Initial[]>}
 */
initialSchema.statics.findPending = function () {
    return this.find({ status: INITIAL_STATUS.PENDING }).sort({ createdAt: -1 });
};

/**
 * Find approved records
 * @param {string} country - Optional country filter
 * @returns {Promise<Initial[]>}
 */
initialSchema.statics.findApproved = function (country = null) {
    const query = { status: INITIAL_STATUS.APPROVED };
    if (country) {
        query.preferredCountry = country;
    }
    return this.find(query).sort({ createdAt: -1 });
};

/**
 * Find approved records for countries
 * @param {Array} countries - Array of country names
 * @returns {Promise<Initial[]>}
 */
initialSchema.statics.findApprovedForCountries = function (countries) {
    return this.find({
        status: INITIAL_STATUS.APPROVED,
        preferredCountry: { $in: countries }
    }).sort({ createdAt: -1 });
};

/**
 * Find by user ID
 * @param {ObjectId} userId
 * @returns {Promise<Initial[]>}
 */
initialSchema.statics.findByUserId = function (userId) {
    return this.find({ userId }).sort({ createdAt: -1 });
};

/**
 * Check if user has active initial record
 * @param {string} email
 * @returns {Promise<boolean>}
 */
initialSchema.statics.hasActiveRecord = async function (email) {
    const count = await this.countDocuments({
        email: email.toLowerCase(),
        status: { $in: [INITIAL_STATUS.PENDING, INITIAL_STATUS.APPROVED] }
    });
    return count > 0;
};

/**
 * Check if DONE record exists (prevents marketing duplicates)
 * @param {string} email
 * @returns {Promise<boolean>}
 */
initialSchema.statics.hasDoneRecord = async function (email) {
    const count = await this.countDocuments({
        email: email.toLowerCase(),
        status: INITIAL_STATUS.DONE
    });
    return count > 0;
};

/**
 * Create from marketing import
 * @param {Object} data
 * @returns {Promise<Initial>}
 */
initialSchema.statics.createFromMarketing = async function (data) {
    const { email, firstName, lastName, phoneNumber, preferredCountry, preferredUniversity, notes } =
        data;

    // Check for existing DONE record
    const hasDone = await this.hasDoneRecord(email);
    if (hasDone) {
        throw new Error('A completed application already exists for this email');
    }

    // Check for existing active record
    const existing = await this.findActiveByEmail(email);
    if (existing) {
        throw new Error('An active record already exists for this email');
    }

    return this.create({
        email,
        firstName,
        lastName,
        phoneNumber: phoneNumber || null,
        preferredCountry: preferredCountry || null,
        preferredUniversity: preferredUniversity || null,
        notes: notes || null,
        source: INITIAL_SOURCE.MARKETING,
        status: INITIAL_STATUS.PENDING
    });
};

/**
 * Create from walk-in
 * @param {Object} data
 * @returns {Promise<Initial>}
 */
initialSchema.statics.createFromWalkIn = async function (data) {
    const { email, firstName, lastName, phoneNumber, preferredCountry, preferredUniversity } = data;

    // For walk-in, replace existing pending/rejected records
    await this.updateMany(
        {
            email: email.toLowerCase(),
            status: { $in: [INITIAL_STATUS.PENDING, INITIAL_STATUS.REJECTED] }
        },
        { deletedAt: new Date() }
    );

    return this.create({
        email,
        firstName,
        lastName,
        phoneNumber: phoneNumber || null,
        preferredCountry: preferredCountry || null,
        preferredUniversity: preferredUniversity || null,
        source: INITIAL_SOURCE.WALK_IN,
        status: INITIAL_STATUS.APPROVED
    });
};

/**
 * Create from online (student submission)
 * @param {ObjectId} userId
 * @param {Object} data
 * @returns {Promise<Initial>}
 */
initialSchema.statics.createFromOnline = async function (userId, data) {
    const { email, firstName, lastName, phoneNumber, preferredCountry, preferredUniversity } = data;

    // For online, replace existing non-DONE records
    await this.updateMany(
        {
            email: email.toLowerCase(),
            status: { $ne: INITIAL_STATUS.DONE }
        },
        { deletedAt: new Date() }
    );

    return this.create({
        email,
        firstName,
        lastName,
        phoneNumber: phoneNumber || null,
        preferredCountry: preferredCountry || null,
        preferredUniversity: preferredUniversity || null,
        source: INITIAL_SOURCE.ONLINE,
        status: INITIAL_STATUS.APPROVED,
        userId
    });
};

/**
 * Import from Google Sheets
 * @param {Array} records - Array of records from sheet
 * @returns {Promise<Object>} - Summary of import
 */
initialSchema.statics.importFromSheets = async function (records) {
    const summary = {
        total: records.length,
        imported: 0,
        skipped: [],
        errors: []
    };

    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNumber = i + 2; // Account for header row

        try {
            await this.createFromMarketing(record);
            summary.imported++;
        } catch (error) {
            if (error.message.includes('already exists')) {
                summary.skipped.push({
                    row: rowNumber,
                    email: record.email,
                    reason: error.message
                });
            } else {
                summary.errors.push({
                    row: rowNumber,
                    email: record.email,
                    reason: error.message
                });
            }
        }
    }

    return summary;
};

// ============================================
// JSON TRANSFORM
// ============================================
initialSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

initialSchema.set('toObject', { virtuals: true });

// ============================================
// EXPORT
// ============================================
const Initial = model('Initial', initialSchema);
export default Initial;