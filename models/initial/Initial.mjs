import mongoose from 'mongoose';

const InitialSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: [true, 'Email already exists'],
        validate: {
            validator: function (value) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            },
            message: 'Invalid email format',
        },
        trim: true,
        lowercase: true,
    },

    firstName: {
        type: String,
        required: true,
        trim: true,
    },

    lastName: {
        type: String,
        required: true,
        trim: true,
    },

    phoneNumber: {
        type: String,
        required: false,
        trim: true,
    },


    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING',
    },

    source: {
        type: String,
        enum: ['Marketing', 'Online', 'WalkIn'],
        required: true,
    },


    assignedConsultantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    }

}, { timestamps: true });

const Initial = mongoose.model('Initial', InitialSchema);
export default Initial;