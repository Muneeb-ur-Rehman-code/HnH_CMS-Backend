import mongoose from 'mongoose';
import 'dotenv/config';
import { X, T  } from './constants.mjs';

const connectDB = async () => {

    //============================================= CHECK ENV
    if (!process.env.MONGO_URI) {
        console.error(X + 'FATAL ERROR: MONGO_URI environment variable is not set.\n\n');
        process.exit(1);
    }

    //============================================= TRY TO CONNECT


    try {

        const conn = await mongoose.connect(process.env.MONGO_URI, {});

        console.log(T + `MongoDB Connected: ${conn.connection.host}`);

    }

    //============================================= IF FAILED

    catch (error) {

        console.error(X + `FATAL ERROR: MongoDB Connection Error: ${error.message} \n\n`);
        process.exit(1);

    }

};

export default connectDB;