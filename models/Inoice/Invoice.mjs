import mongoose from 'mongoose';

const PaymentTrackingSchema = new mongoose.Schema({
    filePath: {
        type: String,
        required: false,
    },
    paymentMethod: {
        type: String,
        required: false,
    },
    transactionId: {
        type: String,
        required: false,
    },
    transactionTime: {
        type: Date,
        required: false,
    },
}, { _id: false });

const InvoiceSchema = new mongoose.Schema({

    applicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Process',
        required: [true, 'Process ID is required'],
    },

    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount cannot be negative'],
    },

    currency: {
        type: String,
        required: [true, 'Currency is required'],
        enum: ['PKR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'],
        default: 'PKR',
    },

    breakdown: [{
        description: {
            type: String,
            required: [true, 'Description is required'],
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0, 'Amount cannot be negative'],
        },
    }],

    paymentType: {
        type: String,
        enum: ['STANDARD', 'UNIVERSITY_DELAYED'],
        default: 'STANDARD',
    },

    status: {
        type: String,
        enum: ['PENDING', 'PAYMENT_CONFIRMED', 'CANCELLED'],
        default: 'PENDING',
    },

    AccountantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Accountant ID is required'],
    },

    issuedAt: {
        type: Date,
        required: true,
        default: Date.now,
    },

    studentContacted: {
        type: Boolean,
        required: true,
        default: false,
    },

    paymentTracking: {
        type: PaymentTrackingSchema,
        required: false,
    },

    paymentConfirmedAt: {
        type: Date,
        required: false,
        set: function (v) {
            if (this.isNew || this.status === 'PENDING' || this.status === 'CANCELLED') {
                return v;
            }
            return this.paymentConfirmedAt;
        }
    },

}, {
    timestamps: true
});

InvoiceSchema.pre('save', function (next) {
    if (this.isModified('status') && this.status === 'PAYMENT_CONFIRMED' && !this.paymentConfirmedAt) {
        this.paymentConfirmedAt = Date.now();
    }
    next();
});

const Invoice = mongoose.model('Invoice', InvoiceSchema);
export default Invoice;