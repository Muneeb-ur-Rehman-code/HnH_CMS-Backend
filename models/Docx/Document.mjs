// models/Docx/Document.mjs
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
    REJECTED: 'REJECTED',         // Rejected, needs re-upload
    DECLINED: 'DECLINED'          // Declined due to process cancellation/refund
});

// ============================================
// SCHEMA DEFINITION
// ============================================
const documentSchema = new Schema(
    {
        taskId: {
            type: Schema.Types.ObjectId,
            ref: 'Task',
            required: true,
            index: true
        },
        documentType: {
            type: String,
            enum: {
                values: Object.values(DOCUMENT_TYPE),
                message: 'Invalid document type: {VALUE}'
            },
            required: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: [200, 'Document name cannot exceed 200 characters']
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, 'Description cannot exceed 500 characters'],
            default: null
        },
        filePath: {
            type: String,
            trim: true,
            default: null
        },
        status: {
            type: String,
            enum: {
                values: Object.values(DOCUMENT_STATUS),
                message: 'Invalid document status: {VALUE}'
            },
            default: DOCUMENT_STATUS.PENDING,
            index: true
        },
        uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        uploadedAt: {
            type: Date,
            default: null
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
        reviewNotes: {
            type: String,
            trim: true,
            maxlength: [1000, 'Review notes cannot exceed 1000 characters'],
            default: null
        }
    },
    { timestamps: true }
);

// ============================================
// INDEXES
// ============================================
documentSchema.index({ taskId: 1, status: 1 });

// ============================================
// VIRTUALS
// ============================================
documentSchema.virtual('isUploaded').get(function () {
    return this.filePath !== null;
});

documentSchema.virtual('isVerified').get(function () {
    return this.status === DOCUMENT_STATUS.VERIFIED;
});

// ============================================
// INSTANCE METHODS
// ============================================
documentSchema.methods.upload = function (userId, filePath) {
    if (this.status !== DOCUMENT_STATUS.PENDING && this.status !== DOCUMENT_STATUS.UPLOADED) {
        throw new Error(`Cannot upload to a document with status: ${this.status}`);
    }
    this.filePath = filePath;
    this.uploadedBy = userId;
    this.uploadedAt = new Date();
    this.status = DOCUMENT_STATUS.UPLOADED;
    this.reviewedBy = null;
    this.reviewedAt = null;
    this.reviewNotes = null;
    return this.save();
};

documentSchema.methods.review = function (userId, newStatus, notes = null) {
    if (this.status !== DOCUMENT_STATUS.UPLOADED) {
        throw new Error(`Cannot review a document with status: ${this.status}`);
    }
    if (![DOCUMENT_STATUS.VERIFIED, DOCUMENT_STATUS.REJECTED].includes(newStatus)) {
        throw new Error('Review status must be VERIFIED or REJECTED.');
    }
    if (newStatus === DOCUMENT_STATUS.REJECTED && !notes) {
        throw new Error('Rejection requires notes.');
    }

    this.status = newStatus;
    this.reviewedBy = userId;
    this.reviewedAt = new Date();
    this.reviewNotes = notes;
    return this.save();
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
