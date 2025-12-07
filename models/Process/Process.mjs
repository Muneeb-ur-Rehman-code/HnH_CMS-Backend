// models/Application.mjs
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ============================================
// ENUMS
// ============================================
export const APPLICATION_STATUS = Object.freeze({
    // Initial stages
    GATHERING_INFO: 'GATHERING_INFO',
    INFO_COMPLETE: 'INFO_COMPLETE',

    // Invoice stages
    INVOICE_PENDING: 'INVOICE_PENDING',
    INVOICE_PROCESSING: 'INVOICE_PROCESSING',
    INVOICE_COMPLETE: 'INVOICE_COMPLETE',

    // Document stages
    DOCUMENTS_PENDING: 'DOCUMENTS_PENDING',
    DOCUMENTS_PROCESSING: 'DOCUMENTS_PROCESSING',
    DOCUMENTS_COMPLETE: 'DOCUMENTS_COMPLETE',

    // Admission stages
    ADMISSION_PENDING: 'ADMISSION_PENDING',
    ADMISSION_PROCESSING: 'ADMISSION_PROCESSING',
    ADMISSION_COMPLETE: 'ADMISSION_COMPLETE',

    // Visa stages
    VISA_PENDING: 'VISA_PENDING',
    VISA_PROCESSING: 'VISA_PROCESSING',
    VISA_COMPLETE: 'VISA_COMPLETE',

    // Final stages
    SUBMITTED: 'SUBMITTED',
    COMPLETE: 'COMPLETE',

    // Terminal stages
    CANCELLED: 'CANCELLED',
    REJECTED: 'REJECTED',
    ON_HOLD: 'ON_HOLD'
});

export const INTAKE_PREFERENCE = Object.freeze({
    SPRING: 'SPRING',
    SUMMER: 'SUMMER',
    FALL: 'FALL',
    WINTER: 'WINTER',
    FLEXIBLE: 'FLEXIBLE'
});

export const CURRENCY = Object.freeze({
    USD: 'USD',
    EUR: 'EUR',
    GBP: 'GBP',
    PKR: 'PKR',
    AED: 'AED',
    SAR: 'SAR',
    QAR: 'QAR',
    KWD: 'KWD',
    BHD: 'BHD',
    OMR: 'OMR',
    AUD: 'AUD',
    CAD: 'CAD'
});

// ============================================
// SUB-SCHEMAS
// ============================================
const budgetSchema = new Schema(
    {
        amount: {
            type: Number,
            min: [0, 'Budget amount cannot be negative'],
            default: null
        },
        currency: {
            type: String,
            enum: {
                values: Object.values(CURRENCY),
                message: 'Invalid currency: {VALUE}'
            },
            default: CURRENCY.USD
        }
    },
    { _id: false }
);

// Copied user data (snapshot at application creation)
const applicantDataSchema = new Schema(
    {
        firstName: {
            type: String,
            trim: true,
            default: null
        },
        lastName: {
            type: String,
            trim: true,
            default: null
        },
        dob: {
            type: Date,
            default: null
        },
        gender: {
            type: String,
            default: null
        },
        nationality: {
            type: String,
            default: null
        },
        passportNumber: {
            type: String,
            default: null
        },
        passportExpiry: {
            type: Date,
            default: null
        },
        address: {
            street: { type: String, default: null },
            city: { type: String, default: null },
            state: { type: String, default: null },
            postalCode: { type: String, default: null },
            country: { type: String, default: null }
        },
        educationLevel: {
            type: String,
            default: null
        },
        currentInstitution: {
            type: String,
            default: null
        },
        graduationYear: {
            type: Number,
            default: null
        },
        lastGpa: {
            type: Number,
            default: null
        },
        englishProficiency: {
            testType: { type: String, default: null },
            overallScore: { type: Number, default: null },
            testDate: { type: Date, default: null }
        }
    },
    { _id: false }
);

// ============================================
// MAIN SCHEMA
// ============================================
const applicationSchema = new Schema(
    {
        // ---- Links ----
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true
        },

        initialId: {
            type: Schema.Types.ObjectId,
            ref: 'Initial',
            default: null,
            index: true
        },

        consultantId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Consultant ID is required'],
            index: true
        },

        // ---- Copied User Data (snapshot) ----
        applicantData: {
            type: applicantDataSchema,
            default: () => ({})
        },

        // ---- Live Reference Data (always current) ----
        // Email and phone are NOT copied - fetched from user

        // ---- Application Details ----
        targetCountry: {
            type: String,
            trim: true,
            maxlength: [100, 'Target country cannot exceed 100 characters'],
            default: null,
            index: true
        },

        targetUniversity: {
            type: String,
            trim: true,
            maxlength: [200, 'Target university cannot exceed 200 characters'],
            default: null
        },

        targetCourse: {
            type: String,
            trim: true,
            maxlength: [200, 'Target course cannot exceed 200 characters'],
            default: null
        },

        intakePreference: {
            type: String,
            enum: {
                values: Object.values(INTAKE_PREFERENCE),
                message: 'Invalid intake preference: {VALUE}'
            },
            default: INTAKE_PREFERENCE.FLEXIBLE
        },

        intakeYear: {
            type: Number,
            min: [new Date().getFullYear(), 'Intake year cannot be in the past'],
            max: [new Date().getFullYear() + 5, 'Intake year cannot be more than 5 years ahead'],
            default: null
        },

        budget: {
            type: budgetSchema,
            default: () => ({})
        },

        // ---- Status ----
        status: {
            type: String,
            enum: {
                values: Object.values(APPLICATION_STATUS),
                message: 'Invalid application status: {VALUE}'
            },
            default: APPLICATION_STATUS.GATHERING_INFO,
            index: true
        },

        // ---- Status History ----
        statusHistory: [
            {
                status: {
                    type: String,
                    required: true
                },
                changedBy: {
                    type: Schema.Types.ObjectId,
                    ref: 'User'
                },
                changedAt: {
                    type: Date,
                    default: Date.now
                },
                notes: {
                    type: String,
                    default: null
                }
            }
        ],

        // ---- Assignment ----
        agentId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true
        },

        assignedToAgentAt: {
            type: Date,
            default: null
        },

        // ---- Notes ----
        internalNotes: {
            type: String,
            trim: true,
            maxlength: [2000, 'Internal notes cannot exceed 2000 characters'],
            default: null
        },

        studentNotes: {
            type: String,
            trim: true,
            maxlength: [1000, 'Student notes cannot exceed 1000 characters'],
            default: null
        },

        // ---- Cancellation/Rejection ----
        cancellationReason: {
            type: String,
            trim: true,
            maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
            default: null
        },

        rejectionReason: {
            type: String,
            trim: true,
            maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
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
applicationSchema.index({ userId: 1, status: 1 });
applicationSchema.index({ consultantId: 1, status: 1 });
applicationSchema.index({ agentId: 1, status: 1 });
applicationSchema.index({ targetCountry: 1, status: 1 });
applicationSchema.index({ createdAt: -1 });

// ============================================
// QUERY MIDDLEWARE - Exclude soft deleted
// ============================================
applicationSchema.pre(/^find/, function () {
    if (this.getOptions().includeSoftDeleted !== true) {
        this.where({ deletedAt: null });
    }
    // next();
});

// ============================================
// VIRTUALS
// ============================================
applicationSchema.virtual('isActive').get(function () {
    return ![
        APPLICATION_STATUS.COMPLETE,
        APPLICATION_STATUS.CANCELLED,
        APPLICATION_STATUS.REJECTED
    ].includes(this.status);
});

applicationSchema.virtual('isComplete').get(function () {
    return this.status === APPLICATION_STATUS.COMPLETE;
});

applicationSchema.virtual('isCancelled').get(function () {
    return this.status === APPLICATION_STATUS.CANCELLED;
});

applicationSchema.virtual('isRejected').get(function () {
    return this.status === APPLICATION_STATUS.REJECTED;
});

applicationSchema.virtual('isDeleted').get(function () {
    return this.deletedAt !== null;
});

applicationSchema.virtual('applicantFullName').get(function () {
    if (!this.applicantData?.firstName && !this.applicantData?.lastName) return null;
    return [this.applicantData?.firstName, this.applicantData?.lastName].filter(Boolean).join(' ');
});

// Virtual populate
applicationSchema.virtual('user', {
    ref: 'User',
    localField: 'userId',
    foreignField: '_id',
    justOne: true
});

applicationSchema.virtual('consultant', {
    ref: 'User',
    localField: 'consultantId',
    foreignField: '_id',
    justOne: true
});

applicationSchema.virtual('agent', {
    ref: 'User',
    localField: 'agentId',
    foreignField: '_id',
    justOne: true
});

applicationSchema.virtual('invoices', {
    ref: 'Invoice',
    localField: '_id',
    foreignField: 'applicationId'
});

applicationSchema.virtual('tasks', {
    ref: 'Task',
    localField: '_id',
    foreignField: 'applicationId'
});

applicationSchema.virtual('documents', {
    ref: 'Document',
    localField: '_id',
    foreignField: 'applicationId'
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Update application status
 * @param {string} newStatus - New status
 * @param {ObjectId} changedBy - User making the change
 * @param {string} notes - Optional notes
 * @returns {Promise<Application>}
 */
applicationSchema.methods.updateStatus = function (newStatus, changedBy, notes = null) {
    if (!Object.values(APPLICATION_STATUS).includes(newStatus)) {
        throw new Error('Invalid application status');
    }

    // Add to history
    this.statusHistory.push({
        status: newStatus,
        changedBy,
        changedAt: new Date(),
        notes
    });

    this.status = newStatus;
    return this.save();
};

/**
 * Assign agent
 * @param {ObjectId} agentId
 * @returns {Promise<Application>}
 */
applicationSchema.methods.assignAgent = function (agentId) {
    this.agentId = agentId;
    this.assignedToAgentAt = new Date();
    return this.save();
};

/**
 * Cancel application
 * @param {ObjectId} cancelledBy - User cancelling
 * @param {string} reason - Cancellation reason
 * @returns {Promise<Application>}
 */
applicationSchema.methods.cancel = function (cancelledBy, reason) {
    if (!reason) {
        throw new Error('Cancellation reason is required');
    }

    this.cancellationReason = reason;
    return this.updateStatus(APPLICATION_STATUS.CANCELLED, cancelledBy, reason);
};

/**
 * Reject application
 * @param {ObjectId} rejectedBy - User rejecting
 * @param {string} reason - Rejection reason
 * @returns {Promise<Application>}
 */
applicationSchema.methods.reject = function (rejectedBy, reason) {
    if (!reason) {
        throw new Error('Rejection reason is required');
    }

    this.rejectionReason = reason;
    return this.updateStatus(APPLICATION_STATUS.REJECTED, rejectedBy, reason);
};

/**
 * Put on hold
 * @param {ObjectId} userId
 * @param {string} reason
 * @returns {Promise<Application>}
 */
applicationSchema.methods.putOnHold = function (userId, reason = null) {
    return this.updateStatus(APPLICATION_STATUS.ON_HOLD, userId, reason);
};

/**
 * Resume from hold
 * @param {ObjectId} userId
 * @param {string} resumeToStatus - Status to resume to
 * @returns {Promise<Application>}
 */
applicationSchema.methods.resumeFromHold = function (userId, resumeToStatus) {
    if (this.status !== APPLICATION_STATUS.ON_HOLD) {
        throw new Error('Application is not on hold');
    }
    return this.updateStatus(resumeToStatus, userId, 'Resumed from hold');
};

/**
 * Update applicant data snapshot
 * @param {Object} userData - User and student profile data
 * @returns {Promise<Application>}
 */
applicationSchema.methods.updateApplicantSnapshot = function (userData) {
    const {
        firstName,
        lastName,
        dob,
        gender,
        nationality,
        passportNumber,
        passportExpiry,
        address,
        educationLevel,
        currentInstitution,
        graduationYear,
        lastGpa,
        englishProficiency
    } = userData;

    this.applicantData = {
        firstName,
        lastName,
        dob,
        gender,
        nationality,
        passportNumber,
        passportExpiry,
        address,
        educationLevel,
        currentInstitution,
        graduationYear,
        lastGpa,
        englishProficiency
    };

    return this.save();
};

/**
 * Update target details
 * @param {Object} targetData
 * @returns {Promise<Application>}
 */
applicationSchema.methods.updateTargetDetails = function (targetData) {
    const { targetCountry, targetUniversity, targetCourse, intakePreference, intakeYear, budget } =
        targetData;

    if (targetCountry !== undefined) this.targetCountry = targetCountry;
    if (targetUniversity !== undefined) this.targetUniversity = targetUniversity;
    if (targetCourse !== undefined) this.targetCourse = targetCourse;
    if (intakePreference !== undefined) this.intakePreference = intakePreference;
    if (intakeYear !== undefined) this.intakeYear = intakeYear;
    if (budget !== undefined) {
        if (budget.amount !== undefined) this.budget.amount = budget.amount;
        if (budget.currency !== undefined) this.budget.currency = budget.currency;
    }

    return this.save();
};

/**
 * Soft delete application
 * @returns {Promise<Application>}
 */
applicationSchema.methods.softDelete = function () {
    this.deletedAt = new Date();
    return this.save();
};

/**
 * Restore soft deleted application
 * @returns {Promise<Application>}
 */
applicationSchema.methods.restore = function () {
    this.deletedAt = null;
    return this.save();
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Create application from initial record
 * @param {Object} initialRecord - Initial record
 * @param {ObjectId} consultantId - Consultant creating the application
 * @param {Object} userData - User and profile data
 * @returns {Promise<Application>}
 */
applicationSchema.statics.createFromInitial = async function (
    initialRecord,
    consultantId,
    userData
) {
    const application = await this.create({
        userId: initialRecord.userId || userData._id,
        initialId: initialRecord._id,
        consultantId,
        targetCountry: initialRecord.preferredCountry,
        targetUniversity: initialRecord.preferredUniversity,
        applicantData: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            dob: userData.dob,
            gender: userData.gender,
            nationality: userData.studentProfile?.nationality,
            passportNumber: userData.studentProfile?.passportNumber,
            passportExpiry: userData.studentProfile?.passportExpiry,
            address: userData.studentProfile?.address,
            educationLevel: userData.studentProfile?.educationLevel,
            currentInstitution: userData.studentProfile?.currentInstitution,
            graduationYear: userData.studentProfile?.graduationYear,
            lastGpa: userData.studentProfile?.lastGpa,
            englishProficiency: userData.studentProfile?.englishProficiency
        },
        status: APPLICATION_STATUS.GATHERING_INFO,
        statusHistory: [
            {
                status: APPLICATION_STATUS.GATHERING_INFO,
                changedBy: consultantId,
                changedAt: new Date(),
                notes: 'Application created'
            }
        ]
    });

    return application;
};

/**
 * Find applications by user
 * @param {ObjectId} userId
 * @returns {Promise<Application[]>}
 */
applicationSchema.statics.findByUser = function (userId) {
    return this.find({ userId })
        .populate('consultant', 'firstName lastName email')
        .populate('agent', 'firstName lastName email')
        .sort({ createdAt: -1 });
};

/**
 * Find applications by consultant
 * @param {ObjectId} consultantId
 * @param {string} status - Optional status filter
 * @returns {Promise<Application[]>}
 */
applicationSchema.statics.findByConsultant = function (consultantId, status = null) {
    const query = { consultantId };
    if (status) {
        query.status = status;
    }
    return this.find(query)
        .populate('user', 'firstName lastName email phone')
        .sort({ createdAt: -1 });
};

/**
 * Find applications by consultant's countries
 * @param {Array} countries - Array of country names
 * @param {string} status - Optional status filter
 * @returns {Promise<Application[]>}
 */
applicationSchema.statics.findByCountries = function (countries, status = null) {
    const query = { targetCountry: { $in: countries } };
    if (status) {
        query.status = status;
    }
    return this.find(query)
        .populate('user', 'firstName lastName email phone')
        .populate('consultant', 'firstName lastName email')
        .sort({ createdAt: -1 });
};

/**
 * Find applications by agent
 * @param {ObjectId} agentId
 * @param {string} status - Optional status filter
 * @returns {Promise<Application[]>}
 */
applicationSchema.statics.findByAgent = function (agentId, status = null) {
    const query = { agentId };
    if (status) {
        query.status = status;
    }
    return this.find(query)
        .populate('user', 'firstName lastName email phone')
        .populate('consultant', 'firstName lastName email')
        .sort({ createdAt: -1 });
};

/**
 * Find applications ready for agent (documents complete)
 * @returns {Promise<Application[]>}
 */
applicationSchema.statics.findReadyForAgent = function () {
    return this.find({ status: APPLICATION_STATUS.DOCUMENTS_COMPLETE })
        .populate('user', 'firstName lastName email phone')
        .populate('consultant', 'firstName lastName email')
        .sort({ createdAt: -1 });
};

/**
 * Get application statistics
 * @param {ObjectId} consultantId - Optional consultant filter
 * @returns {Promise<Object>}
 */
applicationSchema.statics.getStatistics = async function (consultantId = null) {
    const matchStage = { deletedAt: null };
    if (consultantId) {
        matchStage.consultantId = new mongoose.Types.ObjectId(consultantId);
    }

    const stats = await this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const result = {
        total: 0,
        byStatus: {}
    };

    stats.forEach((s) => {
        result.byStatus[s._id] = s.count;
        result.total += s.count;
    });

    return result;
};

// ============================================
// JSON TRANSFORM
// ============================================
applicationSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

applicationSchema.set('toObject', { virtuals: true });

// ============================================
// EXPORT
// ============================================
const Application = model('Application', applicationSchema);
export default Application;