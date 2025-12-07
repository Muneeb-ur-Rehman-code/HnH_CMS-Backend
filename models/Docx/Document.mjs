// models/Document.mjs
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ============================================
// ENUMS
// ============================================
export const DOCUMENT_TYPE = Object.freeze({
    PASSPORT: 'PASSPORT',
    ACADEMIC_TRANSCRIPT: 'ACADEMIC_TRANSCRIPT',
    DEGREE_CERTIFICATE: 'DEGREE_CERTIFICATE',
    ENGLISH_TEST: 'ENGLISH_TEST',
    RECOMMENDATION_LETTER: 'RECOMMENDATION_LETTER',
    STATEMENT_OF_PURPOSE: 'STATEMENT_OF_PURPOSE',
    CV_RESUME: 'CV_RESUME',
    FINANCIAL_DOCUMENT: 'FINANCIAL_DOCUMENT',
    VISA_FORM: 'VISA_FORM',
    PHOTO: 'PHOTO',
    OFFER_LETTER: 'OFFER_LETTER',
    ADMISSION_LETTER: 'ADMISSION_LETTER',
    VISA_APPROVAL: 'VISA_APPROVAL',
    PAYMENT_RECEIPT: 'PAYMENT_RECEIPT',
    OTHER: 'OTHER'
});

export const DOCUMENT_STATUS = Object.freeze({
    PENDING: 'PENDING',           // Requested but not uploaded
    UPLOADED: 'UPLOADED',         // Uploaded, awaiting verification
    VERIFIED: 'VERIFIED',         // Verified and accepted
    REJECTED: 'REJECTED'          // Rejected, needs re-upload
});

// ============================================
// SCHEMA DEFINITION
// ============================================
const documentSchema = new Schema(
    {
        // ---- Core Fields ----
        applicationId: {
            type: Schema.Types.ObjectId,
            ref: 'Application',
            required: [true, 'Application ID is required'],
            index: true
        },

        taskId: {
            type: Schema.Types.ObjectId,
            ref: 'Task',
            default: null,
            index: true
        },

        // ---- Document Info ----
        documentType: {
            type: String,
            enum: {
                values: Object.values(DOCUMENT_TYPE),
                message: 'Invalid document type: {VALUE}'
            },
            required: [true, 'Document type is required'],
            index: true
        },

        name: {
            type: String,
            required: [true, 'Document name is required'],
            trim: true,
            minlength: [2, 'Document name must be at least 2 characters'],
            maxlength: [200, 'Document name cannot exceed 200 characters']
        },

        description: {
            type: String,
            trim: true,
            maxlength: [500, 'Description cannot exceed 500 characters'],
            default: null
        },

        // ---- File Info ----
        filePath: {
            type: String,
            trim: true,
            default: null,
            validate: {
                validator: function (value) {
                    if (!value) return true;
                    // Basic path validation
                    return /^[\w\-\/\\.]+\.(pdf|jpg|jpeg|png|doc|docx)$/i.test(value);
                },
                message: 'Invalid file path format'
            }
        },

        fileName: {
            type: String,
            trim: true,
            default: null
        },

        fileSize: {
            type: Number,  // in bytes
            default: null,
            min: [0, 'File size cannot be negative']
        },

        mimeType: {
            type: String,
            trim: true,
            default: null
        },

        // ---- Status & Verification ----
        status: {
            type: String,
            enum: {
                values: Object.values(DOCUMENT_STATUS),
                message: 'Invalid document status: {VALUE}'
            },
            default: DOCUMENT_STATUS.PENDING,
            index: true
        },

        // ---- Upload Info ----
        uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true
        },

        uploadedAt: {
            type: Date,
            default: null
        },

        // ---- Verification Info ----
        verifiedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        verifiedAt: {
            type: Date,
            default: null
        },

        verificationNotes: {
            type: String,
            trim: true,
            maxlength: [1000, 'Verification notes cannot exceed 1000 characters'],
            default: null
        },

        // ---- Rejection Info ----
        rejectedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        rejectedAt: {
            type: Date,
            default: null
        },

        rejectionReason: {
            type: String,
            trim: true,
            maxlength: [1000, 'Rejection reason cannot exceed 1000 characters'],
            default: null
        },

        // ---- Expiry ----
        expiryDate: {
            type: Date,
            default: null
        },

        // ---- Visibility ----
        visibleToStudent: {
            type: Boolean,
            default: true
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
documentSchema.index({ applicationId: 1, documentType: 1 });
documentSchema.index({ applicationId: 1, status: 1 });
documentSchema.index({ uploadedBy: 1, status: 1 });
documentSchema.index({ expiryDate: 1 }, { sparse: true });

// ============================================
// QUERY MIDDLEWARE - Exclude soft deleted
// ============================================
documentSchema.pre(/^find/, function (next) {
    if (this.getOptions().includeSoftDeleted !== true) {
        this.where({ deletedAt: null });
    }
    next();
});

// ============================================
// VIRTUALS
// ============================================
documentSchema.virtual('isExpired').get(function () {
    if (!this.expiryDate) return false;
    return new Date() > this.expiryDate;
});

documentSchema.virtual('isUploaded').get(function () {
    return this.filePath !== null;
});

documentSchema.virtual('isVerified').get(function () {
    return this.status === DOCUMENT_STATUS.VERIFIED;
});

documentSchema.virtual('isDeleted').get(function () {
    return this.deletedAt !== null;
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Upload document file
 * @param {ObjectId} userId - User uploading the document
 * @param {Object} fileInfo - File information
 */
documentSchema.methods.upload = function (userId, fileInfo) {
    const { filePath, fileName, fileSize, mimeType } = fileInfo;

    if (!filePath) {
        throw new Error('File path is required');
    }

    this.filePath = filePath;
    this.fileName = fileName || null;
    this.fileSize = fileSize || null;
    this.mimeType = mimeType || null;
    this.uploadedBy = userId;
    this.uploadedAt = new Date();
    this.status = DOCUMENT_STATUS.UPLOADED;

    // Clear any previous rejection
    this.rejectedBy = null;
    this.rejectedAt = null;
    this.rejectionReason = null;

    return this.save();
};

/**
 * Verify the document
 * @param {ObjectId} userId - User verifying
 * @param {string} notes - Optional verification notes
 */
documentSchema.methods.verify = function (userId, notes = null) {
    if (this.status !== DOCUMENT_STATUS.UPLOADED) {
        throw new Error(`Cannot verify document with status: ${this.status}`);
    }
    if (!this.filePath) {
        throw new Error('Cannot verify document without uploaded file');
    }

    this.status = DOCUMENT_STATUS.VERIFIED;
    this.verifiedBy = userId;
    this.verifiedAt = new Date();
    if (notes) {
        this.verificationNotes = notes;
    }

    return this.save();
};

/**
 * Reject the document
 * @param {ObjectId} userId - User rejecting
 * @param {string} reason - Rejection reason
 */
documentSchema.methods.reject = function (userId, reason) {
    if (this.status !== DOCUMENT_STATUS.UPLOADED) {
        throw new Error(`Cannot reject document with status: ${this.status}`);
    }
    if (!reason) {
        throw new Error('Rejection reason is required');
    }

    this.status = DOCUMENT_STATUS.REJECTED;
    this.rejectedBy = userId;
    this.rejectedAt = new Date();
    this.rejectionReason = reason;

    return this.save();
};

/**
 * Reset to pending status (for re-upload request)
 */
documentSchema.methods.resetToPending = function () {
    this.status = DOCUMENT_STATUS.PENDING;
    this.filePath = null;
    this.fileName = null;
    this.fileSize = null;
    this.mimeType = null;
    this.uploadedBy = null;
    this.uploadedAt = null;
    this.verifiedBy = null;
    this.verifiedAt = null;
    this.verificationNotes = null;
    this.rejectedBy = null;
    this.rejectedAt = null;
    this.rejectionReason = null;

    return this.save();
};

/**
 * Set expiry date
 * @param {Date} expiryDate
 */
documentSchema.methods.setExpiry = function (expiryDate) {
    if (expiryDate && new Date(expiryDate) <= new Date()) {
        throw new Error('Expiry date must be in the future');
    }
    this.expiryDate = expiryDate;
    return this.save();
};

/**
 * Soft delete the document
 */
documentSchema.methods.softDelete = function () {
    this.deletedAt = new Date();
    return this.save();
};

/**
 * Restore soft deleted document
 */
documentSchema.methods.restore = function () {
    this.deletedAt = null;
    return this.save();
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Find documents by application
 * @param {ObjectId} applicationId
 * @param {string} status - Optional status filter
 */
documentSchema.statics.findByApplication = function (applicationId, status = null) {
    const query = { applicationId };
    if (status) {
        query.status = status;
    }
    return this.find(query).sort({ createdAt: -1 });
};

/**
 * Find documents by application visible to student
 * @param {ObjectId} applicationId
 */
documentSchema.statics.findByApplicationForStudent = function (applicationId) {
    return this.find({
        applicationId,
        visibleToStudent: true
    }).sort({ createdAt: -1 });
};

/**
 * Get pending documents count for application
 * @param {ObjectId} applicationId
 */
documentSchema.statics.getPendingCount = async function (applicationId) {
    return this.countDocuments({
        applicationId,
        status: { $in: [DOCUMENT_STATUS.PENDING, DOCUMENT_STATUS.REJECTED] }
    });
};

/**
 * Check if all required documents are verified
 * @param {ObjectId} applicationId
 * @param {Array} requiredTypes - Array of required document types
 */
documentSchema.statics.areAllRequiredVerified = async function (applicationId, requiredTypes) {
    const verifiedDocs = await this.find({
        applicationId,
        documentType: { $in: requiredTypes },
        status: DOCUMENT_STATUS.VERIFIED
    }).distinct('documentType');

    return requiredTypes.every(type => verifiedDocs.includes(type));
};

/**
 * Find expiring documents
 * @param {number} daysBeforeExpiry - Days before expiry to check
 */
documentSchema.statics.findExpiring = function (daysBeforeExpiry = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysBeforeExpiry);

    return this.find({
        expiryDate: { $lte: futureDate, $gt: new Date() },
        status: DOCUMENT_STATUS.VERIFIED
    }).sort({ expiryDate: 1 });
};

/**
 * Find expired documents
 */
documentSchema.statics.findExpired = function () {
    return this.find({
        expiryDate: { $lt: new Date() },
        status: DOCUMENT_STATUS.VERIFIED
    }).sort({ expiryDate: 1 });
};

/**
 * Create a document request (pending document)
 * @param {Object} data - Document data
 */
documentSchema.statics.createRequest = async function (data) {
    const { applicationId, documentType, name, description, taskId, visibleToStudent } = data;

    return this.create({
        applicationId,
        documentType,
        name,
        description: description || null,
        taskId: taskId || null,
        visibleToStudent: visibleToStudent !== false,
        status: DOCUMENT_STATUS.PENDING
    });
};

// ============================================
// JSON TRANSFORM
// ============================================
documentSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

documentSchema.set('toObject', { virtuals: true });

// ============================================
// EXPORT
// ============================================
const Document = model('Document', documentSchema);
export default Document;