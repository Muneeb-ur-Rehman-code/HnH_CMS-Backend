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
    DONE: 'DONE',
    DECLINED: 'DECLINED',
    REFUSED: 'REFUSED'
});

export const INITIAL_TYPE = Object.freeze({
    STUDY: 'STUDY',
    VISIT: 'VISIT'
});

// ============================================
// SCHEMA DEFINITION
// ============================================
const initialSchema = new Schema(
    {
        studentId: {
            type: Schema.Types.ObjectId,
            ref: 'StudentProfile',
            required: [true, 'Student ID is required'],
            index: true
        },

        type: {
            type: String,
            enum: {
                values: Object.values(INITIAL_TYPE),
                message: 'Invalid type: {VALUE}'
            },
            required: [true, 'Type is required'],
            default: INITIAL_TYPE.STUDY,
            index: true
        },

        preferredCountry: {
            type: Schema.Types.Mixed,
            default: null,
            validate: {
                validator: function (value) {
                    if (value === null || value === undefined) return true;
                    // Can be ObjectId or "OTHER" string
                    if (value === 'OTHER') return true;
                    return mongoose.Types.ObjectId.isValid(value);
                },
                message: 'Preferred country must be a valid Country ID or "OTHER"'
            },
            required: [true, 'Preferred country is required']
        },

        otherCountry: {
            type: String,
            trim: true,
            maxlength: [100, 'Other country cannot exceed 100 characters'],
            default: null
        },

        preferredUniversity: {
            type: Schema.Types.Mixed,
            default: null,
            validate: {
                validator: function (value) {
                    if (value === null || value === undefined) return true;
                    // Can be ObjectId or "OTHER" string
                    if (value === 'OTHER') return true;
                    return mongoose.Types.ObjectId.isValid(value);
                },
                message: 'Preferred university must be a valid University ID or "OTHER"'
            }
        },

        otherUniversity: {
            type: String,
            trim: true,
            maxlength: [200, 'Other university cannot exceed 200 characters'],
            default: null
        },

        assignedConsultantId: {
            type: Schema.Types.ObjectId,
            ref: 'StaffProfile',
            default: null,
            index: true
        },

        notes: {
            type: String,
            trim: true,
            maxlength: [500, 'Notes cannot exceed 500 characters'],
            default: null
        },

        source: {
            type: String,
            enum: {
                values: Object.values(INITIAL_SOURCE),
                message: 'Invalid source: {VALUE}'
            },
            default: INITIAL_SOURCE.MARKETING,
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

        markedBy: {
            type: Schema.Types.ObjectId,
            ref: 'StaffProfile',
            default: null
        },

        markedAt: {
            type: Date,
            default: null
        }
    }, { timestamps: true }
);

// ============================================
// INDEXES
// ============================================
initialSchema.index({ studentId: 1, status: 1 });
initialSchema.index({ source: 1, status: 1 });
initialSchema.index({ type: 1, status: 1 });
initialSchema.index({ assignedConsultantId: 1, status: 1 });
initialSchema.index({ preferredCountry: 1, status: 1 });
initialSchema.index({ createdAt: -1 });

// ============================================
// VALIDATION MIDDLEWARE
// ============================================
initialSchema.pre('validate', async function () {
    // Validate otherCountry is provided when preferredCountry is "OTHER"
    if (this.preferredCountry === 'OTHER') {
        if (!this.otherCountry || !this.otherCountry.trim()) {
            this.invalidate('otherCountry', 'Other country is required when preferred country is "OTHER"');
        }
    } else if (this.preferredCountry !== null && this.preferredCountry !== undefined) {
        // Clear otherCountry if preferredCountry is not "OTHER"
        this.otherCountry = null;
    }

    // Validate otherUniversity is provided when preferredUniversity is "OTHER" (only for STUDY type)
    if (this.type === INITIAL_TYPE.STUDY && this.preferredUniversity === 'OTHER') {
        if (!this.otherUniversity || !this.otherUniversity.trim()) {
            this.invalidate('otherUniversity', 'Other university is required when preferred university is "OTHER"');
        }
    } else if (this.preferredUniversity !== null && this.preferredUniversity !== undefined) {
        // Clear otherUniversity if preferredUniversity is not "OTHER"
        this.otherUniversity = null;
    }

    // Clear preferredUniversity if type is VISIT
    if (this.type === INITIAL_TYPE.VISIT) {
        this.preferredUniversity = null;
        this.otherUniversity = null;
    }

    // Validate university belongs to country if both are not "OTHER" (only for STUDY type)
    if (this.type === INITIAL_TYPE.STUDY &&
        this.preferredCountry &&
        this.preferredCountry !== 'OTHER' &&
        mongoose.Types.ObjectId.isValid(this.preferredCountry) &&
        this.preferredUniversity &&
        this.preferredUniversity !== 'OTHER' &&
        mongoose.Types.ObjectId.isValid(this.preferredUniversity)) {

        const University = model('University');
        const countryId = new mongoose.Types.ObjectId(this.preferredCountry);
        const universityId = new mongoose.Types.ObjectId(this.preferredUniversity);

        const university = await University.findById(universityId);

        if (!university) {
            this.invalidate('preferredUniversity', 'University not found');
        } else if (!university.country || university.country.toString() !== countryId.toString()) {
            this.invalidate('preferredUniversity', 'Selected university does not belong to the selected country');
        }
    }
});

// ============================================
// VIRTUALS
// ============================================
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

initialSchema.virtual('isDeclined').get(function () {
    return this.status === INITIAL_STATUS.DECLINED;
});

initialSchema.virtual('isRefused').get(function () {
    return this.status === INITIAL_STATUS.REFUSED;
});

initialSchema.virtual('isStudy').get(function () {
    return this.type === INITIAL_TYPE.STUDY;
});

initialSchema.virtual('isVisit').get(function () {
    return this.type === INITIAL_TYPE.VISIT;
});

// ============================================
// INSTANCE METHODS
// ============================================
initialSchema.methods.markAsDone = function (consultantId) {
    this.status = INITIAL_STATUS.DONE;
    this.markedBy = consultantId;
    this.markedAt = new Date();
    return this.save();
};

initialSchema.methods.markAsDeclined = function (consultantId) {
    this.status = INITIAL_STATUS.DECLINED;
    this.markedBy = consultantId;
    this.markedAt = new Date();
    return this.save();
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
