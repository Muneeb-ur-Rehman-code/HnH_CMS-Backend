// models/User.mjs
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const { Schema, model } = mongoose;

// ============================================
// ENUMS
// ============================================
export const USER_ROLE = Object.freeze({
    STUDENT: 'STUDENT',
    STAFF: 'STAFF'
});

export const USER_STATUS = Object.freeze({
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    SUSPENDED: 'SUSPENDED'
});

export const USER_SOURCE = Object.freeze({
    ONLINE: 'ONLINE',
    WALK_IN: 'WALK_IN',
    CONSULTANT: 'CONSULTANT'
});

// ============================================
// CONSTANTS
// ============================================
const OTP_CONFIG = {
    LENGTH: 6,
    EXPIRY_MINUTES: 10,
    MAX_ATTEMPTS: 5,
    COOLDOWN_MINUTES: 20
};

const PASSWORD_CONFIG = {
    MIN_LENGTH: 8,
    SALT_ROUNDS: 12
};

// ============================================
// SUB-SCHEMAS
// ============================================
const otpSchema = new Schema(
    {
        code: {
            type: String,
            default: null,
            select: false
        },
        expiresAt: {
            type: Date,
            default: null
        },
        attempts: {
            type: Number,
            default: 0
        },
        lastAttemptAt: {
            type: Date,
            default: null
        },
        lastSentAt: {
            type: Date,
            default: null
        },
        verified: {
            type: Boolean,
            default: false
        }
    },
    { _id: false }
);

const phoneSchema = new Schema(
    {
        number: {
            type: String,
            trim: true,
            default: null,
            validate: {
                validator: function (value) {
                    if (!value) return true;
                    // Format: country code + number, e.g., 923001234567
                    return /^[1-9]\d{9,14}$/.test(value);
                },
                message: 'Phone number must be in format: country code + number (e.g., 923001234567)'
            }
        },
        otp: {
            type: otpSchema,
            default: () => ({})
        }
    },
    { _id: false }
);

// ============================================
// MAIN SCHEMA
// ============================================
const userSchema = new Schema(
    {
        // ---- Core Fields ----
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            validate: {
                validator: function (value) {
                    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
                },
                message: 'Please provide a valid email address'
            },
            index: true
        },

        password: {
            type: String,
            default: null,
            select: false
        },

        // ---- Email Verification ----
        emailOtp: {
            type: otpSchema,
            default: () => ({}),
            select: false
        },

        // ---- Phone ----
        phone: {
            type: phoneSchema,
            default: () => ({})
        },

        // ---- Profile Info ----
        firstName: {
            type: String,
            trim: true,
            default: null,
            minlength: [2, 'First name must be at least 2 characters'],
            maxlength: [50, 'First name cannot exceed 50 characters'],
            validate: {
                validator: function (value) {
                    if (!value) return true;
                    return /^[a-zA-Z\s'-]+$/.test(value);
                },
                message: 'First name can only contain letters, spaces, hyphens, and apostrophes'
            }
        },

        lastName: {
            type: String,
            trim: true,
            default: null,
            minlength: [2, 'Last name must be at least 2 characters'],
            maxlength: [50, 'Last name cannot exceed 50 characters'],
            validate: {
                validator: function (value) {
                    if (!value) return true;
                    return /^[a-zA-Z\s'-]+$/.test(value);
                },
                message: 'Last name can only contain letters, spaces, hyphens, and apostrophes'
            }
        },

        dob: {
            type: Date,
            default: null,
            validate: {
                validator: function (value) {
                    if (!value) return true;
                    const now = new Date();
                    const minDate = new Date('1900-01-01');
                    const maxDate = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
                    return value >= minDate && value <= maxDate;
                },
                message: 'Date of birth must be valid and user must be at least 10 years old'
            }
        },

        gender: {
            type: String,
            enum: {
                values: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'],
                message: 'Invalid gender: {VALUE}'
            },
            default: null
        },

        // ---- Role & Source ----
        role: {
            type: String,
            enum: {
                values: Object.values(USER_ROLE),
                message: 'Invalid role: {VALUE}'
            },
            default: USER_ROLE.STUDENT,
            index: true
        },

        source: {
            type: String,
            enum: {
                values: Object.values(USER_SOURCE),
                message: 'Invalid source: {VALUE}'
            },
            default: USER_SOURCE.ONLINE
        },

        // ---- Status ----
        status: {
            type: String,
            enum: {
                values: Object.values(USER_STATUS),
                message: 'Invalid status: {VALUE}'
            },
            default: USER_STATUS.ACTIVE,
            index: true
        },

        // ---- Activity Tracking ----
        lastLoginAt: {
            type: Date,
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
userSchema.index({ email: 1, deletedAt: 1 });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ createdAt: -1 });

// ============================================
// QUERY MIDDLEWARE - Exclude soft deleted
// ============================================
userSchema.pre(/^find/, function () {
    if (this.getOptions().includeSoftDeleted !== true) {
        this.where({ deletedAt: null });
    }
    // next();
});

// ============================================
// VIRTUALS
// ============================================
userSchema.virtual('fullName').get(function () {
    if (!this.firstName && !this.lastName) return null;
    return [this.firstName, this.lastName].filter(Boolean).join(' ');
});

userSchema.virtual('isEmailVerified').get(function () {
    return this.emailOtp?.verified === true;
});

userSchema.virtual('isPhoneVerified').get(function () {
    return this.phone?.otp?.verified === true;
});

userSchema.virtual('hasPassword').get(function () {
    return this.password !== null;
});

userSchema.virtual('isDeleted').get(function () {
    return this.deletedAt !== null;
});

userSchema.virtual('isProfileComplete').get(function () {
    return !!(this.firstName && this.lastName && this.dob && this.gender);
});

userSchema.virtual('studentProfile', {
    ref: 'StudentProfile',
    localField: '_id',
    foreignField: 'userId',
    justOne: true
});

userSchema.virtual('staffProfile', {
    ref: 'StaffProfile',
    localField: '_id',
    foreignField: 'userId',
    justOne: true
});

// ============================================
// STATIC METHODS - Password Utilities
// ============================================

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
userSchema.statics.validatePasswordStrength = function (password) {
    const errors = [];

    if (!password || password.length < PASSWORD_CONFIG.MIN_LENGTH) {
        errors.push(`Password must be at least ${PASSWORD_CONFIG.MIN_LENGTH} characters long`);
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
userSchema.statics.hashPassword = async function (password) {
    return bcrypt.hash(password, PASSWORD_CONFIG.SALT_ROUNDS);
};

/**
 * Generate OTP
 * @returns {Object} - { code: string, hashedCode: string, expiresAt: Date }
 */
userSchema.statics.generateOtp = function () {
    const code = crypto.randomInt(100000, 999999).toString();
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + OTP_CONFIG.EXPIRY_MINUTES * 60 * 1000);

    return { code, hashedCode, expiresAt };
};

/**
 * Hash OTP code
 * @param {string} code - OTP code
 * @returns {string} - Hashed OTP
 */
userSchema.statics.hashOtp = function (code) {
    return crypto.createHash('sha256').update(code).digest('hex');
};

/**
 * Find user by email with sensitive fields
 * @param {string} email
 * @returns {Promise<User>}
 */
userSchema.statics.findByEmailWithSensitive = function (email) {
    return this.findOne({ email: email.toLowerCase() }).select('+password +emailOtp');
};

/**
 * Find user by email including soft deleted
 * @param {string} email
 * @returns {Promise<User>}
 */
userSchema.statics.findByEmailIncludingDeleted = function (email) {
    return this.findOne({ email: email.toLowerCase() }).setOptions({ includeSoftDeleted: true });
};

// ============================================
// INSTANCE METHODS - Password Operations
// ============================================

/**
 * Set password for user
 * @param {string} password - Plain text password
 * @returns {Promise<User>}
 */
userSchema.methods.setPassword = async function (password) {
    const validation = this.constructor.validatePasswordStrength(password);
    if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
    }

    this.password = await this.constructor.hashPassword(password);
    return this.save();
};

/**
 * Verify password
 * @param {string} password - Plain text password to verify
 * @returns {Promise<boolean>}
 */
userSchema.methods.verifyPassword = async function (password) {
    if (!this.password) {
        throw new Error('Password not set for this user');
    }
    return bcrypt.compare(password, this.password);
};

/**
 * Change password (requires old password)
 * @param {string} oldPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<User>}
 */
userSchema.methods.changePassword = async function (oldPassword, newPassword) {
    const isValid = await this.verifyPassword(oldPassword);
    if (!isValid) {
        throw new Error('Current password is incorrect');
    }

    return this.setPassword(newPassword);
};

/**
 * Reset password (via OTP, no old password needed)
 * @param {string} newPassword - New password
 * @returns {Promise<User>}
 */
userSchema.methods.resetPassword = async function (newPassword) {
    if (!this.emailOtp?.verified) {
        throw new Error('Email must be verified before resetting password');
    }

    return this.setPassword(newPassword);
};

// ============================================
// INSTANCE METHODS - Email OTP Operations
// ============================================

/**
 * Generate and set email OTP
 * @returns {Promise<{ user: User, otp: string }>}
 */
userSchema.methods.generateEmailOtp = async function () {
    const now = new Date();

    // Check cooldown
    if (this.emailOtp?.lastSentAt) {
        const cooldownEnd = new Date(
            this.emailOtp.lastSentAt.getTime() + OTP_CONFIG.COOLDOWN_MINUTES * 60 * 1000
        );
        if (now < cooldownEnd) {
            const remainingSeconds = Math.ceil((cooldownEnd - now) / 1000);
            throw new Error(
                `Please wait ${Math.ceil(remainingSeconds / 60)} minutes before requesting a new OTP`
            );
        }
    }

    const { code, hashedCode, expiresAt } = this.constructor.generateOtp();

    this.emailOtp = {
        code: hashedCode,
        expiresAt,
        attempts: 0,
        lastAttemptAt: null,
        lastSentAt: now,
        verified: false
    };

    await this.save();
    return { user: this, otp: code };
};

/**
 * Verify email OTP
 * @param {string} code - OTP code to verify
 * @returns {Promise<User>}
 */
userSchema.methods.verifyEmailOtp = async function (code) {
    if (!this.emailOtp?.code) {
        throw new Error('No OTP has been generated');
    }

    const now = new Date();

    // Check if expired
    if (now > this.emailOtp.expiresAt) {
        throw new Error('OTP has expired. Please request a new one');
    }

    // Check max attempts
    if (this.emailOtp.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
        throw new Error('Maximum OTP attempts exceeded. Please request a new OTP');
    }

    // Increment attempts
    this.emailOtp.attempts += 1;
    this.emailOtp.lastAttemptAt = now;

    const hashedInput = this.constructor.hashOtp(code);
    if (hashedInput !== this.emailOtp.code) {
        await this.save();
        const remainingAttempts = OTP_CONFIG.MAX_ATTEMPTS - this.emailOtp.attempts;
        throw new Error(`Invalid OTP. ${remainingAttempts} attempts remaining`);
    }

    // OTP is valid
    this.emailOtp.verified = true;
    this.emailOtp.code = null;

    await this.save();
    return this;
};

/**
 * Get email OTP cooldown remaining time in seconds
 * @returns {number}
 */
userSchema.methods.getEmailOtpCooldownRemaining = function () {
    if (!this.emailOtp?.lastSentAt) return 0;

    const now = new Date();
    const cooldownEnd = new Date(
        this.emailOtp.lastSentAt.getTime() + OTP_CONFIG.COOLDOWN_MINUTES * 60 * 1000
    );

    if (now >= cooldownEnd) return 0;
    return Math.ceil((cooldownEnd - now) / 1000);
};

// ============================================
// INSTANCE METHODS - Phone OTP Operations
// ============================================

/**
 * Set phone number and generate OTP
 * @param {string} phoneNumber - Phone number in format 923001234567
 * @returns {Promise<{ user: User, otp: string }>}
 */
userSchema.methods.setPhoneAndGenerateOtp = async function (phoneNumber) {
    // Validate format
    if (!/^[1-9]\d{9,14}$/.test(phoneNumber)) {
        throw new Error('Phone number must be in format: country code + number (e.g., 923001234567)');
    }

    const now = new Date();

    // Check cooldown if same number
    if (this.phone?.number === phoneNumber && this.phone?.otp?.lastSentAt) {
        const cooldownEnd = new Date(
            this.phone.otp.lastSentAt.getTime() + OTP_CONFIG.COOLDOWN_MINUTES * 60 * 1000
        );
        if (now < cooldownEnd) {
            const remainingSeconds = Math.ceil((cooldownEnd - now) / 1000);
            throw new Error(
                `Please wait ${Math.ceil(remainingSeconds / 60)} minutes before requesting a new OTP`
            );
        }
    }

    const { code, hashedCode, expiresAt } = this.constructor.generateOtp();

    this.phone = {
        number: phoneNumber,
        otp: {
            code: hashedCode,
            expiresAt,
            attempts: 0,
            lastAttemptAt: null,
            lastSentAt: now,
            verified: false
        }
    };

    await this.save();
    return { user: this, otp: code };
};

/**
 * Resend phone OTP
 * @returns {Promise<{ user: User, otp: string }>}
 */
userSchema.methods.resendPhoneOtp = async function () {
    if (!this.phone?.number) {
        throw new Error('No phone number set');
    }

    return this.setPhoneAndGenerateOtp(this.phone.number);
};

/**
 * Verify phone OTP
 * @param {string} code - OTP code to verify
 * @returns {Promise<User>}
 */
userSchema.methods.verifyPhoneOtp = async function (code) {
    if (!this.phone?.otp?.code) {
        throw new Error('No OTP has been generated for phone');
    }

    const now = new Date();

    // Check if expired
    if (now > this.phone.otp.expiresAt) {
        throw new Error('OTP has expired. Please request a new one');
    }

    // Check max attempts
    if (this.phone.otp.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
        throw new Error('Maximum OTP attempts exceeded. Please request a new OTP');
    }

    // Increment attempts
    this.phone.otp.attempts += 1;
    this.phone.otp.lastAttemptAt = now;

    const hashedInput = this.constructor.hashOtp(code);
    if (hashedInput !== this.phone.otp.code) {
        await this.save();
        const remainingAttempts = OTP_CONFIG.MAX_ATTEMPTS - this.phone.otp.attempts;
        throw new Error(`Invalid OTP. ${remainingAttempts} attempts remaining`);
    }

    // OTP is valid
    this.phone.otp.verified = true;
    this.phone.otp.code = null;

    await this.save();
    return this;
};

/**
 * Get phone OTP cooldown remaining time in seconds
 * @returns {number}
 */
userSchema.methods.getPhoneOtpCooldownRemaining = function () {
    if (!this.phone?.otp?.lastSentAt) return 0;

    const now = new Date();
    const cooldownEnd = new Date(
        this.phone.otp.lastSentAt.getTime() + OTP_CONFIG.COOLDOWN_MINUTES * 60 * 1000
    );

    if (now >= cooldownEnd) return 0;
    return Math.ceil((cooldownEnd - now) / 1000);
};

// ============================================
// INSTANCE METHODS - Status Operations
// ============================================

/**
 * Get registration status for frontend flow
 * @returns {Object}
 */
userSchema.methods.getRegistrationStatus = function () {
    const hasPasswordSet = this.password !== null;
    const isEmailVerified = this.emailOtp?.verified === true;
    const isPhoneVerified = this.phone?.otp?.verified === true;
    const hasPhone = this.phone?.number !== null;
    const isProfileComplete = !!(this.firstName && this.lastName && this.dob && this.gender);

    // Determine current step
    let currentStep = 'EMAIL_VERIFICATION';
    let message = 'Please verify your email';

    if (!isEmailVerified) {
        currentStep = 'EMAIL_VERIFICATION';
        message = 'Please verify your email';
    } else if (!hasPasswordSet) {
        currentStep = 'SET_PASSWORD';
        message = 'Please set your password';
    } else if (!hasPhone) {
        currentStep = 'ADD_PHONE';
        message = 'Please add your phone number';
    } else if (!isPhoneVerified) {
        currentStep = 'PHONE_VERIFICATION';
        message = 'Please verify your phone number';
    } else if (!isProfileComplete) {
        currentStep = 'COMPLETE_PROFILE';
        message = 'Please complete your profile';
    } else {
        currentStep = 'COMPLETE';
        message = 'Registration complete';
    }

    return {
        email: this.email,
        isEmailVerified,
        hasPassword: hasPasswordSet,
        hasPhone,
        phoneNumber: this.phone?.number || null,
        isPhoneVerified,
        isProfileComplete,
        firstName: this.firstName,
        lastName: this.lastName,
        currentStep,
        message,
        emailOtpCooldownRemaining: this.getEmailOtpCooldownRemaining(),
        phoneOtpCooldownRemaining: this.getPhoneOtpCooldownRemaining()
    };
};

/**
 * Update last login
 * @returns {Promise<User>}
 */
userSchema.methods.updateLastLogin = function () {
    this.lastLoginAt = new Date();
    return this.save();
};

/**
 * Suspend user
 * @returns {Promise<User>}
 */
userSchema.methods.suspend = function () {
    this.status = USER_STATUS.SUSPENDED;
    return this.save();
};

/**
 * Activate user
 * @returns {Promise<User>}
 */
userSchema.methods.activate = function () {
    this.status = USER_STATUS.ACTIVE;
    return this.save();
};

/**
 * Deactivate user
 * @returns {Promise<User>}
 */
userSchema.methods.deactivate = function () {
    this.status = USER_STATUS.INACTIVE;
    return this.save();
};

/**
 * Soft delete user
 * @returns {Promise<User>}
 */
userSchema.methods.softDelete = function () {
    this.deletedAt = new Date();
    this.status = USER_STATUS.INACTIVE;
    return this.save();
};

/**
 * Restore soft deleted user
 * @returns {Promise<User>}
 */
userSchema.methods.restore = function () {
    this.deletedAt = null;
    this.status = USER_STATUS.ACTIVE;
    return this.save();
};

/**
 * Convert staff to student
 * @returns {Promise<User>}
 */
userSchema.methods.convertToStudent = function () {
    if (this.role === USER_ROLE.STUDENT) {
        throw new Error('User is already a student');
    }
    this.role = USER_ROLE.STUDENT;
    return this.save();
};

// ============================================
// JSON TRANSFORM
// ============================================
userSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.emailOtp;
        if (ret.phone) {
            delete ret.phone.otp;
        }
        return ret;
    }
});

userSchema.set('toObject', { virtuals: true });

// ============================================
// EXPORT
// ============================================
const User = model('User', userSchema);
export default User;