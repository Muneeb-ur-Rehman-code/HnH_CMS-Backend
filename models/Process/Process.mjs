import mongoose from 'mongoose';

const ProcessSchema = new mongoose.Schema({

    InitialId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Initial',
        required: [true, 'Initial ID is required'],
        unique: [true, 'Initial ID already exists'],
    },

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    detailedData: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
 
    status: {
        type: String,
        enum: [
            'NOT_MADE_YET',     // Initial status when lead is approved but Application record isn't made
            'FORM_SUBMITTED',   // User filled pre-application form, awaiting consultant approval
            'INFO_GATHERED',    // Consultant confirmed initial data (becomes a 'real' Application)
            'INVOICE_GENERATED',
            'PAYMENT_PENDING',
            'PAYMENT_COMPLETE', // Consultant takes back control
            'DOCUMENTS_PENDING',// Consultant is gathering/verifying docs
            'DOCUMENTS_DONE',   // Ready for Backend Officer
            'WITH_BACKEND',     // Backend Officer processing visa/submission
            'VISA_PENDING',     
            'VISA_PROCESSING',  
            'VISA_DONE',     
            'ADMISSION_PENDING',   
            'ADMISSION_PROCESSING',
            'ADMISSION_DONE',     
            'SUBMITTED',        // Application officially submitted to University/Visa Office
            'COMPLETE',         // Final status
        ],
        default: 'NOT_MADE_YET',
        required: true,
    },

    consultantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    backendOfficerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    },

    AccountantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    }

}, { timestamps: true });

const Process = mongoose.model('Process', ProcessSchema);
export default Process;