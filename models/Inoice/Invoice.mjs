// models/Invoice.mjs
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// ============================================
// ENUMS
// ============================================
export const INVOICE_STATUS = Object.freeze({
    PENDING: 'PENDING',               // Just created, awaiting accountant action
    STUDENT_CONTACTED: 'STUDENT_CONTACTED',  // Accountant has contacted student
    PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',    // Payment info recorded
    APPROVED: 'APPROVED',             // Payment verified and approved
    CANCELLED: 'CANCELLED'            // Invoice cancelled / student didn't pay
});

export const INVOICE_PAYMENT_TYPE = Object.freeze({
    DIRECT: 'DIRECT',       // Student pays directly to consultancy
    UNIVERSITY: 'UNIVERSITY' // Payment goes through university
});

export const PAYMENT_METHOD = Object.freeze({
    CASH: 'CASH',
    ONLINE: 'ONLINE'
});

export const CURRENCY = Object.freeze({
    USD: 'USD',
    EUR: 'EUR',
    GBP: 'GBP',
    PKR: 'PKR',
    AED: 'AED',
    SAR: 'SAR',
    QAR: 'QAR',
    KWD: 'KWD',
    OMR: 'OMR',
    BHD: 'BHD'
});

// ============================================
// SUB-SCHEMAS
// ============================================

// Breakdown item for invoice details
const breakdownItemSchema = new Schema(
    {
        description: {
            type: String,
            required: [true, 'Breakdown description is required'],
            trim: true,
            maxlength: [200, 'Description cannot exceed 200 characters']
        },
        amount: {
            type: Number,
            required: [true, 'Breakdown amount is required'],
            min: [0, 'Amount cannot be negative']
        }
    },
    { _id: false }
);

// Payment tracking information
const paymentTrackingSchema = new Schema(
    {
        paymentMethod: {
            type: String,
            enum: {
                values: Object.values(PAYMENT_METHOD),
                message: 'Invalid payment method: {VALUE}'
            },
            required: [true, 'Payment method is required']
        },
        transactionId: {
            type: String,
            trim: true,
            default: null,
            validate: {
                validator: function (value) {
                    // Transaction ID required for online payments
                    if (this.paymentMethod === PAYMENT_METHOD.ONLINE && !value) {
                        return false;
                    }
                    return true;
                },
                message: 'Transaction ID is required for online payments'
            }
        },
        filePath: {
            type: String,
            trim: true,
            default: null,
            validate: {
                validator: function (value) {
                    // File path required for online payments (screenshot/receipt)
                    if (this.paymentMethod === PAYMENT_METHOD.ONLINE && !value) {
                        return false;
                    }
                    if (value) {
                        return /^[\w\-\/\\.]+\.(pdf|jpg|jpeg|png)$/i.test(value);
                    }
                    return true;
                },
                message: 'Valid file path is required for online payments'
            }
        },
        fileName: {
            type: String,
            trim: true,
            default: null
        },
        recordedAt: {
            type: Date,
            default: Date.now
        },
        recordedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Recorder ID is required']
        },
        notes: {
            type: String,
            trim: true,
            maxlength: [500, 'Payment notes cannot exceed 500 characters'],
            default: null
        }
    },
    { _id: false }
);

// ============================================
// MAIN SCHEMA DEFINITION
// ============================================
const invoiceSchema = new Schema(
    {
        // ---- Reference ----
        applicationId: {
            type: Schema.Types.ObjectId,
            ref: 'Application',
            required: [true, 'Application ID is required'],
            index: true
        },

        // ---- Invoice Number ----
        invoiceNumber: {
            type: String,
            unique: true,
            sparse: true,
            trim: true
        },

        // ---- Assignment ----
        accountantId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true
        },

        // ---- Payment Type ----
        paymentType: {
            type: String,
            enum: {
                values: Object.values(INVOICE_PAYMENT_TYPE),
                message: 'Invalid payment type: {VALUE}'
            },
            required: [true, 'Payment type is required'],
            index: true
        },

        // ---- Amount ----
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0, 'Amount cannot be negative']
        },

        currency: {
            type: String,
            enum: {
                values: Object.values(CURRENCY),
                message: 'Invalid currency: {VALUE}'
            },
            required: [true, 'Currency is required'],
            default: CURRENCY.USD
        },

        // ---- Breakdown ----
        breakdown: {
            type: [breakdownItemSchema],
            default: [],
            validate: {
                validator: function (items) {
                    if (items.length === 0) return true;
                    const total = items.reduce((sum, item) => sum + item.amount, 0);
                    // Allow small floating point differences
                    return Math.abs(total - this.amount) < 0.01;
                },
                message: 'Breakdown total must equal invoice amount'
            }
        },

        // ---- Status ----
        status: {
            type: String,
            enum: {
                values: Object.values(INVOICE_STATUS),
                message: 'Invalid invoice status: {VALUE}'
            },
            default: INVOICE_STATUS.PENDING,
            index: true
        },

        // ---- Student Contact Status ----
        studentContacted: {
            type: Boolean,
            default: false
        },

        studentContactedAt: {
            type: Date,
            default: null
        },

        studentContactedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        contactNotes: {
            type: String,
            trim: true,
            maxlength: [500, 'Contact notes cannot exceed 500 characters'],
            default: null
        },

        // ---- Payment Tracking ----
        paymentTracking: {
            type: paymentTrackingSchema,
            default: null
        },

        // ---- Dates ----
        issuedAt: {
            type: Date,
            default: Date.now,
            required: true
        },

        dueDate: {
            type: Date,
            default: null
        },

        approvedAt: {
            type: Date,
            default: null
        },

        approvedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        cancelledAt: {
            type: Date,
            default: null
        },

        cancelledBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        cancellationReason: {
            type: String,
            trim: true,
            maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
            default: null
        },

        // ---- Additional Notes ----
        notes: {
            type: String,
            trim: true,
            maxlength: [1000, 'Notes cannot exceed 1000 characters'],
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
invoiceSchema.index({ applicationId: 1, status: 1 });
invoiceSchema.index({ accountantId: 1, status: 1 });
invoiceSchema.index({ paymentType: 1, status: 1 });
invoiceSchema.index({ issuedAt: -1 });
invoiceSchema.index({ dueDate: 1 }, { sparse: true });

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================

// Generate invoice number before saving
invoiceSchema.pre('save', async function () {
    if (this.isNew && !this.invoiceNumber) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');

        // Count invoices this month
        const count = await this.constructor.countDocuments({
            createdAt: {
                $gte: new Date(year, date.getMonth(), 1),
                $lt: new Date(year, date.getMonth() + 1, 1)
            }
        });

        // Format: INV-YYYYMM-XXXX
        this.invoiceNumber = `INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;
    }
});

// ============================================
// QUERY MIDDLEWARE - Exclude soft deleted
// ============================================
invoiceSchema.pre(/^find/, function (next) {
    if (this.getOptions().includeSoftDeleted !== true) {
        this.where({ deletedAt: null });
    }
    next();
});

// ============================================
// VIRTUALS
// ============================================
invoiceSchema.virtual('isPending').get(function () {
    return this.status === INVOICE_STATUS.PENDING;
});

invoiceSchema.virtual('isApproved').get(function () {
    return this.status === INVOICE_STATUS.APPROVED;
});

invoiceSchema.virtual('isCancelled').get(function () {
    return this.status === INVOICE_STATUS.CANCELLED;
});

invoiceSchema.virtual('isPaid').get(function () {
    return this.paymentTracking !== null;
});

invoiceSchema.virtual('isOverdue').get(function () {
    if (!this.dueDate) return false;
    if (this.status === INVOICE_STATUS.APPROVED || this.status === INVOICE_STATUS.CANCELLED) {
        return false;
    }
    return new Date() > this.dueDate;
});

invoiceSchema.virtual('isDeleted').get(function () {
    return this.deletedAt !== null;
});

invoiceSchema.virtual('isDirect').get(function () {
    return this.paymentType === INVOICE_PAYMENT_TYPE.DIRECT;
});

invoiceSchema.virtual('isUniversity').get(function () {
    return this.paymentType === INVOICE_PAYMENT_TYPE.UNIVERSITY;
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Assign an accountant to this invoice
 * @param {ObjectId} accountantId - Accountant user ID
 */
invoiceSchema.methods.assignAccountant = function (accountantId) {
    if (!accountantId) {
        throw new Error('Accountant ID is required');
    }
    this.accountantId = accountantId;
    return this.save();
};

/**
 * Mark student as contacted
 * @param {ObjectId} userId - User who contacted
 * @param {string} notes - Optional contact notes
 */
invoiceSchema.methods.markStudentContacted = function (userId, notes = null) {
    if (this.paymentType !== INVOICE_PAYMENT_TYPE.DIRECT) {
        throw new Error('Student contact only applicable for DIRECT payment type');
    }
    if (this.studentContacted) {
        throw new Error('Student already marked as contacted');
    }

    this.studentContacted = true;
    this.studentContactedAt = new Date();
    this.studentContactedBy = userId;
    this.status = INVOICE_STATUS.STUDENT_CONTACTED;
    if (notes) {
        this.contactNotes = notes;
    }
    return this.save();
};

/**
 * Record payment information
 * @param {ObjectId} userId - User recording payment
 * @param {Object} paymentInfo - Payment details
 */
invoiceSchema.methods.recordPayment = function (userId, paymentInfo) {
    const { paymentMethod, transactionId, filePath, fileName, notes } = paymentInfo;

    if (!paymentMethod) {
        throw new Error('Payment method is required');
    }

    if (paymentMethod === PAYMENT_METHOD.ONLINE) {
        if (!transactionId) {
            throw new Error('Transaction ID is required for online payments');
        }
        if (!filePath) {
            throw new Error('Receipt/screenshot file is required for online payments');
        }
    }

    if (this.status === INVOICE_STATUS.APPROVED) {
        throw new Error('Invoice is already approved');
    }
    if (this.status === INVOICE_STATUS.CANCELLED) {
        throw new Error('Cannot record payment for cancelled invoice');
    }

    this.paymentTracking = {
        paymentMethod,
        transactionId: transactionId || null,
        filePath: filePath || null,
        fileName: fileName || null,
        recordedAt: new Date(),
        recordedBy: userId,
        notes: notes || null
    };

    this.status = INVOICE_STATUS.PAYMENT_RECEIVED;
    return this.save();
};

/**
 * Approve the invoice
 * @param {ObjectId} userId - User approving
 */
invoiceSchema.methods.approve = function (userId) {
    if (this.status === INVOICE_STATUS.APPROVED) {
        throw new Error('Invoice is already approved');
    }
    if (this.status === INVOICE_STATUS.CANCELLED) {
        throw new Error('Cannot approve a cancelled invoice');
    }

    // For DIRECT payments, payment must be recorded first
    if (this.paymentType === INVOICE_PAYMENT_TYPE.DIRECT && !this.paymentTracking) {
        throw new Error('Payment must be recorded before approving DIRECT invoices');
    }

    this.status = INVOICE_STATUS.APPROVED;
    this.approvedAt = new Date();
    this.approvedBy = userId;
    return this.save();
};

/**
 * Cancel the invoice
 * @param {ObjectId} userId - User cancelling
 * @param {string} reason - Cancellation reason
 */
invoiceSchema.methods.cancel = function (userId, reason = null) {
    if (this.status === INVOICE_STATUS.APPROVED) {
        throw new Error('Cannot cancel an approved invoice');
    }
    if (this.status === INVOICE_STATUS.CANCELLED) {
        throw new Error('Invoice is already cancelled');
    }

    this.status = INVOICE_STATUS.CANCELLED;
    this.cancelledAt = new Date();
    this.cancelledBy = userId;
    if (reason) {
        this.cancellationReason = reason;
    }
    return this.save();
};

/**
 * Add or update breakdown items
 * @param {Array} items - Array of breakdown items
 */
invoiceSchema.methods.setBreakdown = function (items) {
    if (!Array.isArray(items)) {
        throw new Error('Breakdown must be an array');
    }

    const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    if (Math.abs(total - this.amount) >= 0.01) {
        throw new Error(`Breakdown total (${total}) must equal invoice amount (${this.amount})`);
    }

    this.breakdown = items;
    return this.save();
};

/**
 * Update amount and currency
 * @param {number} amount - New amount
 * @param {string} currency - New currency (optional)
 */
invoiceSchema.methods.updateAmount = function (amount, currency = null) {
    if (this.status === INVOICE_STATUS.APPROVED) {
        throw new Error('Cannot update amount of approved invoice');
    }
    if (this.status === INVOICE_STATUS.CANCELLED) {
        throw new Error('Cannot update amount of cancelled invoice');
    }

    if (amount < 0) {
        throw new Error('Amount cannot be negative');
    }

    this.amount = amount;
    if (currency) {
        if (!Object.values(CURRENCY).includes(currency)) {
            throw new Error('Invalid currency');
        }
        this.currency = currency;
    }

    // Clear breakdown if amount changed
    if (this.breakdown.length > 0) {
        this.breakdown = [];
    }

    return this.save();
};

/**
 * Set due date
 * @param {Date} dueDate
 */
invoiceSchema.methods.setDueDate = function (dueDate) {
    if (dueDate && new Date(dueDate) <= new Date()) {
        throw new Error('Due date must be in the future');
    }
    this.dueDate = dueDate;
    return this.save();
};

/**
 * Soft delete the invoice
 */
invoiceSchema.methods.softDelete = function () {
    this.deletedAt = new Date();
    return this.save();
};

/**
 * Restore soft deleted invoice
 */
invoiceSchema.methods.restore = function () {
    this.deletedAt = null;
    return this.save();
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Create a new invoice for an application
 * @param {Object} data - Invoice data
 */
invoiceSchema.statics.createInvoice = async function (data) {
    const {
        applicationId,
        accountantId = null,
        paymentType,
        amount,
        currency = CURRENCY.USD,
        breakdown = [],
        dueDate = null,
        notes = null
    } = data;

    return this.create({
        applicationId,
        accountantId,
        paymentType,
        amount,
        currency,
        breakdown,
        dueDate,
        notes,
        issuedAt: new Date()
    });
};

/**
 * Find invoices by application
 * @param {ObjectId} applicationId
 */
invoiceSchema.statics.findByApplication = function (applicationId) {
    return this.find({ applicationId }).sort({ issuedAt: -1 });
};

/**
 * Find invoices assigned to an accountant
 * @param {ObjectId} accountantId
 * @param {string} status - Optional status filter
 */
invoiceSchema.statics.findByAccountant = function (accountantId, status = null) {
    const query = { accountantId };
    if (status) {
        query.status = status;
    }
    return this.find(query).sort({ issuedAt: -1 });
};

/**
 * Find pending invoices for accountants
 * @param {string} paymentType - Optional filter by payment type
 */
invoiceSchema.statics.findPending = function (paymentType = null) {
    const query = {
        status: { $in: [INVOICE_STATUS.PENDING, INVOICE_STATUS.STUDENT_CONTACTED, INVOICE_STATUS.PAYMENT_RECEIVED] }
    };
    if (paymentType) {
        query.paymentType = paymentType;
    }
    return this.find(query).sort({ issuedAt: 1 });
};

/**
 * Find overdue invoices
 */
invoiceSchema.statics.findOverdue = function () {
    return this.find({
        dueDate: { $lt: new Date() },
        status: { $nin: [INVOICE_STATUS.APPROVED, INVOICE_STATUS.CANCELLED] }
    }).sort({ dueDate: 1 });
};

/**
 * Find approved invoices for an application
 * @param {ObjectId} applicationId
 */
invoiceSchema.statics.findApprovedByApplication = function (applicationId) {
    return this.find({
        applicationId,
        status: INVOICE_STATUS.APPROVED
    }).sort({ approvedAt: -1 });
};

/**
 * Get total approved amount for an application
 * @param {ObjectId} applicationId
 * @param {string} currency - Optional currency filter
 */
invoiceSchema.statics.getTotalApproved = async function (applicationId, currency = null) {
    const match = {
        applicationId: new mongoose.Types.ObjectId(applicationId),
        status: INVOICE_STATUS.APPROVED
    };
    if (currency) {
        match.currency = currency;
    }

    const result = await this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$currency',
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);

    return result;
};

/**
 * Get invoice statistics
 * @param {Object} dateRange - Optional date range { start, end }
 */
invoiceSchema.statics.getStatistics = async function (dateRange = null) {
    const match = { deletedAt: null };

    if (dateRange) {
        match.issuedAt = {};
        if (dateRange.start) match.issuedAt.$gte = new Date(dateRange.start);
        if (dateRange.end) match.issuedAt.$lte = new Date(dateRange.end);
    }

    const result = await this.aggregate([
        { $match: match },
        {
            $group: {
                _id: {
                    status: '$status',
                    currency: '$currency'
                },
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: '$_id.status',
                currencies: {
                    $push: {
                        currency: '$_id.currency',
                        total: '$total',
                        count: '$count'
                    }
                },
                totalCount: { $sum: '$count' }
            }
        }
    ]);

    return result;
};

/**
 * Find invoices needing attention (not contacted for DIRECT)
 */
invoiceSchema.statics.findNeedingContact = function () {
    return this.find({
        paymentType: INVOICE_PAYMENT_TYPE.DIRECT,
        studentContacted: false,
        status: INVOICE_STATUS.PENDING
    }).sort({ issuedAt: 1 });
};

// ============================================
// JSON TRANSFORM
// ============================================
invoiceSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

invoiceSchema.set('toObject', { virtuals: true });

// ============================================
// EXPORT
// ============================================
const Invoice = model('Invoice', invoiceSchema);
export default Invoice;