// models/Docx/Document.mjs
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ============================================
// ENUMS
// ============================================

export const DOCUMENT_STATUS = Object.freeze({
    PENDING: 'PENDING',           // Requested but not uploaded
    UPLOADED: 'UPLOADED',         // Uploaded, awaiting verification
    VERIFIED: 'VERIFIED',         // Verified and accepted
    REJECTED: 'REJECTED',         // Rejected, needs re-upload

    CANCELLED: 'CANCELLED',       // Declined due to process cancellation'
    WITHDRAWN: 'WITHDRAWN'          // Declined due to process cancellation/refund
});

// ============================================
// SCHEMA DEFINITION
// ============================================
const documentSchema = new Schema(
    {
        processId: {
            type: Schema.Types.ObjectId,
            ref: 'Process',
            required: true,
            index: true
        },
        // documentType is now a free-form string
        documentType: {
            type: String,
            required: true,
            trim: true,
            maxlength: [200, 'Document type cannot exceed 200 characters'],
            index: true
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, 'Description cannot exceed 500 characters'],
            default: null
        },
        visibleToStudent: {
            type: Boolean,
            default: true
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
documentSchema.index({ processId: 1, status: 1 });

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
