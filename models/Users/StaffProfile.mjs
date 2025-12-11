// models/StaffProfile.mjs
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

export const STAFF_ROLE = Object.freeze({
    MANAGER: 'MANAGER',
    RECEPTIONIST: 'RECEPTIONIST',
    ACCOUNTANT: 'ACCOUNTANT',
    AGENT: 'AGENT',
    CONSULTANT: 'CONSULTANT',
    ADMIN: 'ADMIN'
});

export const STAFF_VERIFICATION_STATUS = Object.freeze({
    PENDING: 'PENDING',
    VERIFIED: 'VERIFIED',
    REJECTED: 'REJECTED'
});

const staffProfileSchema = new Schema(
    {

        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            unique: true,
            index: true
        },



        staffRole: {
            type: String,
            enum: {
                values: Object.values(STAFF_ROLE),
                message: 'Invalid staff role: {VALUE}'
            },
            required: [true, 'Staff role is required'],
            index: true
        },



        verificationStatus: {
            type: String,
            enum: {
                values: Object.values(STAFF_VERIFICATION_STATUS),
                message: 'Invalid verification status: {VALUE}'
            },
            default: STAFF_VERIFICATION_STATUS.PENDING,
            index: true
        },

        rejectionReason: {
            type: String,
            trim: true,
            maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
            default: null
        }



    },
    {
        timestamps: true
    }
);



staffProfileSchema.index({ staffRole: 1, verificationStatus: 1 });






staffProfileSchema.virtual('isVerified').get(function () {
    return this.verificationStatus === STAFF_VERIFICATION_STATUS.VERIFIED;
});

staffProfileSchema.virtual('isPending').get(function () {
    return this.verificationStatus === STAFF_VERIFICATION_STATUS.PENDING;
});

staffProfileSchema.virtual('isRejected').get(function () {
    return this.verificationStatus === STAFF_VERIFICATION_STATUS.REJECTED;
});

staffProfileSchema.virtual('user', {
    ref: 'User',
    localField: 'userId',
    foreignField: '_id',
    justOne: true
});

staffProfileSchema.methods.verify = function () {
    if (this.verificationStatus === STAFF_VERIFICATION_STATUS.VERIFIED) {
        throw new Error('Staff member is already verified');
    }

    this.verificationStatus = STAFF_VERIFICATION_STATUS.VERIFIED;
    this.rejectionReason = null;

    return this.save();
};

staffProfileSchema.methods.reject = function (reason) {
    if (!reason) {
        throw new Error('Rejection reason is required');
    }

    this.verificationStatus = STAFF_VERIFICATION_STATUS.REJECTED;
    this.rejectionReason = reason || null;

    return this.save();
};

staffProfileSchema.methods.resetToPending = function () {
    this.verificationStatus = STAFF_VERIFICATION_STATUS.PENDING;
    this.rejectionReason = null;

    return this.save();
};



staffProfileSchema.methods.changeRole = function (newRole) {
    if (!Object.values(STAFF_ROLE).includes(newRole)) {
        throw new Error('Invalid staff role');
    }

    this.staffRole = newRole;
    return this.save();
};

staffProfileSchema.statics.findByUserId = function (userId) {
    return this.findOne({ userId }).populate('user');
};

staffProfileSchema.statics.findVerifiedByRole = function (role) {
    return this.find({
        staffRole: role,
        verificationStatus: STAFF_VERIFICATION_STATUS.VERIFIED
    }).populate('user');
};

staffProfileSchema.statics.findPendingVerifications = function () {
    return this.find({
        verificationStatus: STAFF_VERIFICATION_STATUS.PENDING
    }).populate('user');
};

staffProfileSchema.statics.findConsultants = function (verifiedOnly = true) {
    const query = { staffRole: STAFF_ROLE.CONSULTANT };
    if (verifiedOnly) {
        query.verificationStatus = STAFF_VERIFICATION_STATUS.VERIFIED;
    }
    return this.find(query).populate('user').populate('assignedCountries');
};

staffProfileSchema.statics.findAccountants = function (verifiedOnly = true) {
    const query = { staffRole: STAFF_ROLE.ACCOUNTANT };
    if (verifiedOnly) {
        query.verificationStatus = STAFF_VERIFICATION_STATUS.VERIFIED;
    }
    return this.find(query).populate('user');
};





staffProfileSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

staffProfileSchema.set('toObject', { virtuals: true });

const StaffProfile = model('StaffProfile', staffProfileSchema);
export default StaffProfile;