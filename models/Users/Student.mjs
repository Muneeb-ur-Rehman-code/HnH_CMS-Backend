// models/StudentProfile.mjs
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ============================================
// ENUMS
// ============================================
export const GENDER = Object.freeze({
    MALE: 'MALE',
    FEMALE: 'FEMALE',
    OTHER: 'OTHER',
    PREFER_NOT_TO_SAY: 'PREFER_NOT_TO_SAY'
});

export const EDUCATION_LEVEL = Object.freeze({
    HIGH_SCHOOL: 'HIGH_SCHOOL',
    DIPLOMA: 'DIPLOMA',
    BACHELORS: 'BACHELORS',
    MASTERS: 'MASTERS',
    PHD: 'PHD',
    OTHER: 'OTHER'
});

export const ENGLISH_TEST = Object.freeze({
    IELTS: 'IELTS',
    TOEFL: 'TOEFL',
    PTE: 'PTE',
    DUOLINGO: 'DUOLINGO',
    CAMBRIDGE: 'CAMBRIDGE',
    OTHER: 'OTHER',
});

// ============================================
// SUB-SCHEMAS
// ============================================
const addressSchema = new Schema(
    {
        street: {
            type: String,
            trim: true,
            maxlength: [200, 'Street address cannot exceed 200 characters'],
            default: null
        },
        city: {
            type: String,
            trim: true,
            maxlength: [100, 'City cannot exceed 100 characters'],
            default: null
        },
        state: {
            type: String,
            trim: true,
            maxlength: [100, 'State cannot exceed 100 characters'],
            default: null
        }, postalCode: {
            type: String,
            trim: true,
            match: [/^\d{5}$/, 'Postal code must be exactly 5 digits.'],
            maxlength: [5, 'Postal code cannot exceed 5 characters'],
            minlength: [5, 'Postal code cannot e less than 5 characters'],
            default: null
        },
        country: {
            type: String,
            trim: true,
            maxlength: [100, 'Country cannot exceed 100 characters'],
            default: null
        }
    },
    { _id: false }
);

const englishProficiencySchema = new Schema(
    {
        testType: {
            type: String,
            enum: {
                values: Object.values(ENGLISH_TEST),
                message: 'Invalid English test type: {VALUE} go for IELTS TOEFL PTE DUOLINGO CAMBRIDGE OTHER'
            },
            default: ENGLISH_TEST.NONE
        },
        overallScore: {
            type: Number,
            min: [0, 'Score cannot be negative'],
            max: [200, 'Score cannot exceed 200'],
            default: null
        },
        testDate: {
            type: Date,
            default: null
        }
    },
    { _id: false }
);

// ============================================
// MAIN SCHEMA
// ============================================
const studentProfileSchema = new Schema(
    {
        // ---- Link to User ----
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            unique: true,
            index: true
        },

        // ---- Personal Info ----
        nationality: {
            type: String,
            trim: true,
            maxlength: [100, 'Nationality cannot exceed 100 characters'],
            default: null
        },

        // ---- Passport Info ----
        passportNumber: {
            type: String,
            trim: true,
            uppercase: true,
            default: null,
            validate: {
                validator: function (value) {
                    if (!value) return true;
                    // Alphanumeric, 6-20 characters
                    return /^[A-Z0-9]{6,20}$/.test(value);
                },
                message: 'Passport number must be 6-20 alphanumeric characters'
            }
        },

        passportExpiry: {
            type: Date,
            default: null,
            validate: {
                validator: function (value) {
                    if (!value) return true;
                    // Must be in the future
                    return value > new Date();
                },
                message: 'Passport expiry must be a future date'
            }
        },

        // ---- Address ----
        address: {
            type: addressSchema,
            default: () => ({})
        },

        // ---- Education ----
        educationLevel: {
            type: String,
            enum: {
                values: Object.values(EDUCATION_LEVEL),
                message: 'Invalid education level: {VALUE}'
            },
            default: null
        },

        currentInstitution: {
            type: String,
            trim: true,
            maxlength: [200, 'Institution name cannot exceed 200 characters'],
            default: null
        },

        graduationYear: {
            type: Number,
            min: [1950, 'Graduation year cannot be before 1950'],
            max: [new Date().getFullYear() + 10, 'Graduation year cannot be more than 10 years in future'],
            default: null,
            validate: {
                validator: function (value) {
                    if (!value) return true;
                    return Number.isInteger(value);
                },
                message: 'Graduation year must be a whole number'
            }
        },

        lastGpa: {
            type: Number,
            min: [0.0, 'GPA cannot be negative'],
            max: [4.0, 'GPA cannot exceed 4.0'],
            default: null
        },

        // ---- English Proficiency ----
        englishProficiency: {
            type: englishProficiencySchema,
            default: () => ({})
        }


    },
    {
        timestamps: true
    }
);

// ============================================
// INDEXES
// ============================================
studentProfileSchema.index({ passportNumber: 1 }, { sparse: true });
studentProfileSchema.index({ nationality: 1 });

// ============================================
// VIRTUALS
// ============================================
studentProfileSchema.virtual('isPassportExpired').get(function () {
    if (!this.passportExpiry) return null;
    return this.passportExpiry < new Date();
});

studentProfileSchema.virtual('isPassportExpiringSoon').get(function () {
    if (!this.passportExpiry) return null;
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    return this.passportExpiry < sixMonthsFromNow && this.passportExpiry > new Date();
});

studentProfileSchema.virtual('hasCompleteAddress').get(function () {
    return !!(
        this.address?.street &&
        this.address?.city &&
        this.address?.country
    );
});

studentProfileSchema.virtual('user', {
    ref: 'User',
    localField: 'userId',
    foreignField: '_id',
    justOne: true
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Update passport info
 * @param {string} passportNumber
 * @param {Date} passportExpiry
 * @returns {Promise<StudentProfile>}
 */
studentProfileSchema.methods.updatePassport = function (passportNumber, passportExpiry) {
    if (passportNumber) {
        this.passportNumber = passportNumber;
    }
    if (passportExpiry) {
        this.passportExpiry = passportExpiry;
    }
    return this.save();
};

/**
 * Update address
 * @param {Object} addressData
 * @returns {Promise<StudentProfile>}
 */
studentProfileSchema.methods.updateAddress = function (addressData) {
    const { street, city, state, postalCode, country } = addressData;

    if (street !== undefined) this.address.street = street;
    if (city !== undefined) this.address.city = city;
    if (state !== undefined) this.address.state = state;
    if (postalCode !== undefined) this.address.postalCode = postalCode;
    if (country !== undefined) this.address.country = country;

    return this.save();
};

/**
 * Update education info
 * @param {Object} educationData
 * @returns {Promise<StudentProfile>}
 */
studentProfileSchema.methods.updateEducation = function (educationData) {
    const { educationLevel, currentInstitution, graduationYear, lastGpa } = educationData;

    if (educationLevel !== undefined) this.educationLevel = educationLevel;
    if (currentInstitution !== undefined) this.currentInstitution = currentInstitution;
    if (graduationYear !== undefined) this.graduationYear = graduationYear;
    if (lastGpa !== undefined) this.lastGpa = lastGpa;

    return this.save();
};

/**
 * Update English proficiency
 * @param {Object} proficiencyData
 * @returns {Promise<StudentProfile>}
 */
studentProfileSchema.methods.updateEnglishProficiency = function (proficiencyData) {
    const { testType, overallScore, testDate } = proficiencyData;

    if (testType !== undefined) this.englishProficiency.testType = testType;
    if (overallScore !== undefined) this.englishProficiency.overallScore = overallScore;
    if (testDate !== undefined) this.englishProficiency.testDate = testDate;

    return this.save();
};

/**
 * Get profile completion percentage
 * @returns {number}
 */
studentProfileSchema.methods.getCompletionPercentage = function () {
    const fields = [
        this.nationality,
        this.passportNumber,
        this.passportExpiry,
        this.address?.street,
        this.address?.city,
        this.address?.country,
        this.educationLevel,
        this.currentInstitution,
        this.graduationYear,
        this.lastGpa,
        this.englishProficiency?.testType && this.englishProficiency.testType !== ENGLISH_TEST.NONE
    ];

    const filledFields = fields.filter(Boolean).length;
    return Math.round((filledFields / fields.length) * 100);
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Find profile by user ID
 * @param {ObjectId} userId
 * @returns {Promise<StudentProfile>}
 */
studentProfileSchema.statics.findByUserId = function (userId) {
    return this.findOne({ userId }).populate('user');
};

/**
 * Find by passport number
 * @param {string} passportNumber
 * @returns {Promise<StudentProfile>}
 */
studentProfileSchema.statics.findByPassport = function (passportNumber) {
    return this.findOne({ passportNumber: passportNumber.toUpperCase() }).populate('user');
};

/**
 * Find profiles with expiring passports
 * @param {number} months - Months until expiry
 * @returns {Promise<StudentProfile[]>}
 */
studentProfileSchema.statics.findExpiringPassports = function (months = 6) {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + months);

    return this.find({
        passportExpiry: {
            $lte: futureDate,
            $gt: new Date()
        }
    }).populate('user');
};

/**
 * Find profiles by nationality
 * @param {string} nationality
 * @returns {Promise<StudentProfile[]>}
 */
studentProfileSchema.statics.findByNationality = function (nationality) {
    return this.find({ nationality }).populate('user');
};

/**
 * Create or update profile for user
 * @param {ObjectId} userId
 * @param {Object} profileData
 * @returns {Promise<StudentProfile>}
 */
studentProfileSchema.statics.createOrUpdate = async function (userId, profileData) {
    const existing = await this.findOne({ userId });

    if (existing) {
        Object.assign(existing, profileData);
        return existing.save();
    }

    return this.create({ userId, ...profileData });
};

// ============================================
// JSON TRANSFORM
// ============================================
studentProfileSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

studentProfileSchema.set('toObject', { virtuals: true });

// ============================================
// EXPORT
// ============================================
const StudentProfile = model('StudentProfile', studentProfileSchema);
export default StudentProfile;