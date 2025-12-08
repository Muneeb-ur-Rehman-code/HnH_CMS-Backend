// seeders/SeederSample.mjs
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import bcrypt from 'bcryptjs';

import User from '../models/Users/_UsersMain.mjs';
import StaffProfile from '../models/Users/StaffProfile.mjs';
import ConsultantCountry from '../models/Users/ConsultantCountry.mjs';
import StudentProfile from '../models/Users/Student.mjs';
import Initial from '../models/initial/Initial.mjs';
import Application from '../models/Process/Process.mjs';
import Invoice from '../models/Invoice/Invoice.mjs';
import Task from '../models/Task/Tasks.mjs';
import Document from '../models/Docx/Document.mjs';

import { USER_ROLE, USER_STATUS, USER_SOURCE } from '../models/Users/_UsersMain.mjs';
import { STAFF_ROLE, STAFF_VERIFICATION_STATUS } from '../models/Users/StaffProfile.mjs';
import { GENDER, EDUCATION_LEVEL, ENGLISH_TEST } from '../models/Users/Student.mjs';
import { INITIAL_SOURCE, INITIAL_STATUS } from '../models/initial/Initial.mjs';
import { APPLICATION_STATUS, INTAKE_PREFERENCE, CURRENCY } from '../models/Process/Process.mjs';
import { INVOICE_STATUS, INVOICE_PAYMENT_TYPE } from '../models/Invoice/Invoice.mjs';
import { TASK_STATUS, TASK_PRIORITY } from '../models/Task/Tasks.mjs';
import { DOCUMENT_TYPE, DOCUMENT_STATUS } from '../models/Docx/Document.mjs';

import { GREEN, RED, RESET, YELLOW, BLUE, CYAN, X, T, P } from '../config/constants.mjs';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Data storage
const createdData = {
    users: {},
    staffProfiles: {},
    studentProfiles: [],
    application: null,
    invoice: null,
    tasks: [],
    documents: []
};

// Unique identifier for seeded data
const SEEDER_ID = 'SAMPLE_SEED_DATA';
const COMMON_PHONE = '923001234567';
const SEEDED_EMAIL_DOMAINS = [
    'visaconsult.com',
    'stmail.com'
];

// ============================================ 
// UTILITY FUNCTIONS
// ============================================ 

function log(message, color = RESET) {
    console.log(`${color}${message}${RESET}`);
}

function success(message) {
    console.log(`${T}${GREEN}${message}${RESET}`);
}

function error(message) {
    console.log(`${X}${RED}${message}${RESET}`);
}

function progress(message) {
    console.log(`${P}${BLUE}${message}${RESET}`);
}

async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
}

// ============================================ 
// SEEDING FUNCTIONS
// ============================================ 

async function seedUsersAndProfiles() {
    progress('Seeding users and profiles...');

    const password = 'TestPassword123!';
    const hashedPassword = await hashPassword(password);

    const staffRoles = [
        STAFF_ROLE.ADMIN,
        STAFF_ROLE.MANAGER,
        STAFF_ROLE.CONSULTANT,
        STAFF_ROLE.ACCOUNTANT,
        STAFF_ROLE.AGENT,
        STAFF_ROLE.RECEPTIONIST
    ];

    // Create 2 users for each staff role
    for (const staffRole of staffRoles) {
        for (let i = 1; i <= 2; i++) {
            const firstName = `${staffRole}${i == 1 ? 'st' : 'nd'}`;
            const lastName = 'User';
            const email = `${staffRole.toLowerCase()}${i}@visaconsult.com`;

            const user = await User.create({
                email,
                password: hashedPassword,
                firstName,
                lastName,
                role: USER_ROLE.STAFF,
                status: USER_STATUS.ACTIVE,
                source: USER_SOURCE.ONLINE,
                emailOtp: { verified: true },
                phone: { number: COMMON_PHONE, otp: { verified: true } },
                dob: new Date('1990-01-01'),
                gender: GENDER.MALE
            });

            const staffProfile = await StaffProfile.create({
                userId: user._id,
                staffRole: staffRole,
                verificationStatus: STAFF_VERIFICATION_STATUS.VERIFIED
            });

            if (!createdData.users[staffRole]) {
                createdData.users[staffRole] = [];
            }
            if (!createdData.staffProfiles[staffRole]) {
                createdData.staffProfiles[staffRole] = [];
            }
            createdData.users[staffRole].push(user);
            createdData.staffProfiles[staffRole].push(staffProfile);
        }
    }

    // Create 2 student accounts
    for (let i = 1; i <= 2; i++) {
        const firstName = `Student${i == 1 ? 'st' : 'nd'}`;
        const lastName = 'User';
        const email = `student${i}@stmail.com`;

        const user = await User.create({
            email,
            password: hashedPassword,
            firstName,
            lastName,
            role: USER_ROLE.STUDENT,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.ONLINE,
            emailOtp: { verified: true },
            phone: { number: COMMON_PHONE, otp: { verified: true } },
            dob: new Date('2002-05-10'),
            gender: GENDER.MALE
        });

        const studentProfile = await StudentProfile.create({
            userId: user._id,
            nationality: 'Pakistani',
            passportNumber: `PASS${Math.floor(1000000 + Math.random() * 9000000)}`,
            passportExpiry: new Date('2032-01-01'),
            address: {
                street: '123 University Road',
                city: 'Lahore',
                state: 'Punjab',
                postalCode: '54000',
                country: 'Pakistan'
            },
            educationLevel: EDUCATION_LEVEL.BACHELORS,
            currentInstitution: 'University of Punjab',
            graduationYear: 2023,
            lastGPA: 3.7,
            englishProficiency: {
                testType: ENGLISH_TEST.IELTS,
                overallScore: 7.5
            }
        });

        createdData.studentProfiles.push({ user, profile: studentProfile });
    }

    success(`Created ${staffRoles.length * 2} staff users and 2 student users.`);
}

async function seedConsultantCountries() {
    progress('Seeding consultant countries...');
    const consultantProfiles = createdData.staffProfiles[STAFF_ROLE.CONSULTANT];

    if (consultantProfiles && consultantProfiles.length > 0) {
        for (const consultantProfile of consultantProfiles) {
            await ConsultantCountry.create({
                staffProfileId: consultantProfile._id,
                country: 'United Kingdom'
            });

            await ConsultantCountry.create({
                staffProfileId: consultantProfile._id,
                country: 'Canada'
            });
        }
        success(`Assigned countries to ${consultantProfiles.length} consultants.`);
    }
}

async function seedApplication() {
    progress('Seeding applications...');

    if (createdData.studentProfiles.length === 0) {
        success('No student profiles found. Skipping applications.');
        return;
    }

    const firstStudent = createdData.studentProfiles[0];
    const consultants = createdData.users[STAFF_ROLE.CONSULTANT];
    const consultant = consultants ? consultants[0] : null;

    if (!consultant || !firstStudent.profile) {
        success('Missing consultant or student profile. Skipping applications.');
        return;
    }

    const application = await Application.create({
        userId: firstStudent.user._id,
        consultantId: consultant._id,
        email: firstStudent.user.email,
        firstName: firstStudent.user.firstName,
        lastName: firstStudent.user.lastName,
        phoneNumber: COMMON_PHONE,
        nationality: 'Pakistani',
        passportNumber: firstStudent.profile.passportNumber,
        passportExpiry: firstStudent.profile.passportExpiry,
        address: firstStudent.profile.address,
        educationLevel: firstStudent.profile.educationLevel,
        targetCountry: 'United Kingdom',
        targetUniversity: 'Imperial College London',
        targetCourse: 'MSc Artificial Intelligence',
        intakePreference: INTAKE_PREFERENCE.FALL,
        budget: {
            amount: 40000,
            currency: CURRENCY.GBP
        },
        status: APPLICATION_STATUS.INVOICE_PENDING
    });

    createdData.application = application;
    success('Created 1 application.');
}

async function seedInvoice() {
    progress('Seeding invoice...');

    if (!createdData.application) {
        success('No application found. Skipping invoice.');
        return;
    }

    const accountants = createdData.users[STAFF_ROLE.ACCOUNTANT];
    const accountant = accountants ? accountants[0] : null;

    if (!accountant) {
        success('No accountant found. Skipping invoice.');
        return;
    }

    const invoice = await Invoice.create({
        applicationId: createdData.application._id,
        accountantId: accountant._id,
        paymentType: INVOICE_PAYMENT_TYPE.DIRECT,
        amount: 2500,
        currency: CURRENCY.GBP,
        breakdown: [
            { description: 'Consultation Fee', amount: 1500 },
            { description: 'Application Processing', amount: 1000 }
        ],
        status: INVOICE_STATUS.PENDING,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // 10 days from now
    });

    createdData.invoice = invoice;
    success('Created 1 invoice.');
}

async function seedTasks() {
    progress('Seeding tasks...');

    if (!createdData.application || createdData.studentProfiles.length === 0) {
        success('Missing application or student. Skipping tasks.');
        return;
    }

    const student = createdData.studentProfiles[0].user;
    const consultants = createdData.users[STAFF_ROLE.CONSULTANT];
    const consultant = consultants ? consultants[0] : null;

    if (!consultant) {
        success('No consultant found. Skipping tasks.');
        return;
    }

    const tasks = [
        {
            applicationId: createdData.application._id,
            title: 'Finalize Statement of Purpose',
            description: 'Review and finalize the SOP draft.',
            status: TASK_STATUS.IN_PROGRESS,
            priority: TASK_PRIORITY.HIGH,
            createdBy: consultant._id,
            assignedTo: student._id,
            visibleToStudent: true,
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        },
        {
            applicationId: createdData.application._id,
            title: 'Verify Financial Documents',
            description: 'Internal verification of submitted bank statements.',
            status: TASK_STATUS.PENDING,
            priority: TASK_PRIORITY.MEDIUM,
            createdBy: consultant._id,
            assignedTo: consultant._id,
            visibleToStudent: false
        }
    ];

    for (const taskData of tasks) {
        const task = await Task.create(taskData);
        createdData.tasks.push(task);
    }
    success(`Created ${createdData.tasks.length} tasks.`);
}

async function seedDocuments() {
    progress('Seeding documents...');

    if (!createdData.application || createdData.studentProfiles.length === 0) {
        success('Missing application or student. Skipping documents.');
        return;
    }

    const student = createdData.studentProfiles[0].user;
    const consultants = createdData.users[STAFF_ROLE.CONSULTANT];
    const consultant = consultants ? consultants[0] : null;

    if (!consultant) {
        success('No consultant found. Skipping documents.');
        return;
    }

    const documents = [
        {
            applicationId: createdData.application._id,
            documentType: DOCUMENT_TYPE.PASSPORT,
            name: 'Passport Scan',
            filePath: 'uploads/sample/passport.jpg',
            fileName: 'passport.jpg',
            status: DOCUMENT_STATUS.VERIFIED,
            uploadedBy: student._id,
            verifiedBy: consultant._id
        },
        {
            applicationId: createdData.application._id,
            documentType: DOCUMENT_TYPE.ACADEMIC_TRANSCRIPT,
            name: 'Bachelors Transcript',
            filePath: 'uploads/sample/transcript.pdf',
            fileName: 'transcript.pdf',
            status: DOCUMENT_STATUS.UPLOADED,
            uploadedBy: student._id
        }
    ];

    for (const docData of documents) {
        const doc = await Document.create(docData);
        createdData.documents.push(doc);
    }
    success(`Created ${createdData.documents.length} documents.`);
}

// ============================================ 
// MAIN SEEDER FUNCTION
// ============================================ 

async function seedDatabase({ exitOnFinish = false } = {}) {
    try {
        console.log('\n' + '='.repeat(60));
        log('SAMPLE DATABASE SEEDER (MULTI-ACCOUNT SETUP)', CYAN);
        console.log('='.repeat(60) + '\n');

        const MONGO_URI = process.env.MONGO_URI;
        if (!MONGO_URI) {
            error('MONGO_URI not found in environment variables');
            if (exitOnFinish) process.exit(1);
            throw new Error('MONGO_URI not found in environment variables');
        }

        progress('Connecting to database...');
        await mongoose.connect(MONGO_URI);
        success('Connected to database\n');

        progress('Clearing existing seeded data...');
        // Build email regex patterns for seeded accounts
        const emailPattern = new RegExp(`(@(${SEEDED_EMAIL_DOMAINS.join('|')})$)`, 'i');

        // Delete seeded users by email pattern
        const deletedUsers = await User.deleteMany({ email: emailPattern });

        // Delete related data
        await Promise.all([
            StaffProfile.deleteMany({}),
            ConsultantCountry.deleteMany({}),
            StudentProfile.deleteMany({}),
            Initial.deleteMany({}),
            Application.deleteMany({}),
            Invoice.deleteMany({}),
            Task.deleteMany({}),
            Document.deleteMany({})
        ]);
        success('Existing seeded data cleared\n');

        // Seed data
        await seedUsersAndProfiles();
        await seedConsultantCountries();


        console.log('\n' + '='.repeat(60));
        success('DATABASE SEEDING COMPLETED SUCCESSFULLY');
        console.log('='.repeat(60) + '\n');

    } catch (err) {
        console.error('\n');
        error('ERROR during seeding:');
        console.error(err);
        if (exitOnFinish) process.exit(1);
        throw err;
    } finally {
        await mongoose.disconnect();
        log('Disconnected from database');
        if (exitOnFinish) process.exit(0);
    }
}

// Exports for programmatic usage
export { seedDatabase };
export default seedDatabase;

// If this file is run directly from the command line, run with process exit handling
if (process.argv[1] === __filename) {
    seedDatabase({ exitOnFinish: true });
}
