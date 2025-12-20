import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';
import Country from '../models/Country/CountryModel.mjs';
import { T, X, P } from '../config/constants.mjs'

dotenv.config();

const seedCountries = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(T + 'Connected to MongoDB...');

        console.log(P + 'Fetching countries from API...');
        const response = await axios.get('https://restcountries.com/v3.1/all?fields=name,cca3');

        const countriesToInsert = response.data.map(c => ({
            name: c.name.common,
            code: c.cca3,
            consultantId: null,
            visitConsultantId: null,
            deactivatedAt: Date.now()
        }));

        console.log(P + 'Clearing existing countries...');
        await Country.deleteMany({});

        console.log(P + `Inserting ${countriesToInsert.length} countries...`);
        await Country.insertMany(countriesToInsert);

        console.log(T + 'Country seeding successful!');
        process.exit(0);
    } catch (error) {
        console.error(X + 'Country Seeding failed:', error.message);
        process.exit(1);
    }
};

seedCountries();