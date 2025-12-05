// src/models/Profiles/StudentProfile.model.ts
import mongoose, { Schema } from 'mongoose';

const StudentSchema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },

    dateOfBirth: Date,
    nationality: String,
    passportNumber: String,
    passportExpiry: Date,
    address: String,
    city: String,
    country: String,

    educationLevel: {
        type: String,
        enum: ['high_school', 'bachelors', 'masters', 'phd', 'other']
    },

    currentInstitution: String,
    graduationYear: {
        type: Number,
        min: [1950, "Graduation year must be after 1950"],
        max: new Date().getFullYear() + 10,
        required: false
    },

    gpa: {
        type: number,
        min: 0.0,
        max: 4.0,
    },

    englishProficiency: {
        type: String,
        enum: ['ielts', 'toefl', 'pte', 'duolingo', 'none']
    },

    englishScore: String,
    englishTestDate: Date,

    targetCountry: String,
    targetUniversity: String,
    targetCourse: String,
    intakePreference: {
        type: String,
        enum: ['spring', 'fall', 'summer', 'winter', 'flexible']
    },
    budget: {
        type: Schema.Types.Decimal128,
        required: true,
        min: [0, 'Budget cannot be negative']
    },

    applicationStatus: {
        type: String,
        enum: ['potential_client', 'lead', 'active', 'completed', 'cancelled'],
        default: 'lead'
    },




}, { timestamps: true });



const Student = mongoose.model('Student', StudentSchema);
export default Student;

StudentSchema.index({ userId: 1 });
