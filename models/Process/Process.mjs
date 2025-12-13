// models/Process/Process.mjs
import mongoose from 'mongoose';
import { USER_ROLE } from '../Users/_UsersMain.mjs';

const { Schema, model } = mongoose;

// ============================================
// ENUMS
// ============================================
export const PROCESS_STATUS = Object.freeze({
    GATHERING_INFO: 'GATHERING_INFO',
    INFO_COMPLETE: 'INFO_COMPLETE',
    INVOICE_PENDING: 'INVOICE_PENDING',
    INVOICE_COMPLETE: 'INVOICE_COMPLETE',
    DOCUMENTS_PENDING: 'DOCUMENTS_PENDING',
    DOCUMENTS_PROCESSING: 'DOCUMENTS_PROCESSING',
    DOCUMENTS_COMPLETE: 'DOCUMENTS_COMPLETE',
    ADMISSION_PENDING: 'ADMISSION_PENDING',
    ADMISSION_PROCESSING: 'ADMISSION_PROCESSING',
    ADMISSION_COMPLETE: 'ADMISSION_COMPLETE',
    VISA_PENDING: 'VISA_PENDING',
    VISA_PROCESSING: 'VISA_PROCESSING',
    VISA_COMPLETE: 'VISA_COMPLETE',
    SUBMITTED: 'SUBMITTED',
    DONE: 'DONE',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
    REFUND_PENDING: 'REFUND_PENDING',
    REFUND_PROCESSING: 'REFUND_PROCESSING',
    REFUND_APPROVED: 'REFUND_APPROVED',
    REFUND_REJECTED: 'REFUND_REJECTED',
    REFUND_COMPLETED: 'REFUND_COMPLETED',
    DECLINED: 'DECLINED'
});

export const INTAKE_PREFERENCE = Object.freeze({
    SPRING: 'SPRING',
    SUMMER: 'SUMMER',
    FALL: 'FALL',
    WINTER: 'WINTER',
    FLEXIBLE: 'FLEXIBLE'
});

export const CURRENCY = Object.freeze({
    USD: 'USD', EUR: 'EUR', GBP: 'GBP', PKR: 'PKR', AED: 'AED', SAR: 'SAR', QAR: 'QAR', KWD: 'KWD', BHD: 'BHD', OMR: 'OMR', AUD: 'AUD', CAD: 'CAD'
});

// ============================================
// SUB-SCHEMAS
// ============================================
const budgetSchema = new Schema({
    amount: { type: Number, min: [0, 'Budget amount cannot be negative'], default: null },
    currency: { type: String, enum: { values: Object.values(CURRENCY), message: 'Invalid currency: {VALUE}' }, default: CURRENCY.USD }
}, { _id: false });

const applicantDataSchema = new Schema({
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    dob: { type: Date, default: null },
    gender: { type: String, default: null },
    nationality: { type: String, default: null },
    passportNumber: { type: String, default: null },
    passportExpiry: { type: Date, default: null },
    address: {
        street: { type: String, default: null },
        city: { type: String, default: null },
        state: { type: String, default: null },
        postalCode: { type: String, default: null },
        country: { type: String, default: null }
    },
    educationLevel: { type: String, default: null },
    currentInstitution: { type: String, default: null },
    graduationYear: { type: Number, default: null },
    lastGpa: { type: Number, default: null },
    englishProficiency: {
        testType: { type: String, default: null },
        overallScore: { type: Number, default: null },
        testDate: { type: Date, default: null }
    }
}, { _id: false });

const statusHistorySchema = new Schema({
    status: { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true, maxlength: 1000, default: null }
}, { _id: false });

// ============================================
// MAIN SCHEMA
// ============================================
const processSchema = new Schema({
    studentId: { type: Schema.Types.ObjectId, ref: 'StudentProfile', required: true, index: true },
    initialId: { type: Schema.Types.ObjectId, ref: 'Initial', required: true, unique: true, index: true },
    consultantId: { type: Schema.Types.ObjectId, ref: 'StaffProfile', required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'StaffProfile', default: null, index: true },

    applicantData: { type: applicantDataSchema, required: true },

    targetCourse: { type: String, trim: true, maxlength: [200, 'Target course cannot exceed 200 characters'], default: null },
    intakePreference: { type: String, enum: { values: Object.values(INTAKE_PREFERENCE), message: 'Invalid intake preference: {VALUE}' }, default: INTAKE_PREFERENCE.FLEXIBLE },
    intakeYear: { type: Number, min: [new Date().getFullYear() - 1, 'Intake year cannot be too far in the past'], max: [new Date().getFullYear() + 5, 'Intake year cannot be more than 5 years ahead'], default: () => new Date().getFullYear() },
    budget: { type: budgetSchema, default: () => ({}) },

    status: { type: String, enum: { values: Object.values(PROCESS_STATUS), message: 'Invalid application status: {VALUE}' }, default: PROCESS_STATUS.GATHERING_INFO, index: true },
    statusHistory: [statusHistorySchema],

    reason: { type: String, trim: true, maxlength: [500, 'Reason cannot exceed 500 characters'], default: null },
}, { timestamps: true });

// ============================================
// INDEXES
// ============================================
processSchema.index({ studentId: 1, status: 1 });
processSchema.index({ consultantId: 1, status: 1 });
processSchema.index({ createdAt: -1 });

// ============================================
// VIRTUALS
// ============================================
processSchema.virtual('initial', { ref: 'Initial', localField: 'initialId', foreignField: '_id', justOne: true });
processSchema.virtual('student', { ref: 'StudentProfile', localField: 'studentId', foreignField: '_id', justOne: true });
processSchema.virtual('consultant', { ref: 'StaffProfile', localField: 'consultantId', foreignField: '_id', justOne: true });
processSchema.virtual('invoices', { ref: 'Invoice', localField: '_id', foreignField: 'processId' });
processSchema.virtual('documents', { ref: 'Document', localField: '_id', foreignField: 'processId' });
processSchema.virtual('tasks', { ref: 'Task', localField: '_id', foreignField: 'processId' });

// ============================================
// INSTANCE METHODS
// ============================================

const consultantTransitions = {
    [PROCESS_STATUS.GATHERING_INFO]: [PROCESS_STATUS.INFO_COMPLETE, PROCESS_STATUS.REJECTED],
    [PROCESS_STATUS.INFO_COMPLETE]: [PROCESS_STATUS.INVOICE_PENDING, PROCESS_STATUS.REJECTED],
    [PROCESS_STATUS.INVOICE_PENDING]: [PROCESS_STATUS.INVOICE_COMPLETE, PROCESS_STATUS.REJECTED],
    [PROCESS_STATUS.INVOICE_COMPLETE]: [PROCESS_STATUS.INVOICE_PENDING, PROCESS_STATUS.DOCUMENTS_PENDING, PROCESS_STATUS.ADMISSION_PENDING, PROCESS_STATUS.VISA_PENDING, PROCESS_STATUS.REJECTED],
    [PROCESS_STATUS.DOCUMENTS_PENDING]: [PROCESS_STATUS.DOCUMENTS_PROCESSING, PROCESS_STATUS.REJECTED],
    [PROCESS_STATUS.DOCUMENTS_PROCESSING]: [PROCESS_STATUS.DOCUMENTS_COMPLETE, PROCESS_STATUS.REJECTED],
    [PROCESS_STATUS.DOCUMENTS_COMPLETE]: [PROCESS_STATUS.DOCUMENTS_PENDING, PROCESS_STATUS.ADMISSION_PENDING, PROCESS_STATUS.VISA_PENDING, PROCESS_STATUS.SUBMITTED, PROCESS_STATUS.REJECTED],
    [PROCESS_STATUS.ADMISSION_PENDING]: [PROCESS_STATUS.ADMISSION_PROCESSING, PROCESS_STATUS.REJECTED],
    [PROCESS_STATUS.ADMISSION_PROCESSING]: [PROCESS_STATUS.ADMISSION_COMPLETE, PROCESS_STATUS.REJECTED],
    [PROCESS_STATUS.ADMISSION_COMPLETE]: [PROCESS_STATUS.VISA_PENDING, PROCESS_STATUS.SUBMITTED, PROCESS_STATUS.REJECTED],
    [PROCESS_STATUS.VISA_PENDING]: [PROCESS_STATUS.VISA_PROCESSING, PROCESS_STATUS.REJECTED],
    [PROCESS_STATUS.VISA_PROCESSING]: [PROCESS_STATUS.VISA_COMPLETE, PROCESS_STATUS.REJECTED],
    [PROCESS_STATUS.VISA_COMPLETE]: [PROCESS_STATUS.ADMISSION_PENDING, PROCESS_STATUS.SUBMITTED, PROCESS_STATUS.REJECTED],
    [PROCESS_STATUS.SUBMITTED]: [PROCESS_STATUS.DONE, PROCESS_STATUS.REJECTED],
    [PROCESS_STATUS.REFUND_PENDING]: [PROCESS_STATUS.REFUND_PROCESSING],
    [PROCESS_STATUS.REFUND_PROCESSING]: [PROCESS_STATUS.REFUND_APPROVED, PROCESS_STATUS.REFUND_REJECTED],
    [PROCESS_STATUS.REFUND_APPROVED]: [PROCESS_STATUS.REFUND_COMPLETED],
};

processSchema.methods.updateStatus = async function (newStatus, user, notes = null) {
    if (!Object.values(PROCESS_STATUS).includes(newStatus)) {
        throw new Error(`Invalid status: ${newStatus}`);
    }

    const currentStatus = this.status;
    const isStudent = user.role === USER_ROLE.STUDENT;
    const isConsultant = user.role === USER_ROLE.STAFF;

    const terminalStates = [PROCESS_STATUS.DONE, PROCESS_STATUS.REJECTED, PROCESS_STATUS.CANCELLED, PROCESS_STATUS.REFUND_COMPLETED, PROCESS_STATUS.REFUND_REJECTED];
    if (terminalStates.includes(currentStatus)) {
        throw new Error(`Cannot change status from a terminal state: ${currentStatus}`);
    }

    let isValidTransition = false;

    if (isStudent) {
        if (newStatus === PROCESS_STATUS.CANCELLED) {
            const wasInvoiceCompleted = this.statusHistory.some(h => h.status === PROCESS_STATUS.INVOICE_COMPLETE);
            if (wasInvoiceCompleted) {
                throw new Error('Cannot cancel after an invoice is completed. Please request a refund instead.');
            }
            isValidTransition = true;
        } else if (newStatus === PROCESS_STATUS.REFUND_PENDING) {
            const wasInvoiceCompleted = this.statusHistory.some(h => h.status === PROCESS_STATUS.INVOICE_COMPLETE);
            if (!wasInvoiceCompleted) {
                throw new Error('Cannot request a refund before an invoice has been completed.');
            }
            isValidTransition = true;
        }
    } else if (isConsultant) {
        const allowed = consultantTransitions[currentStatus];
        if (allowed && allowed.includes(newStatus)) {
            isValidTransition = true;
        }
    }

    if (!isValidTransition) {
        throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus} for user role ${user.role}`);
    }

    if ((newStatus === PROCESS_STATUS.REJECTED || newStatus === PROCESS_STATUS.CANCELLED) && !notes) {
        throw new Error('A reason (in notes) is required for rejection or cancellation.');
    }

    this.status = newStatus;
    this.statusHistory.push({ status: newStatus, changedBy: user._id, notes });
    if (notes && (newStatus === PROCESS_STATUS.REJECTED || newStatus === PROCESS_STATUS.CANCELLED)) {
        this.reason = notes;
    }

    return this.save();
};

// ============================================
// JSON TRANSFORM
// ============================================
processSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        if (ret.initial) {
            ret.targetCountry = ret.initial.preferredCountry;
            ret.otherCountry = ret.initial.otherCountry;
            ret.targetUniversity = ret.initial.preferredUniversity;
            ret.otherUniversity = ret.initial.otherUniversity;
            ret.visaType = ret.initial.type;
            ret.initialNotes = ret.initial.notes;
            delete ret.initial;
        }
        return ret;
    }
});

processSchema.set('toObject', { virtuals: true });

// ============================================
// EXPORT
// ============================================
const Process = model('Process', processSchema);
export default Process;
