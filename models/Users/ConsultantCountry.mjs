// models/ConsultantCountry.mjs
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ============================================
// SCHEMA DEFINITION
// ============================================
const consultantCountrySchema = new Schema(
    {
        // ---- Link to Staff Profile ----
        staffProfileId: {
            type: Schema.Types.ObjectId,
            ref: 'StaffProfile',
            required: [true, 'Staff Profile ID is required'],
            index: true
        },

        // ---- Country ----
        country: {
            type: String,
            required: [true, 'Country is required'],
            trim: true,
            minlength: [2, 'Country name must be at least 2 characters'],
            maxlength: [100, 'Country name cannot exceed 100 characters']
        },

        // ---- Status ----
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },

        // ---- Assignment Info ----
        assignedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        assignedAt: {
            type: Date,
            default: Date.now
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
consultantCountrySchema.index({ staffProfileId: 1, country: 1 }, { unique: true });
consultantCountrySchema.index({ country: 1, isActive: 1 });

// ============================================
// QUERY MIDDLEWARE - Exclude soft deleted
// ============================================
consultantCountrySchema.pre(/^find/, function (next) {
    if (this.getOptions().includeSoftDeleted !== true) {
        this.where({ deletedAt: null });
    }
    next();
});

// ============================================
// VIRTUALS
// ============================================
consultantCountrySchema.virtual('isDeleted').get(function () {
    return this.deletedAt !== null;
});

consultantCountrySchema.virtual('staffProfile', {
    ref: 'StaffProfile',
    localField: 'staffProfileId',
    foreignField: '_id',
    justOne: true
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Activate country assignment
 * @returns {Promise<ConsultantCountry>}
 */
consultantCountrySchema.methods.activate = function () {
    this.isActive = true;
    return this.save();
};

/**
 * Deactivate country assignment
 * @returns {Promise<ConsultantCountry>}
 */
consultantCountrySchema.methods.deactivate = function () {
    this.isActive = false;
    return this.save();
};

/**
 * Soft delete assignment
 * @returns {Promise<ConsultantCountry>}
 */
consultantCountrySchema.methods.softDelete = function () {
    this.deletedAt = new Date();
    this.isActive = false;
    return this.save();
};

/**
 * Restore soft deleted assignment
 * @returns {Promise<ConsultantCountry>}
 */
consultantCountrySchema.methods.restore = function () {
    this.deletedAt = null;
    return this.save();
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Assign country to consultant
 * @param {ObjectId} staffProfileId
 * @param {string} country
 * @param {ObjectId} assignedBy
 * @returns {Promise<ConsultantCountry>}
 */
consultantCountrySchema.statics.assignCountry = async function (
    staffProfileId,
    country,
    assignedBy = null
) {
    // Check if already exists
    const existing = await this.findOne({ staffProfileId, country }).setOptions({
        includeSoftDeleted: true
    });

    if (existing) {
        if (existing.deletedAt) {
            // Restore and activate
            existing.deletedAt = null;
            existing.isActive = true;
            existing.assignedBy = assignedBy;
            existing.assignedAt = new Date();
            return existing.save();
        }
        throw new Error('Country is already assigned to this consultant');
    }

    return this.create({
        staffProfileId,
        country,
        assignedBy,
        assignedAt: new Date()
    });
};

/**
 * Get countries for a consultant
 * @param {ObjectId} staffProfileId
 * @param {boolean} activeOnly
 * @returns {Promise<ConsultantCountry[]>}
 */
consultantCountrySchema.statics.getCountriesForConsultant = function (
    staffProfileId,
    activeOnly = true
) {
    const query = { staffProfileId };
    if (activeOnly) {
        query.isActive = true;
    }
    return this.find(query).sort({ country: 1 });
};

/**
 * Get consultants for a country
 * @param {string} country
 * @returns {Promise<ConsultantCountry[]>}
 */
consultantCountrySchema.statics.getConsultantsForCountry = function (country) {
    return this.find({ country, isActive: true }).populate({
        path: 'staffProfile',
        populate: { path: 'user' }
    });
};

/**
 * Check if consultant handles country
 * @param {ObjectId} staffProfileId
 * @param {string} country
 * @returns {Promise<boolean>}
 */
consultantCountrySchema.statics.consultantHandlesCountry = async function (
    staffProfileId,
    country
) {
    const count = await this.countDocuments({
        staffProfileId,
        country,
        isActive: true
    });
    return count > 0;
};

/**
 * Remove country from consultant
 * @param {ObjectId} staffProfileId
 * @param {string} country
 * @returns {Promise<ConsultantCountry>}
 */
consultantCountrySchema.statics.removeCountry = async function (staffProfileId, country) {
    const assignment = await this.findOne({ staffProfileId, country });
    if (!assignment) {
        throw new Error('Country assignment not found');
    }
    return assignment.softDelete();
};

// ============================================
// JSON TRANSFORM
// ============================================
consultantCountrySchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

consultantCountrySchema.set('toObject', { virtuals: true });

// ============================================
// EXPORT
// ============================================
const ConsultantCountry = model('ConsultantCountry', consultantCountrySchema);
export default ConsultantCountry;