//====================================================PACKAGE IMPORTS

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

//====================================================DEVELOPMENT THINGS

import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger-output.json' with { type: "json" };
import seedDatabase from './seeds/seeder-Sample.mjs';

//====================================================FILES IMPORTS

import connectDB from './config/db.mjs';
import { X, T, P } from './config/constants.mjs';
import { logger } from './utils/logger.mjs';
import { verifyEmailConnection } from './utils/emailService.mjs';
import { verifySMSConnection } from './utils/smsService.mjs';
// import { sendNotificationEmail } from './utils/emailService.mjs';
// import { sendOTPviaSMS } from './utils/smsService.mjs';
import routes from "./routes/Routes.mjs"

//====================================================INITIALIZATION

dotenv.config({ quiet: true });
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- CORS (explicit, browser-friendly for SPA + Authorization preflight) ---
// Default: allow any Origin (reflected). Set CORS_ORIGINS="https://a.com,https://b.com" to restrict.
const corsOriginsEnv = process.env.CORS_ORIGINS;
const corsAllowList =
    corsOriginsEnv && corsOriginsEnv !== '*'
        ? corsOriginsEnv.split(',').map((s) => s.trim()).filter(Boolean)
        : null;

const corsOptions = {
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (corsAllowList && corsAllowList.length > 0) {
            if (corsAllowList.includes(origin)) return callback(null, true);
            return callback(new Error(`CORS: origin not allowed: ${origin}`));
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    // Omit allowedHeaders so preflight mirrors Access-Control-Request-Headers (avoids blocking custom headers)
    exposedHeaders: ['Content-Length', 'Content-Type'],
    maxAge: 86_400,
    optionsSuccessStatus: 204,
};

//====================================================GLOBAL MIDDLEWARES

app.use(cors(corsOptions));
app.use(express.json());
app.use(logger(false));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//====================================================Development api docs

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

//====================================================API ROUTES

app.use('/api', routes);

//====================================================HEALTH CHECK DIRECT API'S

app.get(['/', '/health', '/health-check'], (req, res) => { res.json({ message: 'Health OK' }); });

//====================================================BUILD FOLDER SERVE

//

//====================================================RUN SAMPLE SEED (DEVELOPMENT ONLY)

app.get('/run-sample-seed', async (req, res) => {
    // if (process.env.NODE_ENV !== 'development') {
        return res.status(403).send(X + 'Forbidden')
    // };
    // try {
        // const summarydata = await seedDatabase();
        // const { summary, Responce } = await seedDatabase({ exitOnFinish: false });
        // if (summary) console.log(summary);
        // res.status(200).send(Responce);
    // } catch (e) {
        // res.status(500).send(e.message);
    // }
});

//====================================================404 + 500 Handle

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error (wee woo waa whops!!)',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

//====================================================APP LISTEN PORT


const PORT = process.env.PORT;
const startServer = async () => {
    console.log('\n\n' + P + 'Connecting to MongoDB...');
    await connectDB();
    await verifyEmailConnection();
    // await verifySMSConnection();

    // test email credentials and send an email to yourself here
    // await sendNotificationEmail(
    //     'user@example.com',
    //     'Your document has been reviewed and approved. Please check your dashboard for next steps.'
    // );

    // test SMS otp
    // sendOTPviaSMS("+923197877750", "4586");


    app.listen(PORT, () => { console.log(T + `Server is running on port ${PORT}`); });
};
startServer();


//====================================================
