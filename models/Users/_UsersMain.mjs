// models/User.mjs
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const { Schema, model } = mongoose;

export const USER_ROLE = Object.freeze({
    STUDENT: 'STUDENT',
    STAFF: 'STAFF'
});

export const USER_STATUS = Object.freeze({
    ACTIVE: 'ACTIVE',
    SUSPENDED: 'SUSPENDED'
});

export const USER_SOURCE = Object.freeze({
    ONLINE: 'ONLINE',
    WALK_IN: 'WALK_IN',
    CONSULTANT: 'CONSULTANT'
});

const OTP_CONFIG = {
    EXPIRY_MINUTES: 10,
    MAX_ATTEMPTS: 5,
    COOLDOWN_MINUTES: 2
};

const PASSWORD_CONFIG = {
    MIN_LENGTH: 8,
    SALT_ROUNDS: 12
};

const otpSchema = new Schema(
    {
        code: {
            type: String,
            default: null,
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






const userSchema = new Schema(
    {





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
        },

        emailOtp: {
            type: otpSchema,
            default: () => ({}),
            select: false
        },






        password: {
            type: String,
            default: null,
            select: false
        },







        phone: {
            type: phoneSchema,
            default: () => ({})
        },







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







        role: {
            type: String,
            enum: {
                values: Object.values(USER_ROLE),
                message: 'Invalid role: {VALUE}'
            },
            default: USER_ROLE.STUDENT,
            index: true,
        },

        source: {
            type: String,
            enum: {
                values: Object.values(USER_SOURCE),
                message: 'Invalid source: {VALUE}'
            },
            default: USER_SOURCE.ONLINE
        },

        status: {
            type: String,
            enum: {
                values: Object.values(USER_STATUS),
                message: 'Invalid status: {VALUE}'
            },
            default: USER_STATUS.ACTIVE,
            index: true
        },

        lastLoginAt: {
            type: Date,
            default: null
        }


    }, { timestamps: true }
);

userSchema.index({ role: 1, status: 1 });
userSchema.index({ createdAt: -1 });























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

userSchema.statics.hashPassword = async function (password) {
    return bcrypt.hash(password, PASSWORD_CONFIG.SALT_ROUNDS);
};

userSchema.statics.generateOtp = function () {
    const code = process.env.NODE_ENV === 'development' ? '111111' : crypto.randomInt(100000, 999999).toString();
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + OTP_CONFIG.EXPIRY_MINUTES * 60 * 1000);

    return { code, hashedCode, expiresAt };
};

userSchema.statics.hashOtp = function (code) {
    return crypto.createHash('sha256').update(code).digest('hex');
};













userSchema.methods.setPassword = async function (password) {
    const validation = this.constructor.validatePasswordStrength(password);
    if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
    }

    this.password = await this.constructor.hashPassword(password);
    return this.save();
};

userSchema.methods.verifyPassword = async function (password) {
    // Fetch fresh user with password selected
    const user = await this.constructor.findById(this._id).select('+password');
    if (!user || !user.password) {
        throw new Error('Password not set for this user');
    }
    return bcrypt.compare(password, user.password);
};

userSchema.methods.changePassword = async function (oldPassword, newPassword) {
    const isValid = await this.verifyPassword(oldPassword);
    if (!isValid) {
        throw new Error('Current password is incorrect');
    }

    // Fetch fresh user instance to set password on
    const user = await this.constructor.findById(this._id);
    return user.setPassword(newPassword);
};

userSchema.methods.resetPassword = async function (newPassword) {
    // Fetch fresh user with emailOtp selected
    const user = await this.constructor.findById(this._id).select('+emailOtp');
    if (!user.emailOtp?.verified) {
        throw new Error('Email must be verified before resetting password');
    }

    return user.setPassword(newPassword);
};











userSchema.methods.generateEmailOtp = async function () {
    // Fetch fresh user data with email OTP
    const user = await this.constructor.findById(this._id).select('+emailOtp');
    const now = new Date();

    // Check cooldown
    if (user.emailOtp?.lastSentAt) {
        const cooldownEnd = new Date(
            user.emailOtp.lastSentAt.getTime() + OTP_CONFIG.COOLDOWN_MINUTES * 60 * 1000
        );
        if (now < cooldownEnd) {
            const remainingSeconds = Math.ceil((cooldownEnd - now) / 1000);
            throw new Error(
                `Please wait ${Math.ceil(remainingSeconds / 60)} minutes before requesting a new OTP`
            );
        }
    }

    const { code, hashedCode, expiresAt } = this.constructor.generateOtp();

    user.emailOtp = {
        code: hashedCode,
        expiresAt,
        attempts: 0,
        lastAttemptAt: null,
        lastSentAt: now,
        verified: false
    };

    await user.save();

    return { user: user, success: true, otp: code };
};

userSchema.methods.verifyEmailOtp = async function (code) {
    const user = await this.constructor.findById(this._id).select('+emailOtp');

    if (!user.emailOtp?.code) {
        throw new Error('No OTP has been generated');
    }

    const now = new Date();

    // Check if expired
    if (now > user.emailOtp.expiresAt) {
        throw new Error('OTP has expired. Please request a new one');
    }

    // Check max attempts
    if (user.emailOtp.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
        throw new Error('Maximum OTP attempts exceeded. Please request a new OTP');
    }

    // Increment attempts
    user.emailOtp.attempts += 1;
    user.emailOtp.lastAttemptAt = now;

    const hashedInput = this.constructor.hashOtp(code);
    if (hashedInput !== user.emailOtp.code) {
        await user.save();
        const remainingAttempts = OTP_CONFIG.MAX_ATTEMPTS - user.emailOtp.attempts;
        throw new Error(`Invalid OTP. ${remainingAttempts} attempts remaining`);
    }

    // OTP is valid
    user.emailOtp.verified = true;
    user.emailOtp.code = null;
    user.success = true;

    await user.save();
    return user;
};

userSchema.methods.getEmailOtpCooldownRemaining = async function () {
    // Fetch fresh user data with email OTP
    const user = await this.constructor.findById(this._id).select('+emailOtp');

    if (!user.emailOtp?.lastSentAt) return 0;

    const now = new Date();
    const cooldownEnd = new Date(
        user.emailOtp.lastSentAt.getTime() + OTP_CONFIG.COOLDOWN_MINUTES * 60 * 1000
    );

    if (now >= cooldownEnd) return 0;
    return Math.ceil((cooldownEnd - now) / 1000);
};



userSchema.methods.setPhoneAndGenerateOtp = async function (phoneNumber) {
    // Validate format
    if (!/^\+?[1-9]\d{9,14}$/.test(phoneNumber)) {
        throw new Error('Phone number must be in format: country code + number (e.g., 923001234567)');
    }

    // Fetch fresh user data
    const user = await this.constructor.findById(this._id);
    const now = new Date();

    // Check cooldown if same number
    if (user.phone?.otp?.lastSentAt) {
        const cooldownEnd = new Date(
            user.phone.otp.lastSentAt.getTime() + OTP_CONFIG.COOLDOWN_MINUTES * 60 * 1000
        );
        if (now < cooldownEnd) {
            const remainingSeconds = Math.ceil((cooldownEnd - now) / 1000);
            throw new Error(
                `Please wait ${Math.ceil(remainingSeconds / 60)} minutes before requesting a new OTP`
            );
        }
    }

    const { code, hashedCode, expiresAt } = this.constructor.generateOtp();

    user.phone = {
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

    await user.save();
    return { user: user, success: true, otp: code };
};

userSchema.methods.resendPhoneOtp = async function () {
    // Fetch fresh user data
    const user = await this.constructor.findById(this._id);

    if (!user.phone?.number) {
        throw new Error('No phone number set');
    }

    const result = await user.setPhoneAndGenerateOtp(user.phone.number);
    return { ...result, success: true };
};

userSchema.methods.verifyPhoneOtp = async function (code) {
    // Fetch fresh user data with phone OTP
    const user = await this.constructor.findById(this._id);

    if (!user.phone?.otp?.code) {
        throw new Error('No OTP has been generated for phone');
    }

    const now = new Date();

    // Check if expired
    if (now > user.phone.otp.expiresAt) {
        throw new Error('OTP has expired. Please request a new one');
    }

    // Check max attempts
    if (user.phone.otp.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
        throw new Error('Maximum OTP attempts exceeded. Please request a new OTP');
    }

    // Increment attempts
    user.phone.otp.attempts += 1;
    user.phone.otp.lastAttemptAt = now;

    const hashedInput = this.constructor.hashOtp(code);
    if (hashedInput !== user.phone.otp.code) {
        await user.save();
        const remainingAttempts = OTP_CONFIG.MAX_ATTEMPTS - user.phone.otp.attempts;
        throw new Error(`Invalid OTP. ${remainingAttempts} attempts remaining`);
    }

    // OTP is valid
    user.phone.otp.verified = true;
    user.phone.otp.code = null;

    await user.save();
    return { user, success: true };
};

userSchema.methods.getPhoneOtpCooldownRemaining = async function () {
    // Fetch fresh user data with phone OTP
    const user = await this.constructor.findById(this._id);

    if (!user.phone?.otp?.lastSentAt) return 0;

    const now = new Date();
    const cooldownEnd = new Date(
        user.phone.otp.lastSentAt.getTime() + OTP_CONFIG.COOLDOWN_MINUTES * 60 * 1000
    );

    if (now >= cooldownEnd) return 0;
    return Math.ceil((cooldownEnd - now) / 1000);
};




userSchema.methods.getRegistrationStatus = async function () {
    // Fetch fresh user data including hidden fields
    const user = await this.constructor.findById(this._id).select('+password +emailOtp');

    const hasPasswordSet = !!user.password;
    const isEmailVerified = user.emailOtp?.verified === true;
    const isProfileComplete = !!(user.firstName);

    // Determine current step
    let currentStep = 'EMAIL_VERIFICATION';
    let message = 'Please verify your email';

    if (!isEmailVerified) {
        currentStep = 'EMAIL_VERIFICATION';
        message = 'Please verify your email';
    } else if (!hasPasswordSet) {
        currentStep = 'SET_PASSWORD';
        message = 'Please set your password';
    } else if (!isProfileComplete) {
        currentStep = 'COMPLETE_PROFILE';
        message = 'Please complete your profile';
    } else {
        currentStep = 'COMPLETE';
        message = 'Registration complete';
    }

    return {
        email: user.email,
        isEmailVerified,
        hasPassword: hasPasswordSet,
        isProfileComplete,
        firstName: user.firstName,
        lastName: user.lastName,
        currentStep,
        message,
        emailOtpCooldownRemaining: await user.getEmailOtpCooldownRemaining(),
        phoneOtpCooldownRemaining: await user.getPhoneOtpCooldownRemaining()
    };
};





userSchema.methods.hasPasswordAsync = async function () {
    const user = await this.constructor.findById(this._id).select('+password');
    return !!user?.password;
};

userSchema.methods.isEmailVerifiedAsync = async function () {
    const user = await this.constructor.findById(this._id).select('+emailOtp');
    return user.emailOtp?.verified === true;
};

userSchema.methods.isPhoneVerifiedAsync = async function () {
    const user = await this.constructor.findById(this._id);
    return user.phone?.otp?.verified === true;
};











userSchema.methods.updateLastLogin = function () {
    this.lastLoginAt = new Date();
    return this.save();
};

userSchema.methods.suspend = function () {
    this.status = USER_STATUS.SUSPENDED;
    return this.save();
};

userSchema.methods.activate = function () {
    this.status = USER_STATUS.ACTIVE;
    return this.save();
};







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




const User = model('User', userSchema);
export default User;