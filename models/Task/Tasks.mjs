// models/Task/Tasks.mjs
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ============================================
// ENUMS
// ============================================
export const TASK_STATUS = Object.freeze({
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    WITHDRAWN: 'WITHDRAWN',
    CANCELLED: 'CANCELLED'
});

// ============================================
// SCHEMA DEFINITION
// ============================================
const taskSchema = new Schema(
    {
        processId: {
            type: Schema.Types.ObjectId,
            ref: 'Process',
            required: [true, 'Process ID is required'],
            index: true
        },
        title: {
            type: String,
            required: [true, 'Task title is required'],
            trim: true,
            minlength: [3, 'Title must be at least 3 characters'],
            maxlength: [200, 'Title cannot exceed 200 characters']
        },
        description: {
            type: String,
            trim: true,
            maxlength: [2000, 'Description cannot exceed 2000 characters'],
            default: null
        },
        status: {
            type: String,
            enum: {
                values: Object.values(TASK_STATUS),
                message: 'Invalid task status: {VALUE}'
            },
            default: TASK_STATUS.PENDING,
            index: true
        },
        visibleToStudent: {
            type: Boolean,
            default: true
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Creator is required'],
            index: true
        },
        // dueDate removed per requirements
        notes: {
            type: String,
            trim: true,
            maxlength: [1000, 'Notes cannot exceed 1000 characters'],
            default: null
        }
    },
    { timestamps: true }
);

// ============================================
// INDEXES
// ============================================
taskSchema.index({ processId: 1, status: 1 });

// ============================================
// VIRTUALS
// ============================================
// dueDate / isOverdue removed: overdue logic no longer tracked on tasks

// ============================================
// INSTANCE METHODS
// ============================================

// updateStatus removed: allow direct status changes except for withdrawn tasks (handled in routes/controllers)


// ============================================
// JSON TRANSFORM
// ============================================
taskSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

taskSchema.set('toObject', { virtuals: true });

// ============================================
// EXPORT
// ============================================
const Task = model('Task', taskSchema);
export default Task;
