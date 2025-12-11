const mongoose = require('mongoose');

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
// universitySchema.index( { shortName: 1 }, { unique: true, partialFilterExpression: { deactivatedAt: null } } );
universitySchema.index({ name: 'text', shortName: 'text', state: 'text', city: 'text' });

universitySchema.pre(/^find/, function () {
    if (this.getOptions().includeDeactivated !== true) {
        this.where({ deactivatedAt: null });
    }
});

const validateAndFormatUniversity = (data) => {
    if (data.shortName) {
        const cleanShortName = data.shortName.toUpperCase().trim();
        if (!/^[A-Z0-9]{3,10}$/.test(cleanShortName)) {
            const error = new Error('Short name must be 3 to 10 uppercase alphanumeric characters.');
            error.status = 400;
            error.code = 'INVALID_SHORT_NAME';
            error.success = false;
            throw error;
        }
        data.shortName = cleanShortName;
    }

    if (data.country && !mongoose.Types.ObjectId.isValid(data.country)) {
        const error = new Error('Invalid Country ID format.');
        error.status = 400;
        error.code = 'INVALID_COUNTRY_ID';
        error.success = false;
        throw error;
    }

    return data;
};

universitySchema.statics.createUniversity = async function (universityData) {
    if (!universityData || !universityData.name) {
        const error = new Error('University name is required.');
        error.status = 400;
        error.code = 'NAME_REQUIRED';
        error.success = false;
        throw error;
    }
    if (!universityData.shortName) {
        const error = new Error('University short name is required.');
        error.status = 400;
        error.code = 'SHORT_NAME_REQUIRED';
        error.success = false;
        throw error;
    }
    if (!universityData.country) {
        const error = new Error('Country ID is required.');
        error.status = 400;
        error.code = 'COUNTRY_ID_REQUIRED';
        error.success = false;
        throw error;
    }
    if (!universityData.state) {
        const error = new Error('State/Province is required.');
        error.status = 400;
        error.code = 'STATE_REQUIRED';
        error.success = false;
        throw error;
    }
    if (!universityData.city) {
        const error = new Error('City is required.');
        error.status = 400;
        error.code = 'CITY_REQUIRED';
        error.success = false;
        throw error;
    }

    try {
        const validatedData = validateAndFormatUniversity(universityData);

        const Country = model('Country');
        const country = await Country.findById(validatedData.country);

        if (!country) {
            const error = new Error('Cannot create university: Country is not found or is deactivated.');
            error.status = 404;
            error.code = 'COUNTRY_INACTIVE';
            error.success = false;
            throw error;
        }

        const newUniversity = await this.create(validatedData);
        return newUniversity;
    } catch (e) {
        if (e.code === 11000) {
            const error = new Error('A university with this short name already exists.');
            error.status = 409;
            error.code = 'DUPLICATE_SHORT_NAME';
            error.success = false;
            throw error;
        }
        throw e;
    }
};





universitySchema.statics.getAllActiveUniversities = async function () {
    return this.find({}).populate('country').sort({ name: 1 });
};

universitySchema.statics.getActiveUniversitiesByCountry = async function (countryId) {
    if (!countryId) {
        const error = new Error('Country ID is required to filter universities.');
        error.status = 400;
        error.code = 'COUNTRY_ID_REQUIRED';
        error.success = false;
        throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(countryId)) {
        const error = new Error('Invalid Country ID format.');
        error.status = 400;
        error.code = 'INVALID_COUNTRY_ID';
        error.success = false;
        throw error;
    }

    const universities = await this.find({ country: countryId }).populate('country').sort({ name: 1 });

    if (universities.length === 0) {
        const error = new Error(`No active universities found for country ID: ${countryId}.`);
        error.status = 404;
        error.code = 'NOT_FOUND';
        error.success = false;
        throw error;
    }
    return universities;
};

universitySchema.statics.searchActiveUniversities = async function (searchTerm) {
    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim().length < 2) {
        const error = new Error('Search term must be at least 2 characters long.');
        error.status = 400;
        error.code = 'INVALID_SEARCH_TERM';
        error.success = false;
        throw error;
    }

    const term = searchTerm.trim();

    // Attempt 1: Exact matches or shortName match (case-insensitive for name, case-sensitive for shortName after upcasing)
    let initialQuery = {
        deactivatedAt: null,
        $or: [
            { name: { $regex: new RegExp(term, 'i') } }, // Case-insensitive name match
            { shortName: term.toUpperCase() }           // Exact shortName match
        ]
    };

    let results = await this.find(initialQuery).populate('country').limit(10);
    let uniqueResultsMap = new Map();
    results.forEach(doc => uniqueResultsMap.set(doc._id.toString(), doc.toObject()));


    // Attempt 2: Text search for wider results
    if (results.length < 10) {
        const textResults = await this.find(
            {
                $text: { $search: term },
                deactivatedAt: null,
                _id: { $nin: Array.from(uniqueResultsMap.keys()) }
            },
            { score: { $meta: 'textScore' } }
        )
            .populate('country')
            .sort({ score: { $meta: 'textScore' } })
            .limit(10 - uniqueResultsMap.size);

        textResults.forEach(doc => uniqueResultsMap.set(doc._id.toString(), doc.toObject()));
    }

    const finalResults = Array.from(uniqueResultsMap.values());

    if (finalResults.length === 0) {
        const error = new Error('No active universities matched the search term.');
        error.status = 404;
        error.code = 'NOT_FOUND';
        error.success = false;
        throw error;
    }

    return finalResults;
};







universitySchema.statics.deactivateUniversity = async function (id, deleteFileFn) {
    if (!id) {
        const error = new Error('University ID is required for deactivation.');
        error.status = 400;
        error.code = 'ID_REQUIRED';
        error.success = false;
        throw error;
    }

    const university = await this.findById(id);

    if (!university) {
        const error = new Error('Active university not found or already deactivated.');
        error.status = 404;
        error.code = 'NOT_FOUND';
        error.success = false;
        throw error;
    }

    // Optional: Delete image if one exists
    if (university.imagePath && deleteFileFn) {
        const deleteResult = await deleteFileFn(university.imagePath);
        if (deleteResult.success) {
            university.imagePath = null; // Clear path after successful soft-delete/move
        } else {
            console.error(`Failed to soft-delete university image: ${deleteResult.message}`);
        }
    }

    university.deactivatedAt = new Date();
    await university.save();

    return university;
};

universitySchema.statics.activateUniversity = async function (id) {
    if (!id) {
        const error = new Error('University ID is required for activation.');
        error.status = 400;
        error.code = 'ID_REQUIRED';
        error.success = false;
        throw error;
    }

    // Find the university, including deactivated ones
    const university = await this.findOne({ _id: id }, null, { includeDeactivated: true });
    if (!university) {
        const error = new Error('University not found (active or deactivated).');
        error.status = 404;
        error.code = 'NOT_FOUND';
        error.success = false;
        throw error;
    }

    const Country = model('Country');
    // We check the country status explicitly, even if the country itself is deactivated
    const country = await Country.findOne({ _id: university.country }, null, { includeDeactivated: true });

    if (!country || country.deactivatedAt !== null) {
        const error = new Error('Cannot activate university: Parent country is currently deactivated.');
        error.status = 409;
        error.code = 'COUNTRY_INACTIVE';
        error.success = false;
        throw error;
    }

    university.deactivatedAt = null;
    const activatedUniversity = await university.save();

    return activatedUniversity;
};

universitySchema.statics.updateUniversity = async function (id, updateData, oldImagePath, deleteFileFn) {
    if (!id) {
        const error = new Error('University ID is required for update.');
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

    if (updateData.shortName || updateData.country) {
        validateAndFormatUniversity(updateData);
    }

    // Check if new country is active/exists
    if (updateData.country) {
        const Country = model('Country');
        const countryExists = await Country.findById(updateData.country);
        if (!countryExists) {
            const error = new Error('Cannot update: New Country ID not found or is deactivated.');
            error.status = 404;
            error.code = 'COUNTRY_INACTIVE';
            error.success = false;
            throw error;
        }
    }

    // Handle image path replacement/clearing
    if (updateData.imagePath === null && oldImagePath && deleteFileFn) {
        // Explicitly requesting image removal
        await deleteFileFn(oldImagePath);
        updateData.imagePath = null;
    } else if (updateData.imagePath && oldImagePath && updateData.imagePath !== oldImagePath && deleteFileFn) {
        // New image path replaces old one, soft-delete old one
        await deleteFileFn(oldImagePath);
    }

    try {
        const updatedUniversity = await this.findOneAndUpdate(
            { _id: id, deactivatedAt: null }, // Only update active ones
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('country');

        if (!updatedUniversity) {
            const error = new Error('Active university not found or already deactivated.');
            error.status = 404;
            error.code = 'NOT_FOUND';
            error.success = false;
            throw error;
        }
        return updatedUniversity;
    } catch (e) {
        if (e.code === 11000) {
            const error = new Error('The updated short name is already in use by another active university.');
            error.status = 409;
            error.code = 'DUPLICATE_SHORT_NAME';
            error.success = false;
            throw error;
        }
        throw e;
    }
};

universitySchema.statics.getDeactivatedUniversities = async function (countryId) {
    let query = { deactivatedAt: { $ne: null } };

    if (countryId) {
        if (!mongoose.Types.ObjectId.isValid(countryId)) {
            const error = new Error('Invalid Country ID format for filtering.');
            error.status = 400;
            error.code = 'INVALID_COUNTRY_ID';
            error.success = false;
            throw error;
        }
        query.country = countryId;
    }

    const results = await this.find(query, null, { includeDeactivated: true })
        .populate('country');

    if (results.length === 0) {
        const message = countryId
            ? `No deactivated universities found in country ID: ${countryId}.`
            : 'No deactivated universities found.';

        const error = new Error(message);
        error.status = 404;
        error.code = 'NOT_FOUND';
        error.success = false;
        throw error;
    }

    return results;
};






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

module.exports = model('University', universitySchema);