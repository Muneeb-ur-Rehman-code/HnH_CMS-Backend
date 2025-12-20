import mongoose from 'mongoose';
import { ENGLISH_TEST } from './enums.mjs';

const { Schema } = mongoose;

export const addressSchema = new Schema(
    {
        street: { type: String, trim: true, maxlength: [200, 'Street address cannot exceed 200 characters'], default: null },
        city: { type: String, trim: true, maxlength: [100, 'City cannot exceed 100 characters'], default: null },
        state: { type: String, trim: true, maxlength: [100, 'State cannot exceed 100 characters'], default: null },
        postalCode: { type: String, trim: true, match: [/^\d{5}$/, 'Postal code must be exactly 5 digits.'], maxlength: [5, 'Postal code cannot exceed 5 characters'], minlength: [5, 'Postal code cannot e less than 5 characters'], default: null },
        country: { type: String, trim: true, maxlength: [100, 'Country cannot exceed 100 characters'], default: null }
    },
    { _id: false }
);

export const englishProficiencySchema = new Schema(
    {
        testType: {
            type: String,
            enum: {
                values: Object.values(ENGLISH_TEST),
                message: 'Invalid English test type: {VALUE}'
            },
            default: ENGLISH_TEST.NONE
        },
        overallScore: { type: Number, min: [0, 'Score cannot be negative'], max: [200, 'Score cannot exceed 200'], default: null },
        testDate: { type: Date, default: null }
    },
    { _id: false }
);

export default {
    addressSchema,
    englishProficiencySchema
};
