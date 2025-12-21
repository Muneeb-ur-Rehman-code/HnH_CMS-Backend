// models/Process/Process.mjs
import mongoose from 'mongoose';
import { USER_ROLE } from '../Users/_UsersMain.mjs';
import { PROCESS_STATUS, INTAKE_PREFERENCE, CURRENCY, INITIAL_TYPE, EDUCATION_LEVEL } from '../../config/enums.mjs';
import { addressSchema, englishProficiencySchema } from '../../config/schemas.mjs';

const { Schema, model } = mongoose;

// SUB-SCHEMAS
const budgetSchema = new Schema({
    amount: { type: Number, min: [0, 'Budget amount cannot be negative'], default: null },
    currency: { type: String, enum: { values: Object.values(CURRENCY), message: 'Invalid currency: {VALUE}' }, default: CURRENCY.USD }
}, { _id: false });

const statusHistorySchema = new Schema({
    status: { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
}, { _id: false });

// MAIN SCHEMA
const processSchema = new Schema({
    studentId: { type: Schema.Types.ObjectId, ref: 'StudentProfile', required: true, index: true },
    initialId: { type: Schema.Types.ObjectId, ref: 'Initial', required: true, unique: true, index: true },
    consultantId: { type: Schema.Types.ObjectId, ref: 'StaffProfile', required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'StaffProfile', default: null, index: true },

    // Applicant fields (copied from Initial at creation)
    applicantFirstName: { type: String, required: true, trim: true },
    applicantLastName: { type: String, required: true, trim: true },
    applicantEmail: { type: String, required: true, trim: true },
    applicantPhone: { type: String, required: true, trim: true },
    applicantDob: { type: Date, default: null },
    applicantGender: { type: String, default: null },

    // Copied from Student profile at creation (snapshot)
    nationality: { type: String, trim: true, maxlength: [100, 'Nationality cannot exceed 100 characters'], default: null },
    passportNumber: { type: String, trim: true, uppercase: true, default: null },
    passportExpiry: { type: Date, default: null },
    address: { type: addressSchema, default: () => ({}) },
    educationLevel: { type: String, enum: { values: Object.values(EDUCATION_LEVEL), message: 'Invalid education level: {VALUE}' }, default: null },
    currentInstitution: { type: String, trim: true, maxlength: [200, 'Institution name cannot exceed 200 characters'], default: null },
    graduationYear: { type: Number, min: [1950, 'Graduation year cannot be before 1950'], max: [new Date().getFullYear() + 10, 'Graduation year cannot be more than 10 years in future'], default: null },
    lastGpa: { type: Number, min: [0.0, 'GPA cannot be negative'], max: [4.0, 'GPA cannot exceed 4.0'], default: null },
    englishProficiency: { type: englishProficiencySchema, default: () => ({}) },

    targetCourse: { type: String, trim: true, maxlength: [200, 'Target course cannot exceed 200 characters'], default: null },
    intakePreference: { type: String, enum: { values: Object.values(INTAKE_PREFERENCE), message: 'Invalid intake preference: {VALUE}' }, default: INTAKE_PREFERENCE.FLEXIBLE },
    intakeYear: { type: Number, min: [new Date().getFullYear() - 1, 'Intake year cannot be too far in the past'], max: [new Date().getFullYear() + 5, 'Intake year cannot be more than 5 years ahead'], default: () => new Date().getFullYear() },
    budget: { type: budgetSchema, default: () => ({}) },

    status: { type: String, enum: { values: Object.values(PROCESS_STATUS), message: 'Invalid application status: {VALUE}' }, default: PROCESS_STATUS.GATHERING_INFO, index: true },
    statusHistory: [statusHistorySchema],

    reason: { type: String, trim: true, maxlength: [500, 'Reason cannot exceed 500 characters'], default: null },
}, { timestamps: true });



// INDEXES
processSchema.index({ studentId: 1, status: 1 });
processSchema.index({ consultantId: 1, status: 1 });
processSchema.index({ createdAt: -1 });

// VIRTUALS
processSchema.virtual('initial', { ref: 'Initial', localField: 'initialId', foreignField: '_id', justOne: true });
processSchema.virtual('student', { ref: 'StudentProfile', localField: 'studentId', foreignField: '_id', justOne: true });
processSchema.virtual('consultant', { ref: 'StaffProfile', localField: 'consultantId', foreignField: '_id', justOne: true });
processSchema.virtual('invoices', { ref: 'Invoice', localField: '_id', foreignField: 'processId' });
processSchema.virtual('documents', { ref: 'Document', localField: '_id', foreignField: 'processId' });
processSchema.virtual('tasks', { ref: 'Task', localField: '_id', foreignField: 'processId' });

// INSTANCE METHODS
// models/Process/Process.mjs
processSchema.methods.updateStatus = function (newStatus, userId) {
    if (!Object.values(PROCESS_STATUS).includes(newStatus)) throw { status: 400, message: 'Invalid status', code: 'ENUM_ERROR' };
    this.statusHistory.push({ status: newStatus, changedBy: userId, changedAt: Date.now() });
    this.status = newStatus;
    return this.save();
};

// JSON TRANSFORM
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

// EXPORT
const Process = model('Process', processSchema);
export default Process;
