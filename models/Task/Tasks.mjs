import mongoose from 'mongoose';

const DayTaskSchema = new mongoose.Schema({
    applicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Process',
        required: [true, 'Process ID is required'],
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Assigned To is required'],
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    status: {
        type: String,
        enum: ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED'],
        default: 'OPEN',
    },

    isVisibleToStudent: {
        type: Boolean,
        default: true,
    },

    completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    },

    dueDate: {
        type: Date,
        default: () => new Date(Date.now() + 86400000), // Default to tomorrow
        required: true,
    },

    completedAt: {
        type: Date,
        required: false,
    },

}, { timestamps: true });

const DayTask = mongoose.model('DayTask', DayTaskSchema);
export default DayTask;