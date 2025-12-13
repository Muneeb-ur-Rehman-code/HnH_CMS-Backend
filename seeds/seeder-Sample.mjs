// seeds/seeder-Sample.mjs
import mongoose from 'mongoose';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Import colors and styles
import {
    GREEN,
    RED,
    YELLOW,
    BLUE,
    MAGENTA,
    CYAN,
    GRAY,
    RESET,
    T,
    X,
    P,
    E,
    A
} from '../config/constants.mjs';

// Import models
import User from '../models/Users/_UsersMain.mjs';
import StudentProfile from '../models/Users/Student.mjs';
import StaffProfile, { STAFF_ROLE, STAFF_VERIFICATION_STATUS } from '../models/Users/StaffProfile.mjs';
import Country from '../models/Country/CountryModel.mjs';
import University from '../models/University/UniModel.mjs';
import Initial, { INITIAL_STATUS, INITIAL_TYPE, INITIAL_SOURCE } from '../models/initial/Initial.mjs';
import Process, { PROCESS_STATUS, INTAKE_PREFERENCE, CURRENCY } from '../models/Process/Process.mjs';
import Task, { TASK_STATUS } from '../models/Task/Tasks.mjs';
import Invoice, { INVOICE_STATUS, INVOICE_PAYMENT_TYPE, PAYMENT_METHOD } from '../models/Invoice/Invoice.mjs';
import Document, { DOCUMENT_TYPE, DOCUMENT_STATUS } from '../models/Docx/Document.mjs';

// ============================================
// DATABASE CONNECTION
// ============================================
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {});
        console.log(T + `${GREEN}Database Connected${RESET}`);
        return true;
    } catch (error) {
        console.error(X + `${RED}Database Connection Error: ${error.message}${RESET}`);
        process.exit(1);
    }
};

// ============================================
// CONFIGURATION
// ============================================
const TEST_PASSWORD = 'Test@12345';
const PASSWORD_SALT_ROUNDS = 12;

// Sample country data
const COUNTRIES_DATA = [
    { name: 'United Kingdom', code: 'GBR' },
    { name: 'United States', code: 'USA' },
    { name: 'Canada', code: 'CAN' },
    { name: 'Australia', code: 'AUS' },
    { name: 'New Zealand', code: 'NZL' },
    { name: 'Germany', code: 'DEU' },
    { name: 'Netherlands', code: 'NLD' },
    { name: 'Pakistan', code: 'PKR', isVisiting: true }
];

const UNIVERSITIES_DATA = {
    GBR: [
        { name: 'University of Oxford', shortName: 'OXFD', state: 'England', city: 'Oxford' },
        { name: 'University of Cambridge', shortName: 'CAMB', state: 'England', city: 'Cambridge' },
        { name: 'Imperial College London', shortName: 'ICLN', state: 'England', city: 'London' },
        { name: 'London School of Economics', shortName: 'LSEC', state: 'England', city: 'London' },
        { name: 'University of Manchester', shortName: 'MANC', state: 'England', city: 'Manchester' }
    ],
    USA: [
        { name: 'Harvard University', shortName: 'HARV', state: 'Massachusetts', city: 'Cambridge' },
        { name: 'Stanford University', shortName: 'STAN', state: 'California', city: 'Stanford' },
        { name: 'Massachusetts Institute of Technology', shortName: 'MITM', state: 'Massachusetts', city: 'Cambridge' },
        { name: 'Yale University', shortName: 'YALE', state: 'Connecticut', city: 'New Haven' },
        { name: 'Princeton University', shortName: 'PRIN', state: 'New Jersey', city: 'Princeton' }
    ],
    CAN: [
        { name: 'University of Toronto', shortName: 'UONT', state: 'Ontario', city: 'Toronto' },
        { name: 'McGill University', shortName: 'MCGL', state: 'Quebec', city: 'Montreal' },
        { name: 'University of British Columbia', shortName: 'UBCV', state: 'British Columbia', city: 'Vancouver' },
        { name: 'McMaster University', shortName: 'MCMC', state: 'Ontario', city: 'Hamilton' },
        { name: 'University of Alberta', shortName: 'UALB', state: 'Alberta', city: 'Edmonton' }
    ],
    AUS: [
        { name: 'University of Melbourne', shortName: 'UNMD', state: 'Victoria', city: 'Melbourne' },
        { name: 'University of Sydney', shortName: 'UNSY', state: 'New South Wales', city: 'Sydney' },
        { name: 'Australian National University', shortName: 'ANUS', state: 'Australian Capital Territory', city: 'Canberra' },
        { name: 'UNSW Sydney', shortName: 'UNSW', state: 'New South Wales', city: 'Sydney' },
        { name: 'Monash University', shortName: 'MNSH', state: 'Victoria', city: 'Clayton' }
    ],
    NZL: [
        { name: 'University of Auckland', shortName: 'UAAK', state: 'Auckland', city: 'Auckland' },
        { name: 'University of Otago', shortName: 'UOTA', state: 'Otago', city: 'Dunedin' },
        { name: 'Victoria University of Wellington', shortName: 'VUWL', state: 'Wellington', city: 'Wellington' },
        { name: 'Massey University', shortName: 'MSSU', state: 'Manawatu', city: 'Palmerston North' },
        { name: 'University of Canterbury', shortName: 'UCTR', state: 'Canterbury', city: 'Christchurch' }
    ],
    DEU: [
        { name: 'University of Berlin', shortName: 'UBLN', state: 'Berlin', city: 'Berlin' },
        { name: 'Heidelberg University', shortName: 'UHDG', state: 'Baden-Wurttemberg', city: 'Heidelberg' },
        { name: 'Technical University of Munich', shortName: 'TUMM', state: 'Bavaria', city: 'Munich' },
        { name: 'University of Hamburg', shortName: 'UHMB', state: 'Hamburg', city: 'Hamburg' },
        { name: 'University of Cologne', shortName: 'UCLN', state: 'North Rhine-Westphalia', city: 'Cologne' }
    ],
    NLD: [
        { name: 'University of Amsterdam', shortName: 'UAMM', state: 'North Holland', city: 'Amsterdam' },
        { name: 'Utrecht University', shortName: 'UUTR', state: 'Utrecht', city: 'Utrecht' },
        { name: 'Erasmus University Rotterdam', shortName: 'EROТ', state: 'South Holland', city: 'Rotterdam' },
        { name: 'University of Groningen', shortName: 'UGRN', state: 'Groningen', city: 'Groningen' },
        { name: 'Leiden University', shortName: 'ULDN', state: 'South Holland', city: 'Leiden' }
    ],
    PKR: [
        { name: 'FAST NUCES', shortName: 'FASTL', state: 'Punjab', city: 'Lahore' },
        { name: 'Lahore University of Management Sciences', shortName: 'LUML', state: 'Punjab', city: 'Lahore' },
        { name: 'Karachi University', shortName: 'UKRK', state: 'Sindh', city: 'Karachi' },
        { name: 'COMSATS University Islamabad', shortName: 'COMC', state: 'Islamabad Capital Territory', city: 'Islamabad' },
        { name: 'Pakistan Institute of Engineering and Applied Sciences', shortName: 'PIAS', state: 'Islamabad Capital Territory', city: 'Islamabad' }
    ]
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const hashPassword = async (password) => {
    return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
};

const generateOtp = () => {
    const code = '111111'; // Dev mode
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    return { code, hashedCode, expiresAt };
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// SEED FUNCTIONS
// ============================================

/**
 * Clear all data from database
 */
const clearDatabase = async () => {
    console.log(`\n${YELLOW}${P} Clearing database...${RESET}`);
    try {
        await Promise.all([
            User.deleteMany({}),
            StudentProfile.deleteMany({}),
            StaffProfile.deleteMany({}),
            Country.deleteMany({}),
            University.deleteMany({}),
            Initial.deleteMany({}),
            Process.deleteMany({}),
            Task.deleteMany({}),
            Invoice.deleteMany({}),
            Document.deleteMany({})
        ]);

        console.log(T + `${GREEN}Database cleared successfully${RESET}`);


        console.log(T + `${YELLOW}I WANT TO SLEEP FO 5 SECOND${RESET}`);

        console.log(T + `${YELLOW}5${RESET}`);
        await sleep(1000);
        console.log(T + `${YELLOW}4${RESET}`);
        await sleep(1000);
        console.log(T + `${YELLOW}3${RESET}`);
        await sleep(1000);
        console.log(T + `${YELLOW}2${RESET}`);
        await sleep(1000);
        console.log(T + `${YELLOW}1${RESET}`);
        await sleep(1000);

        console.log(T + `${GREEN}I AM AWAKE AGAIN ${RESET}`);
    } catch (error) {
        console.error(X + `${RED}Error clearing database: ${error.message}${RESET}`);
        throw error;
    }
};

/**
 * Create users (mix of students and staff)
 */
const createUsers = async () => {
    console.log(`\n${CYAN}${A} Creating users...${RESET}`);
    const users = [];

    // Create admin
    const adminHash = await hashPassword(TEST_PASSWORD);
    const admin = await User.create({
        email: 'admin@hnh.com',
        password: adminHash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'STAFF',
        status: 'ACTIVE',
        source: 'ONLINE',
        phone: {
            number: '923001111111',
            otp: { ...generateOtp(), verified: true }
        },
        emailOtp: { ...generateOtp(), verified: true }
    });
    users.push(admin);

    // Create managers
    for (let i = 1; i <= 2; i++) {
        const managerHash = await hashPassword(TEST_PASSWORD);
        const manager = await User.create({
            email: `manager${i}@hnh.com`,
            password: managerHash,
            firstName: `Manager`,
            lastName: String.fromCharCode(64 + i) + "Man",
            role: 'STAFF',
            status: 'ACTIVE',
            source: 'ONLINE',
            phone: {
                number: `9230011111${String(i).padStart(2, '0')}`,
                otp: { ...generateOtp(), verified: true }
            },
            emailOtp: { ...generateOtp(), verified: true }
        });
        users.push(manager);
    }

    // Create consultants
    for (let i = 1; i <= 7; i++) {
        const consultantHash = await hashPassword(TEST_PASSWORD);
        const consultant = await User.create({
            email: `consultant${i}@hnh.com`,
            password: consultantHash,
            firstName: `Consultant`,
            lastName: String.fromCharCode(64 + i) + "Con",
            role: 'STAFF',
            status: 'ACTIVE',
            source: 'ONLINE',
            phone: {
                number: `9230022222${String(i).padStart(2, '0')}`,
                otp: { ...generateOtp(), verified: true }
            },
            emailOtp: { ...generateOtp(), verified: true }
        });
        users.push(consultant);
    }

    // Create other staff (accountant, receptionist, agent)
    const staffRoles = ['ACCOUNTANT', 'RECEPTIONIST', 'AGENT'];
    let staffCounter = 0;
    for (const role of staffRoles) {
        for (let i = 1; i <= 2; i++) {
            staffCounter++;
            const staffHash = await hashPassword(TEST_PASSWORD);
            const staff = await User.create({
                email: `${role.toLowerCase()}${i}@hnh.com`,
                password: staffHash,
                firstName: role.charAt(0) + role.slice(1).toLowerCase(),
                lastName: String.fromCharCode(84 + staffCounter) + "Stf",
                role: 'STAFF',
                status: 'ACTIVE',
                source: 'ONLINE',
                phone: {
                    number: `9230033333${String(staffCounter).padStart(2, '0')}`,
                    otp: { ...generateOtp(), verified: true }
                },
                emailOtp: { ...generateOtp(), verified: true }
            });
            users.push(staff);
        }
    }

    // Create students (some with password, some without)
    for (let i = 1; i <= 20; i++) {
        const hasPassword = i > 2;
        const uniqueLetter = String.fromCharCode(64 + ((i - 1) % 26 + 1));
        const studentData = {
            email: `student${i}@hnh.com`,
            firstName: 'Student',
            lastName: uniqueLetter + 'Std',
            role: 'STUDENT',
            status: 'ACTIVE',
            source: i % 3 === 0 ? 'WALK_IN' : 'ONLINE',
            phone: {
                number: `9230044444${String(i).padStart(2, '0')}`,
                otp: { ...generateOtp(), verified: true }
            },
            emailOtp: { ...generateOtp(), verified: true }
        };

        if (hasPassword) {
            const studentHash = await hashPassword(TEST_PASSWORD);
            studentData.password = studentHash;
        }

        const student = await User.create(studentData);
        users.push(student);
    }

    console.log(T + `${GREEN}Created ${users.length} users${RESET}`);
    return users;
};

/**
 * Create staff profiles
 */
const createStaffProfiles = async (users) => {
    console.log(`\n${CYAN}${A} Creating staff profiles...${RESET}`);
    const staffProfiles = [];

    // Get staff users (skip first user which is admin)
    const staffUsers = users.filter(u => u.role === 'STAFF');

    // Admin
    const admin = await StaffProfile.create({
        userId: staffUsers[0]._id,
        staffRole: 'ADMIN',
        verificationStatus: 'VERIFIED'
    });
    staffProfiles.push(admin);

    // Managers
    for (let i = 1; i <= 2; i++) {
        const manager = await StaffProfile.create({
            userId: staffUsers[i]._id,
            staffRole: 'MANAGER',
            verificationStatus: 'VERIFIED'
        });
        staffProfiles.push(manager);
    }

    // Consultants
    for (let i = 3; i <= 9; i++) {
        const consultant = await StaffProfile.create({
            userId: staffUsers[i]._id,
            staffRole: 'CONSULTANT',
            verificationStatus: 'VERIFIED'
        });
        staffProfiles.push(consultant);
    }

    // Other staff
    for (let i = 10; i < staffUsers.length; i++) {
        const roles = ['ACCOUNTANT', 'RECEPTIONIST', 'AGENT'];
        const role = roles[(i - 10) % roles.length];
        const staff = await StaffProfile.create({
            userId: staffUsers[i]._id,
            staffRole: role,
            verificationStatus: 'VERIFIED'
        });
        staffProfiles.push(staff);
    }

    console.log(T + `${GREEN}Created ${staffProfiles.length} staff profiles${RESET}`);
    return staffProfiles;
};

/**
 * Create countries with consultants
 */
const createCountries = async (staffProfiles) => {
    console.log(`\n${CYAN}${A} Creating countries...${RESET}`);
    const countries = [];
    const consultants = staffProfiles.filter(sp => sp.staffRole === 'CONSULTANT');

    for (let i = 0; i < COUNTRIES_DATA.length; i++) {
        const countryData = COUNTRIES_DATA[i];
        const consultant = consultants[i % consultants.length];

        const country = await Country.create({
            name: countryData.name,
            code: countryData.code,
            consultantId: consultant.userId
        });
        countries.push(country);
    }

    console.log(T + `${GREEN}Created ${countries.length} countries${RESET}`);
    return countries;
};

/**
 * Create universities
 */
const createUniversities = async (countries) => {
    console.log(`\n${CYAN}${A} Creating universities...${RESET}`);
    const universities = [];

    for (const country of countries) {
        const unis = UNIVERSITIES_DATA[country.code] || [];
        for (const uniData of unis) {
            const university = await University.create({
                name: uniData.name,
                shortName: uniData.shortName,
                country: country._id,
                state: uniData.state,
                city: uniData.city
            });
            universities.push(university);
        }
    }

    console.log(T + `${GREEN}Created ${universities.length} universities${RESET}`);
    return universities;
};

/**
 * Create student profiles
 */
const createStudentProfiles = async (users) => {
    console.log(`\n${CYAN}${A} Creating student profiles...${RESET}`);
    const studentProfiles = [];
    const studentUsers = users.filter(u => u.role === 'STUDENT');

    for (let i = 0; i < studentUsers.length; i++) {
        const student = await StudentProfile.create({
            userId: studentUsers[i]._id,
            nationality: COUNTRIES_DATA[i % COUNTRIES_DATA.length].name,
            passportNumber: `PSP${String(i + 1).padStart(6, '0')}`,
            passportExpiry: new Date(new Date().getFullYear() + 5, 0, 1),
            address: {
                street: `${i + 1} Main Street`,
                city: `City${i + 1}`,
                state: `State${i + 1}`,
                postalCode: `12345`,
                country: COUNTRIES_DATA[i % COUNTRIES_DATA.length].name
            },
            educationLevel: 'BACHELORS',
            currentInstitution: `University ${i + 1}`,
            graduationYear: new Date().getFullYear(),
            lastGpa: 3.5 + Math.random() * 0.5,
            englishProficiency: {
                testType: 'IELTS',
                overallScore: 6.5 + Math.random() * 1.5,
                testDate: new Date(new Date().getFullYear() - 1, 0, 1)
            },
            gender: i % 2 === 0 ? 'MALE' : 'FEMALE'
        });
        studentProfiles.push(student);
    }

    console.log(T + `${GREEN}Created ${studentProfiles.length} student profiles${RESET}`);
    return studentProfiles;
};

/**
 * Create initials (enough to cover various states)
 */
const createInitials = async (studentProfiles, countries, staffProfiles) => {
    console.log(`\n${CYAN}${A} Creating initials...${RESET}`);
    const initials = [];
    const consultants = staffProfiles.filter(sp => sp.staffRole === 'CONSULTANT');
    let consultantIndex = 0;

    for (let i = 0; i < studentProfiles.length; i++) {
        const student = studentProfiles[i];
        const country = countries[i % countries.length];
        const consultant = consultants[consultantIndex % consultants.length];
        consultantIndex++;

        // Create initial
        const initial = await Initial.create({
            studentId: student._id,
            type: i % 3 === 0 ? 'VISIT' : 'STUDY',
            preferredCountry: country._id,
            assignedConsultantId: consultant._id,
            notes: `Initial consultation for Student ${i + 1}`,
            source: i % 2 === 0 ? 'ONLINE' : 'WALK_IN',
            status: INITIAL_STATUS.APPROVED,
            reviewedBy: consultants[0].userId,
            reviewedAt: new Date()
        });
        initials.push(initial);
    }

    console.log(T + `${GREEN}Created ${initials.length} initials${RESET}`);
    return initials;
};

/**
 * Create applications (processes) with various states
 */
const createApplications = async (initials, studentProfiles, staffProfiles, countries, universities, users) => {
    console.log(`\n${CYAN}${A} Creating applications...${RESET}`);
    const processes = [];
    const consultants = staffProfiles.filter(sp => sp.staffRole === 'CONSULTANT');
    const agents = staffProfiles.filter(sp => sp.staffRole === 'AGENT');

    const statuses = [
        PROCESS_STATUS.GATHERING_INFO,
        PROCESS_STATUS.INFO_COMPLETE,
        PROCESS_STATUS.INVOICE_PENDING,
        PROCESS_STATUS.INVOICE_COMPLETE,
        PROCESS_STATUS.DOCUMENTS_PENDING,
        PROCESS_STATUS.DOCUMENTS_PROCESSING,
        PROCESS_STATUS.DOCUMENTS_COMPLETE
    ];

    for (let i = 0; i < initials.length; i++) {
        const initial = initials[i];
        const student = studentProfiles[i];
        const user = users.find(u => u._id.equals(student.userId));
        const consultant = consultants[i % consultants.length];
        const agent = agents[i % agents.length];
        const status = statuses[i % statuses.length];

        const process = await Process.create({
            studentId: student._id,
            initialId: initial._id,
            consultantId: consultant._id,
            agentId: agent._id,
            applicantData: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone.number,
                dob: user.dob,
                gender: user.gender,
                nationality: student.nationality,
                passportNumber: student.passportNumber,
                passportExpiry: student.passportExpiry,
                address: student.address,
                educationLevel: student.educationLevel,
                currentInstitution: student.currentInstitution,
                graduationYear: student.graduationYear,
                lastGpa: student.lastGpa,
                englishProficiency: student.englishProficiency
            },
            targetCourse: `Computer Science - Year ${i % 4 + 1}`,
            intakePreference: ['SPRING', 'SUMMER', 'FALL', 'WINTER', 'FLEXIBLE'][i % 5],
            intakeYear: new Date().getFullYear() + (i % 3),
            budget: {
                amount: 20000 + Math.random() * 80000,
                currency: ['USD', 'GBP', 'EUR'][i % 3]
            },
            status: status,
            statusHistory: [
                {
                    status: PROCESS_STATUS.GATHERING_INFO,
                    changedBy: consultant.userId,
                    changedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    notes: 'Application started'
                }
            ]
        });
        processes.push(process);
    }

    console.log(T + `${GREEN}Created ${processes.length} applications${RESET}`);
    return processes;
};

/**
 * Create tasks for applications
 */
const createTasks = async (processes, users) => {
    console.log(`\n${CYAN}${A} Creating tasks...${RESET}`);
    const tasks = [];

    const taskTitles = [
        'Submit Passport Copy',
        'Provide Academic Transcripts',
        'English Test Results',
        'Personal Statement',
        'Recommendation Letters',
        'Financial Documents',
        'Visa Application Form'
    ];

    for (const process of processes) {
        // Create 3-5 tasks per process
        const numTasks = Math.floor(Math.random() * 3) + 3;
        for (let i = 0; i < numTasks; i++) {
            const task = await Task.create({
                processId: process._id,
                title: taskTitles[i % taskTitles.length],
                description: `Task for process ${process._id}`,
                status: [TASK_STATUS.PENDING, TASK_STATUS.IN_PROGRESS, TASK_STATUS.COMPLETED][
                    Math.floor(Math.random() * 3)
                ],
                visibleToStudent: true,
                createdBy: process.consultantId,
                dueDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000)
            });
            tasks.push(task);
        }
    }

    console.log(T + `${GREEN}Created ${tasks.length} tasks${RESET}`);
    return tasks;
};

/**
 * Create invoices
 */
const createInvoices = async (processes, staffProfiles) => {
    console.log(`\n${CYAN}${A} Creating invoices...${RESET}`);
    const invoices = [];
    const accountants = staffProfiles.filter(sp => sp.staffRole === 'ACCOUNTANT');

    for (let i = 0; i < processes.length; i++) {
        const process = processes[i];
        const accountant = accountants[i % accountants.length];

        const amount = 5000 + Math.random() * 15000;
        const invoice = await Invoice.create({
            processId: process._id,
            accountantId: accountant._id,
            paymentType: i % 2 === 0 ? 'DIRECT' : 'UNIVERSITY',
            amount: amount,
            currency: process.budget.currency || 'USD',
            breakdown: [
                { description: 'Tuition Fee', amount: amount * 0.7 },
                { description: 'Processing Fee', amount: amount * 0.15 },
                { description: 'Other Charges', amount: amount * 0.15 }
            ],
            status: [
                INVOICE_STATUS.PENDING,
                INVOICE_STATUS.STUDENT_CONTACTED,
                INVOICE_STATUS.PAYMENT_RECEIVED,
                INVOICE_STATUS.APPROVED
            ][Math.floor(Math.random() * 4)],
            issuedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            notes: `Invoice for process ${process._id}`
        });
        invoices.push(invoice);
    }

    console.log(T + `${GREEN}Created ${invoices.length} invoices${RESET}`);
    return invoices;
};

/**
 * Create documents
 */
const createDocuments = async (tasks, users) => {
    console.log(`\n${CYAN}${A} Creating documents...${RESET}`);
    const documents = [];

    const docTypes = [
        'PASSPORT',
        'ACADEMIC_TRANSCRIPT',
        'ENGLISH_TEST',
        'RECOMMENDATION_LETTER',
        'STATEMENT_OF_PURPOSE',
        'CV_RESUME',
        'FINANCIAL_DOCUMENT'
    ];

    for (const task of tasks) {
        const docType = docTypes[Math.floor(Math.random() * docTypes.length)];
        const status =
            Math.random() > 0.3
                ? [DOCUMENT_STATUS.UPLOADED, DOCUMENT_STATUS.VERIFIED][Math.floor(Math.random() * 2)]
                : DOCUMENT_STATUS.PENDING;

        const document = await Document.create({
            taskId: task._id,
            documentType: docType,
            name: `${docType}_${task._id}`,
            description: `Document for task ${task._id}`,
            filePath: status !== DOCUMENT_STATUS.PENDING ? `/uploads/${docType}_${task._id}.pdf` : null,
            status: status,
            uploadedBy: status !== DOCUMENT_STATUS.PENDING ? users[0]._id : null,
            uploadedAt: status !== DOCUMENT_STATUS.PENDING ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : null,
            reviewedBy: status === DOCUMENT_STATUS.VERIFIED ? users[0]._id : null,
            reviewedAt: status === DOCUMENT_STATUS.VERIFIED ? new Date() : null
        });
        documents.push(document);
    }

    console.log(T + `${GREEN}Created ${documents.length} documents${RESET}`);
    return documents;
};

// ============================================
// PRINT SUMMARY
// ============================================
const printSummary = async () => {
    console.log(`\n\n${MAGENTA}${'='.repeat(60)}${RESET}`);
    console.log(`${MAGENTA}SEEDING SUMMARY${RESET}`);
    console.log(`${MAGENTA}${'='.repeat(60)}${RESET}\n`);

    const counts = {
        users: await User.countDocuments(),
        students: await StudentProfile.countDocuments(),
        staff: await StaffProfile.countDocuments(),
        countries: await Country.countDocuments(),
        universities: await University.countDocuments(),
        initials: await Initial.countDocuments(),
        processes: await Process.countDocuments(),
        tasks: await Task.countDocuments(),
        invoices: await Invoice.countDocuments(),
        documents: await Document.countDocuments()
    };

    console.log(`${BLUE}Users: ${CYAN}${counts.users}${RESET}`);
    console.log(`${BLUE}Student Profiles: ${CYAN}${counts.students}${RESET}`);
    console.log(`${BLUE}Staff Profiles: ${CYAN}${counts.staff}${RESET}`);
    console.log(`${BLUE}Countries: ${CYAN}${counts.countries}${RESET}`);
    console.log(`${BLUE}Universities: ${CYAN}${counts.universities}${RESET}`);
    console.log(`${BLUE}Initials: ${CYAN}${counts.initials}${RESET}`);
    console.log(`${BLUE}Processes (Applications): ${CYAN}${counts.processes}${RESET}`);
    console.log(`${BLUE}Tasks: ${CYAN}${counts.tasks}${RESET}`);
    console.log(`${BLUE}Invoices: ${CYAN}${counts.invoices}${RESET}`);
    console.log(`${BLUE}Documents: ${CYAN}${counts.documents}${RESET}`);

    console.log(`\n${YELLOW}${P} Test Password: ${CYAN}${TEST_PASSWORD}${RESET}`);
    console.log(`${YELLOW}${P} Test User Email: ${CYAN}admin@hnh.com${RESET}`);

    console.log(`\n${MAGENTA}${'='.repeat(60)}${RESET}\n`);
};



const generateHtmlTable = (title, data) => {
    if (!data || data.length === 0) return `<h3>${title} (0)</h3>`;

    // 1. Define fields to EXCLUDE from the table for clean reading
    const EXCLUDE_FIELDS = [
         '__v', '_id', 'createdAt', 'updatedAt', 
        'emailOtp', 'phone', 'isNew', '$errors', 'activePaths', '_doc'
    ];
    
    // 2. Extract and sanitize keys based on the first document's raw data
    const rawDoc = data[0]._doc || data[0];
    const keys = Object.keys(rawDoc).filter(key => 
        !EXCLUDE_FIELDS.includes(key) && key[0] !== '$'
    ).slice(0, 7); // Limit to 7 columns for better view on smaller screens

    // Ensure the table starts with 'email' and 'role' if they exist, making it user-friendly
    const preferredOrder = ['firstName', 'lastName', 'email', 'role', 'status'];
    let finalKeys = [...new Set([...preferredOrder.filter(k => keys.includes(k)), ...keys])];
    finalKeys = finalKeys.slice(0, 7);

    // Helper to format table cells
    const formatCellValue = (doc, key) => {
        const value = doc[key];
        if (value === null || value === undefined) return '';

        if (typeof value === 'object' && value.constructor.name === 'Object') {
            // Special handling for the complex 'phone' field (if it wasn't excluded)
            if (key === 'phone') {
                return `Number: ${value.number} (Verified: ${value.otp.verified})`;
            }
            // General object formatting (limit length)
            return JSON.stringify(value).substring(0, 50) + '...';
        }
        // General text and primitive values
        return String(value);
    };

    let html = `
        <details style="margin-top: 15px; border: 1px solid #ccc; padding: 10px; border-radius: 5px; background-color: #f9f9f9;">
            <summary style="font-weight: bold; cursor: pointer; color: #007bff; font-size: 1.2em;">
                ${title} (${data.length} records)
            </summary>
            <div style="max-height: 400px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.8em; table-layout: fixed;">
                    <thead>
                        <tr style="background-color: #e9ecef;">
                            ${finalKeys.map(key => `<th style="padding: 8px; border: 1px solid #dee2e6; text-align: left;">${key.replace(/([A-Z])/g, ' $1').trim()}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(doc => `
                            <tr>
                                ${finalKeys.map(key => `<td style="padding: 8px; border: 1px solid #dee2e6; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${formatCellValue(doc, key)}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </details>`;
    return html;
};
// Main HTML Wrapper Function
const wrapInHtml = (data) => {
    // Check if the data has the 'summary' property
    const summary = data.summary || {}; 
    
    let html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>HNH CMS Seeding Results</title>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f7f6; padding: 20px; }
                .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                h1 { color: #28a745; border-bottom: 2px solid #28a745; padding-bottom: 10px; }
                .success { background-color: #d4edda; color: #155724; padding: 10px; border-radius: 5px; font-size: 1.1em; }
                .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin: 20px 0; }
                .summary-item { background: #007bff; color: white; padding: 15px; border-radius: 5px; text-align: center; }
                .summary-item h3 { margin: 0 0 5px 0; font-size: 1.1em; }
                .summary-item p { margin: 0; font-size: 1.5em; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Seeding Successful! 🚀</h1>
                <p class="success">The database has been cleared and seeded with sample data.</p>
                <h2>Password for All users</h2>
                <p><strong>Test Password:</strong> ${TEST_PASSWORD}</p>
                <h2>📊 Seeding Summary</h2>
                <div class="summary-grid">
                    ${Object.entries(summary).map(([key, value]) => `
                        <div class="summary-item">
                            <h3>${key.replace(/([A-Z])/g, ' $1').trim()}</h3>
                            <p>${value}</p>
                        </div>
                    `).join('')}
                </div>

                <h2>Detailed Data Breakdown (Click to Expand)</h2>
    `;

    // Order the sections for better readability
    const sections = [
        { title: "Users", data: data.users },
        { title: "Staff Profiles", data: data.staffProfiles },
        { title: "Student Profiles", data: data.studentProfiles },
        { title: "Countries", data: data.countries },
        { title: "Universities", data: data.universities },
        { title: "Initials", data: data.initials },
        { title: "Processes (Applications)", data: data.processes },
        { title: "Tasks", data: data.tasks },
        { title: "Invoices", data: data.invoices },
        { title: "Documents", data: data.documents }
    ];

    html += sections.map(section => generateHtmlTable(section.title, section.data)).join('');

    html += `
                <h2 style="margin-top: 30px;">🔑 Test Credentials</h2>
                <p><strong>Admin Email:</strong> admin@hnh.com</p>
                <p><strong>Test Password:</strong> Test@12345</p>
            </div>
        </body>
        </html>
    `;
    return html;
};



// ============================================
// MAIN SEED FUNCTION
// ============================================

const seedDatabase = async (options = {}) => {
    const { exitOnFinish = false } = options;

    try {
        console.log(`\n${GREEN}${'='.repeat(60)}${RESET}`);
        console.log(`${GREEN}HNH CMS - SAMPLE DATA SEEDER${RESET}`);
        console.log(`${GREEN}${'='.repeat(60)}${RESET}`);

        // Connect to database
        await connectDB();

        // Clear existing data
        await clearDatabase();

        // Run seeding in sequence
        const users = await createUsers();
        const staffProfiles = await createStaffProfiles(users);
        const countries = await createCountries(staffProfiles);
        const universities = await createUniversities(countries);
        const studentProfiles = await createStudentProfiles(users);
        const initials = await createInitials(studentProfiles, countries, staffProfiles);
        const processes = await createApplications(initials, studentProfiles, staffProfiles, countries, universities, users);
        const tasks = await createTasks(processes, users);
        const invoices = await createInvoices(processes, staffProfiles);
        const documents = await createDocuments(tasks, users);

        // Print summary
        await printSummary();

        console.log(T + `${GREEN}Seeding completed successfully!${RESET}\n`);

        // Close database connection
        if (exitOnFinish) {
            await mongoose.connection.close();
            process.exit(0);
        }

        const summary = {
            users: users.length,
            staffProfiles: staffProfiles.length,
            countries: countries.length,
            universities: universities.length,
            studentProfiles: studentProfiles.length,
            initials: initials.length,
            processes: processes.length,
            tasks: tasks.length,
            invoices: invoices.length,
            documents: documents.length
        }

        const Responce = await wrapInHtml({
            summary,
            users: users,
            staffProfiles: staffProfiles,
            countries: countries,
            universities: universities,
            studentProfiles: studentProfiles,
            initials: initials,
            processes: processes,
            tasks: tasks,
            invoices: invoices,
            documents: documents

        })
        return {
            summary,
            Responce
        };
    } catch (error) {
        console.error(X + `${RED}Seeding failed: ${error.message}${RESET}`);
        console.error(error);
        if (exitOnFinish) process.exit(1);
        throw error;
    }
};

// ============================================
// EXPORTS
// ============================================
export { seedDatabase };
export default seedDatabase;

// ============================================
// DIRECT EXECUTION
// ============================================
// If this file is run directly from the command line, run with process exit handling
if (process.argv[1] === import.meta.url.replace('file://', '').replace(/\\/g, '/').split('/').join('\\')) {
    seedDatabase({ exitOnFinish: true });
}
