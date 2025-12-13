// models/Invoice/Invoice.mjs
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ============================================
// ENUMS
// ============================================
export const INVOICE_STATUS = Object.freeze({
    PENDING: 'PENDING',               // Just created, awaiting accountant action
    STUDENT_CONTACTED: 'STUDENT_CONTACTED',  // Accountant has contacted student
    PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',    // Payment info recorded by student/accountant
    APPROVED: 'APPROVED',             // Payment verified and approved
    REJECTED: 'REJECTED',             // Payment rejected by accountant
    CANCELLED: 'CANCELLED'            // Invoice cancelled
});

export const INVOICE_PAYMENT_TYPE = Object.freeze({
    DIRECT: 'DIRECT',       // Student pays directly to consultancy
    UNIVERSITY: 'UNIVERSITY' // Payment goes through university
});

export const PAYMENT_METHOD = Object.freeze({
    CASH: 'CASH',
    ONLINE: 'ONLINE'
});

export const CURRENCY = Object.freeze({
    USD: 'USD', EUR: 'EUR', GBP: 'GBP', PKR: 'PKR', AED: 'AED', SAR: 'SAR', QAR: 'QAR', KWD: 'KWD', BHD: 'BHD', OMR: 'OMR', AUD: 'AUD', CAD: 'CAD'
});

// ============================================
// SUB-SCHEMAS
// ============================================

const breakdownItemSchema = new Schema({
    description: { type: String, required: [true, 'Breakdown description is required'], trim: true, maxlength: [200, 'Description cannot exceed 200 characters'] },
    amount: { type: Number, required: [true, 'Breakdown amount is required'], min: [0, 'Amount cannot be negative'] }
}, { _id: false });

const paymentTrackingSchema = new Schema({
    paymentMethod: { type: String, enum: { values: Object.values(PAYMENT_METHOD), message: 'Invalid payment method: {VALUE}' }, required: true },
    transactionId: { type: String, trim: true, default: null },
    filePath: { type: String, trim: true, default: null }, // Path to receipt/screenshot
    recordedAt: { type: Date, default: Date.now },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { _id: false });

// ============================================
// MAIN SCHEMA DEFINITION
// ============================================
const invoiceSchema = new Schema({
    processId: { type: Schema.Types.ObjectId, ref: 'Process', required: true, index: true },
    accountantId: { type: Schema.Types.ObjectId, ref: 'StaffProfile', default: null, index: true },
    paymentType: { type: String, enum: { values: Object.values(INVOICE_PAYMENT_TYPE), message: 'Invalid payment type: {VALUE}' }, required: true, index: true },
    amount: { type: Number, required: [true, 'Amount is required'], min: [0, 'Amount cannot be negative'] },
    currency: { type: String, enum: { values: Object.values(CURRENCY), message: 'Invalid currency: {VALUE}' }, required: true, default: CURRENCY.USD },
    breakdown: {
        type: [breakdownItemSchema],
        default: [],
        validate: {
            validator: function (items) {
                if (items.length === 0) return true;
                const total = items.reduce((sum, item) => sum + item.amount, 0);
                return Math.abs(total - this.amount) < 0.01;
            },
            message: 'Breakdown total must equal invoice amount'
        }
    },
    status: { type: String, enum: { values: Object.values(INVOICE_STATUS), message: 'Invalid invoice status: {VALUE}' }, default: INVOICE_STATUS.PENDING, index: true },
    paymentTracking: { type: paymentTrackingSchema, default: null },
    issuedAt: { type: Date, default: Date.now, required: true },
    dueDate: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewReason: { type: String, trim: true, maxlength: [500, 'Review reason cannot exceed 500 characters'], default: null },
    notes: { type: String, trim: true, maxlength: [1000, 'Notes cannot exceed 1000 characters'], default: null },
}, { timestamps: true });

// ============================================
// INDEXES
// ============================================
invoiceSchema.index({ processId: 1, status: 1 });
invoiceSchema.index({ accountantId: 1, status: 1 });
invoiceSchema.index({ issuedAt: -1 });

// ============================================
// VIRTUALS
// ============================================
invoiceSchema.virtual('isApproved').get(function () { return this.status === INVOICE_STATUS.APPROVED; });
invoiceSchema.virtual('isCancelled').get(function () { return this.status === INVOICE_STATUS.CANCELLED; });
invoiceSchema.virtual('isPaid').get(function () { return this.paymentTracking !== null; });
invoiceSchema.virtual('isOverdue').get(function () {
    if (!this.dueDate || this.isApproved || this.isCancelled) return false;
    return new Date() > this.dueDate;
});

// ============================================
// INSTANCE METHODS
// ============================================

const editableStatuses = [INVOICE_STATUS.PENDING, INVOICE_STATUS.STUDENT_CONTACTED, INVOICE_STATUS.PAYMENT_RECEIVED, INVOICE_STATUS.REJECTED];

invoiceSchema.methods.updateStatus = function (newStatus, user, reason = null) {
    if (!Object.values(INVOICE_STATUS).includes(newStatus)) {
        throw new Error(`Invalid status: ${newStatus}`);
    }
    if (!editableStatuses.includes(this.status)) {
        throw new Error(`Cannot change status of an invoice that is already ${this.status}.`);
    }

    // Validation for approving
    if (newStatus === INVOICE_STATUS.APPROVED) {
        if (this.paymentType === INVOICE_PAYMENT_TYPE.DIRECT && !this.paymentTracking) {
            throw new Error('Payment must be recorded before approving a DIRECT invoice.');
        }
        const payment = this.paymentTracking;
        if (payment && payment.paymentMethod === PAYMENT_METHOD.ONLINE && (!payment.transactionId || !payment.filePath)) {
            throw new Error('Online payments require a Transaction ID and a receipt file before approval.');
        }
    }

    this.status = newStatus;
    if (newStatus === INVOICE_STATUS.APPROVED || newStatus === INVOICE_STATUS.CANCELLED || newStatus === INVOICE_STATUS.REJECTED) {
        this.reviewedAt = new Date();
        this.reviewedBy = user._id;
        if (reason) {
            this.reviewReason = reason;
        }
    }
    return this.save();
};

invoiceSchema.methods.recordPayment = function (user, paymentInfo) {
    if (!editableStatuses.includes(this.status)) {
        throw new Error(`Cannot record payment for an invoice with status ${this.status}.`);
    }
    const { paymentMethod, transactionId, filePath } = paymentInfo;
    if (!paymentMethod) throw new Error('Payment method is required.');
    if (paymentMethod === PAYMENT_METHOD.ONLINE && (!transactionId || !filePath)) {
        throw new Error('Online payments require a Transaction ID and a receipt file path.');
    }

    this.paymentTracking = {
        paymentMethod,
        transactionId: transactionId || null,
        filePath: filePath || null,
        recordedAt: new Date(),
        recordedBy: user._id,
    };
    this.status = INVOICE_STATUS.PAYMENT_RECEIVED;
    return this.save();
};

// ============================================
// JSON TRANSFORM
// ============================================
invoiceSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

invoiceSchema.set('toObject', { virtuals: true });

// ============================================
// EXPORT
// ============================================
const Invoice = model('Invoice', invoiceSchema);
export default Invoice;
