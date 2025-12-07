// models/Task.mjs
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ============================================
// ENUMS
// ============================================
export const TASK_STATUS = Object.freeze({
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
});

export const TASK_PRIORITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
});

// ============================================
// SCHEMA DEFINITION
// ============================================
const taskSchema = new Schema(
  {
    // ---- Core Fields ----
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application ID is required'],
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

    // ---- Status & Priority ----
    status: {
      type: String,
      enum: {
        values: Object.values(TASK_STATUS),
        message: 'Invalid task status: {VALUE}'
      },
      default: TASK_STATUS.PENDING,
      index: true
    },

    priority: {
      type: String,
      enum: {
        values: Object.values(TASK_PRIORITY),
        message: 'Invalid priority: {VALUE}'
      },
      default: TASK_PRIORITY.MEDIUM
    },

    // ---- Visibility ----
    visibleToStudent: {
      type: Boolean,
      default: true
    },

    // ---- Assignment ----
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
      index: true
    },

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },

    // ---- Dates ----
    dueDate: {
      type: Date,
      default: null,
      validate: {
        validator: function (value) {
          if (!value) return true;
          // Due date should be in the future when creating
          if (this.isNew) {
            return value >= new Date();
          }
          return true;
        },
        message: 'Due date must be in the future'
      }
    },

    startedAt: {
      type: Date,
      default: null
    },

    completedAt: {
      type: Date,
      default: null
    },

    cancelledAt: {
      type: Date,
      default: null
    },

    // ---- Additional Info ----
    completionNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Completion notes cannot exceed 1000 characters'],
      default: null
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
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
taskSchema.index({ applicationId: 1, status: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ dueDate: 1, status: 1 });
taskSchema.index({ createdAt: -1 });

// ============================================
// QUERY MIDDLEWARE - Exclude soft deleted
// ============================================
taskSchema.pre(/^find/, function (next) {
  if (this.getOptions().includeSoftDeleted !== true) {
    this.where({ deletedAt: null });
  }
  next();
});

// ============================================
// VIRTUALS
// ============================================
taskSchema.virtual('isOverdue').get(function () {
  if (!this.dueDate) return false;
  if (this.status === TASK_STATUS.COMPLETED || this.status === TASK_STATUS.CANCELLED) {
    return false;
  }
  return new Date() > this.dueDate;
});

taskSchema.virtual('isDeleted').get(function () {
  return this.deletedAt !== null;
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Start a task
 */
taskSchema.methods.start = function () {
  if (this.status !== TASK_STATUS.PENDING) {
    throw new Error(`Cannot start task with status: ${this.status}`);
  }
  this.status = TASK_STATUS.IN_PROGRESS;
  this.startedAt = new Date();
  return this.save();
};

/**
 * Complete a task
 * @param {string} notes - Optional completion notes
 */
taskSchema.methods.complete = function (notes = null) {
  if (this.status === TASK_STATUS.COMPLETED) {
    throw new Error('Task is already completed');
  }
  if (this.status === TASK_STATUS.CANCELLED) {
    throw new Error('Cannot complete a cancelled task');
  }
  this.status = TASK_STATUS.COMPLETED;
  this.completedAt = new Date();
  if (notes) {
    this.completionNotes = notes;
  }
  return this.save();
};

/**
 * Cancel a task
 * @param {string} reason - Cancellation reason
 */
taskSchema.methods.cancel = function (reason = null) {
  if (this.status === TASK_STATUS.COMPLETED) {
    throw new Error('Cannot cancel a completed task');
  }
  if (this.status === TASK_STATUS.CANCELLED) {
    throw new Error('Task is already cancelled');
  }
  this.status = TASK_STATUS.CANCELLED;
  this.cancelledAt = new Date();
  if (reason) {
    this.cancellationReason = reason;
  }
  return this.save();
};

/**
 * Reopen a cancelled or completed task
 */
taskSchema.methods.reopen = function () {
  if (this.status === TASK_STATUS.PENDING || this.status === TASK_STATUS.IN_PROGRESS) {
    throw new Error('Task is already open');
  }
  this.status = TASK_STATUS.PENDING;
  this.completedAt = null;
  this.cancelledAt = null;
  this.completionNotes = null;
  this.cancellationReason = null;
  return this.save();
};

/**
 * Assign task to a user
 * @param {ObjectId} userId - User to assign to
 */
taskSchema.methods.assignTo = function (userId) {
  this.assignedTo = userId;
  return this.save();
};

/**
 * Soft delete the task
 */
taskSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

/**
 * Restore soft deleted task
 */
taskSchema.methods.restore = function () {
  this.deletedAt = null;
  return this.save();
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Get tasks by application
 * @param {ObjectId} applicationId
 * @param {boolean} visibleToStudentOnly - Filter by visibility
 */
taskSchema.statics.findByApplication = function (applicationId, visibleToStudentOnly = false) {
  const query = { applicationId };
  if (visibleToStudentOnly) {
    query.visibleToStudent = true;
  }
  return this.find(query).sort({ createdAt: -1 });
};

/**
 * Get overdue tasks
 */
taskSchema.statics.findOverdue = function () {
  return this.find({
    dueDate: { $lt: new Date() },
    status: { $in: [TASK_STATUS.PENDING, TASK_STATUS.IN_PROGRESS] }
  }).sort({ dueDate: 1 });
};

/**
 * Get tasks assigned to a user
 * @param {ObjectId} userId
 * @param {string} status - Optional status filter
 */
taskSchema.statics.findByAssignee = function (userId, status = null) {
  const query = { assignedTo: userId };
  if (status) {
    query.status = status;
  }
  return this.find(query).sort({ dueDate: 1, priority: -1 });
};

/**
 * Get pending tasks count for an application
 * @param {ObjectId} applicationId
 */
taskSchema.statics.getPendingCount = async function (applicationId) {
  return this.countDocuments({
    applicationId,
    status: { $in: [TASK_STATUS.PENDING, TASK_STATUS.IN_PROGRESS] }
  });
};

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