import mongoose from "mongoose";


const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        validate: {
            validator: function (value) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            },
            message: 'Invalid email format'
        },
        unique: true,
        trim: true,
        lowercase: true,
    },
    phone: {
        type: String,
        trim: true
    },
    password: {
        type: String,
        select: false,
    },
    passwordSet: {
        type: Boolean,
        default: false,
    },
    firstName: {
        type: String,
        trim: true,
    },
    lastName: {
        type: String,
        trim: true,
    },
    role: {
        type: String,
        enum: ['Admin', 'Student', 'Consultant', 'Manager', 'Accountant', 'BackendOfficer', 'Receptionist'],
        default: 'Student',
    },

    source: {
        type: String,
        enum: ['Online', 'ConsultantCreation'],
        default: 'Online',
    },

    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Suspended'],
        default: 'Active',
        required: true,
    },

    emailOTP: {
        code: { type: String, select: false },
        expiry: { type: Date, select: false },
        attempts: { type: Number, default: 0, select: false },
        lastAttempt: { type: Date, select: false }
    },
    emailVerified: {
        type: Boolean,
        default: false
    },

    lastLogin: {
        type: Date,
        default: null,
    },


}, { timestamps: true });


UserSchema.index({ email: 1 });


UserSchema.pre('save', async function (next) {
    if (this.isModified('password') && this.password) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};


UserSchema.methods.generateOTP = function () {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    this.emailOTP = {
        code: crypto.createHash('sha256').update(otp).digest('hex'),
        expiry: new Date(Date.now() + 10 * 60 * 1000), //10 mins
        attempts: 0,
        lastAttempt: new Date()
    };

    return otp;
};

// Verify OTP
UserSchema.methods.verifyOTP = async function (otp) {
    if (!this.emailOTP?.code || !this.emailOTP?.expiry) {
        return false;
    }

    if (new Date() > this.emailOTP.expiry) {
        return false;
    }

    if (this.emailOTP.attempts >= 5) {
        return false;
    }

    this.emailOTP.attempts += 1;
    this.emailOTP.lastAttempt = new Date();

    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

    if (hashedOTP === this.emailOTP.code) {
        this.emailOTP = undefined;
        this.emailVerified = true;
        await this.save();
        return true;
    }

    await this.save();
    return false;
};

const User = mongoose.model('User', UserSchema);
export default User;