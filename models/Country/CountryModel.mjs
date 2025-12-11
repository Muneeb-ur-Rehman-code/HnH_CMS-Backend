const mongoose = require('mongoose');

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
            required: [true, 'consultantId is required - country must be assigned to a consultant'],
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
// countrySchema.index({ code: 1 }, { unique: true, partialFilterExpression: { deactivatedAt: null } });

countrySchema.pre(/^find/, function () {
    if (this.getOptions().includeDeactivated !== true) {
        this.where({ deactivatedAt: null });
    }
});

const validateAndFormatCountry = (data) => {
    if (data.code) {
        const cleanCode = data.code.toUpperCase().trim();
        if (!/^[A-Z]{3}$/.test(cleanCode)) {
            const error = new Error('Code must be exactly 3 uppercase letters (e.g., USA, PAK).');
            error.status = 400;
            error.code = 'INVALID_CODE';
            error.success = false;
            throw error;
        }
        data.code = cleanCode;
    }
    return data;
};

/**
 * Validate consultant is ACTIVE and has CONSULTANT role
 * @param {ObjectId} staffProfileId
 * @returns {Promise<Boolean>}
 */
const validateConsultantActive = async (staffProfileId) => {
    const StaffProfile = model('StaffProfile');
    const User = model('User');

    const staffProfile = await StaffProfile.findById(staffProfileId);
    if (!staffProfile) {
        const error = new Error('Consultant not found.');
        error.status = 404;
        error.code = 'CONSULTANT_NOT_FOUND';
        error.success = false;
        throw error;
    }

    // Check if staff role is CONSULTANT
    const STAFF_ROLE = { CONSULTANT: 'consultant', ACCOUNTANT: 'accountant', RECEPTIONIST: 'receptionist' };
    if (staffProfile.staffRole !== STAFF_ROLE.CONSULTANT) {
        const error = new Error('Only consultants can be assigned to countries.');
        error.status = 400;
        error.code = 'INVALID_STAFF_ROLE';
        error.success = false;
        throw error;
    }

    // Check if user is ACTIVE
    const user = await User.findById(staffProfile.userId);
    if (!user || user.status !== 'ACTIVE') {
        const error = new Error('Consultant must be ACTIVE to be assigned to a country.');
        error.status = 400;
        error.code = 'CONSULTANT_NOT_ACTIVE';
        error.success = false;
        throw error;
    }

    return true;
};

countrySchema.statics.createCountry = async function (countryData) {
    if (!countryData || !countryData.name) {
        const error = new Error('Country name is required.');
        error.status = 400;
        error.code = 'NAME_REQUIRED';
        error.success = false;
        throw error;
    }
    if (!countryData.code) {
        const error = new Error('Country code is required.');
        error.status = 400;
        error.code = 'CODE_REQUIRED';
        error.success = false;
        throw error;
    }
    if (!countryData.consultantId) {
        const error = new Error('Country must be assigned to a consultant (consultantId is required).');
        error.status = 400;
        error.code = 'CONSULTANT_ID_REQUIRED';
        error.success = false;
        throw error;
    }

    try {
        // Validate consultant is ACTIVE with CONSULTANT role
        await validateConsultantActive(countryData.consultantId);

        const validatedData = validateAndFormatCountry(countryData);
        const newCountry = await this.create(validatedData);
        return newCountry;
    } catch (e) {
        if (e.code === 11000) {
            const error = new Error('A country with this code already exists.');
            error.status = 409;
            error.code = 'DUPLICATE_CODE';
            error.success = false;
            throw error;
        }
        throw e;
    }
};

countrySchema.statics.getAllActiveCountries = async function () {
    return this.find({}).sort({ name: 1 });
};

countrySchema.statics.searchActiveCountries = async function (searchTerm) {
    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim().length < 2) {
        const error = new Error('Search term must be at least 2 characters long.');
        error.status = 400;
        error.code = 'INVALID_SEARCH_TERM';
        error.success = false;
        throw error;
    }

    const term = searchTerm.toLowerCase().trim();
    const uppercaseTerm = searchTerm.toUpperCase().trim();

    let query = {
        deactivatedAt: null,
        $or: [
            { name: term },
            { code: uppercaseTerm },
        ]
    };

    let results = await this.find(query).limit(10);
    let uniqueResultsMap = new Map();
    results.forEach(doc => uniqueResultsMap.set(doc._id.toString(), doc.toObject()));


    if (results.length < 10) {
        const textResults = await this.find(
            {
                $text: { $search: term },
                deactivatedAt: null,
                _id: { $nin: Array.from(uniqueResultsMap.keys()) }
            },
            { score: { $meta: 'textScore' } }
        )
            .sort({ score: { $meta: 'textScore' } })
            .limit(10 - uniqueResultsMap.size);

        textResults.forEach(doc => uniqueResultsMap.set(doc._id.toString(), doc.toObject()));
    }

    const finalResults = Array.from(uniqueResultsMap.values());

    if (finalResults.length === 0) {
        const error = new Error('No active countries matched the search term.');
        error.status = 404;
        error.code = 'NOT_FOUND';
        error.success = false;
        throw error;
    }

    return finalResults;
};

/**
 * Assign an ACTIVE consultant to this country (manager operation)
 * Only updates to another ACTIVE consultant with CONSULTANT role
 * @param {ObjectId} countryId
 * @param {ObjectId} staffProfileId
 * @returns {Promise<Country>}
 */
countrySchema.statics.assignConsultant = async function (countryId, staffProfileId) {
    if (!countryId || !staffProfileId) {
        const error = new Error('Country ID and Staff Profile ID are required.');
        error.status = 400;
        error.code = 'MISSING_PARAMS';
        error.success = false;
        throw error;
    }

    // Validate consultant is ACTIVE with CONSULTANT role
    await validateConsultantActive(staffProfileId);

    const updatedCountry = await this.findByIdAndUpdate(
        countryId,
        { $set: { consultantId: staffProfileId } },
        { new: true }
    );

    if (!updatedCountry) {
        const error = new Error('Country not found.');
        error.status = 404;
        error.code = 'NOT_FOUND';
        error.success = false;
        throw error;
    }

    return updatedCountry;
};

/**
 * Get consultant details for a country
 * @param {ObjectId} countryId
 * @returns {Promise<Object>} Country with populated consultant data
 */
countrySchema.statics.getCountryWithConsultant = async function (countryId) {
    if (!countryId) {
        const error = new Error('Country ID is required.');
        error.status = 400;
        error.code = 'ID_REQUIRED';
        error.success = false;
        throw error;
    }

    const country = await this.findById(countryId).populate('consultantId');

    if (!country) {
        const error = new Error('Country not found.');
        error.status = 404;
        error.code = 'NOT_FOUND';
        error.success = false;
        throw error;
    }

    return country;
};

/**
 * Get all countries assigned to a consultant
 * @param {ObjectId} staffProfileId
 * @returns {Promise<Country[]>}
 */
countrySchema.statics.getCountriesByConsultant = async function (staffProfileId) {
    if (!staffProfileId) {
        const error = new Error('Staff Profile ID is required.');
        error.status = 400;
        error.code = 'ID_REQUIRED';
        error.success = false;
        throw error;
    }

    return this.find({ consultantId: staffProfileId, deactivatedAt: null }).sort({ name: 1 });
};

countrySchema.statics.deactivateCountry = async function (id) {
    if (!id) {
        const error = new Error('Country ID is required for deactivation.');
        error.status = 400;
        error.code = 'ID_REQUIRED';
        error.success = false;
        throw error;
    }

    const University = model('University');
    await University.updateMany(
        { country: id, deactivatedAt: null },
        { $set: { deactivatedAt: new Date() } }
    );

    const deactivatedCountry = await this.findByIdAndUpdate(
        id,
        { $set: { deactivatedAt: new Date() } },
        { new: true }
    );

    if (!deactivatedCountry) {
        const error = new Error('Active country not found or already deactivated.');
        error.status = 404;
        error.code = 'NOT_FOUND';
        error.success = false;
        throw error;
    }

    return deactivatedCountry;
};

countrySchema.statics.activateCountry = async function (id) {
    if (!id) {
        const error = new Error('Country ID is required for activation.');
        error.status = 400;
        error.code = 'ID_REQUIRED';
        error.success = false;
        throw error;
    }

    const activatedCountry = await this.findByIdAndUpdate(
        id,
        { $set: { deactivatedAt: null } },
        { new: true, runValidators: true }
    );

    if (!activatedCountry) {
        const error = new Error('Deactivated country not found or already active.');
        error.status = 404;
        error.code = 'NOT_FOUND';
        error.success = false;
        throw error;
    }
    return activatedCountry;
};

countrySchema.statics.updateCountry = async function (id, updateData) {
    if (!id) {
        const error = new Error('Country ID is required for update.');
        error.status = 400;
        error.code = 'ID_REQUIRED';
        error.success = false;
        throw error;
    }
    if (!updateData || Object.keys(updateData).length === 0) {
        const error = new Error('Update data cannot be empty.');
        error.status = 400;
        error.code = 'DATA_EMPTY';
        error.success = false;
        throw error;
    }

    if (updateData.code) {
        validateAndFormatCountry(updateData);
    }

    const updatedCountry = await this.findOneAndUpdate(
        { _id: id },
        { $set: updateData },
        { new: true, runValidators: true }
    );

    if (!updatedCountry) {
        const error = new Error('Active country not found or already deactivated.');
        error.status = 404;
        error.code = 'NOT_FOUND';
        error.success = false;
        throw error;
    }

    return updatedCountry;
};

countrySchema.statics.getDeactivatedCountries = async function () {
    return this.find({ deactivatedAt: { $ne: null } }, null, { includeDeactivated: true });
};


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

module.exports = model('Country', countrySchema);