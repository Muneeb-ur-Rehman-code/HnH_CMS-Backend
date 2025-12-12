import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const universitySchema = new Schema(
    {
        name: {
            type: String,
            required: [true, 'name is required'],
            trim: true,
            index: true
        },
        shortName: {
            type: String,
            required: [true, 'shortName is required'],
            uppercase: true,
            trim: true,
        },
        imagePath: {
            type: String,
            default: null,
            trim: true,
        },
        country: {
            type: Schema.Types.ObjectId,
            ref: 'Country',
            required: [true, 'Country reference is required'],
            index: true
        },
        state: {
            type: String,
            required: [true, 'State/Province is required'],
            trim: true,
            index: true
        },
        city: {
            type: String,
            required: [true, 'City is required'],
            trim: true,
            index: true
        },
        zip: {
            type: String,
            trim: true,
            default: null
        },
        deactivatedAt: {
            type: Date,
            default: null,
            index: true
        }

    }, { timestamps: true }
);

universitySchema.index({ shortName: 1 }, { unique: true });
universitySchema.index({ name: 'text', shortName: 'text', state: 'text', city: 'text' });

universitySchema.pre(/^find/, function () {
    if (this.getOptions().includeDeactivated !== true) {
        this.where({ deactivatedAt: null });
    }
});

universitySchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

universitySchema.set('toObject', { virtuals: true });

export default model('University', universitySchema);
