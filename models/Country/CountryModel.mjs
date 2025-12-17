import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const countrySchema = new Schema(
    {
        name: {
            type: String,
            required: [true, 'name is required'],
            lowercase: true,
            trim: true,
            index: true
        },
        code: {
            type: String,
            required: [true, 'code is required'],
            uppercase: true,
            trim: true,
            match: [/^[A-Z]{3}$/, 'Code must be exactly 3 uppercase letters.'],
        },
        consultantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StaffProfile',
            required: [true, 'consultantId (Study) is required'],
            index: true
        },
        visitConsultantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StaffProfile',
            required: [true, 'consultantId (Visit Visa) is required'],
            index: true
        },
        deactivatedAt: {
            type: Date,
            default: null,
            index: true
        }

    }, { timestamps: true }
);

countrySchema.index({ createdAt: -1 });
countrySchema.index({ name: 'text', code: 'text' });
countrySchema.index({ code: 1 }, { unique: true });

countrySchema.pre(/^find/, function () {
    if (this.getOptions().includeDeactivated !== true) {
        this.where({ deactivatedAt: null });
    }
});


countrySchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

countrySchema.set('toObject', { virtuals: true });

export default model('Country', countrySchema);