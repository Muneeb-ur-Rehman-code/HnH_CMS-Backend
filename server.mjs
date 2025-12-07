//====================================================PACKAGE IMPORTS

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

//====================================================FILES IMPORTS

import connectDB from './config/db.mjs';
import { X, T, P } from './config/constants.mjs';
import { logger } from './utils/logger.mjs';
import { verifyEmailConnection } from './utils/emailService.mjs';
// import { sendNotificationEmail } from './utils/emailService.mjs';


//====================================================INITIALIZATION

dotenv.config({ quiet: true });
const app = express();
app.use(cors());
app.use(express.json());
app.use(logger(false));

//====================================================GLOBAL MIDDLEWARES

//

//====================================================API ROUTES 

//

//====================================================BUILD FOLDER SERVE

//

//====================================================HEALTH CHECK DIRECT API'S


app.get(['/', '/health', '/health-check'], (req, res) => { res.json({ message: 'Health OK' }); });


//====================================================APP LISTEN PORT


const PORT = process.env.PORT;
const startServer = async () => {
    console.log('\n\n' + P + 'Connecting to MongoDB...');
    await connectDB();
    await verifyEmailConnection();

    // test email credentials and send an email to yourself here
    // await sendNotificationEmail(
    //     'user@example.com',
    //     'Your document has been reviewed and approved. Please check your dashboard for next steps.'
    // );



    app.listen(PORT, () => { console.log(T + `Server is running on port ${PORT}`); });
};
startServer();


//====================================================
