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
import Process from '../models/Process/Process.mjs';
import { PROCESS_STATUS, INTAKE_PREFERENCE, CURRENCY } from '../config/enums.mjs';
import Task, { TASK_STATUS } from '../models/Task/Tasks.mjs';
import Invoice, { INVOICE_STATUS, INVOICE_PAYMENT_TYPE, PAYMENT_METHOD } from '../models/Invoice/Invoice.mjs';
import Document, { DOCUMENT_STATUS } from '../models/Docx/Document.mjs';

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
    { code: 'GBR' },
    { code: 'USA' },
    { code: 'CAN' },
    { code: 'AUS' },
    { code: 'NZL' },
    { code: 'DEU' },
    { code: 'NLD' },
    { code: 'PAK' }
];

const UNIVERSITIES_DATA = {
    GBR: [
        { name: 'University of Oxford', shortName: 'OXFD', state: 'England', city: 'Oxford', imagePath: '/uploads/sample/university.webp' },
        { name: 'University of Cambridge', shortName: 'CAMB', state: 'England', city: 'Cambridge', imagePath: '/uploads/sample/university.webp' },
        { name: 'Imperial College London', shortName: 'ICLN', state: 'England', city: 'London', imagePath: '/uploads/sample/university.webp' },
        { name: 'London School of Economics', shortName: 'LSEC', state: 'England', city: 'London', imagePath: '/uploads/sample/university.webp' },
        { name: 'University of Manchester', shortName: 'MANC', state: 'England', city: 'Manchester', imagePath: '/uploads/sample/university.webp' }
    ],
    USA: [
        { name: 'Harvard University', shortName: 'HARV', state: 'Massachusetts', city: 'Cambridge', imagePath: '/uploads/sample/university.webp' },
        { name: 'Stanford University', shortName: 'STAN', state: 'California', city: 'Stanford', imagePath: '/uploads/sample/university.webp' },
        { name: 'Massachusetts Institute of Technology', shortName: 'MITM', state: 'Massachusetts', city: 'Cambridge', imagePath: '/uploads/sample/university.webp' },
        { name: 'Yale University', shortName: 'YALE', state: 'Connecticut', city: 'New Haven', imagePath: '/uploads/sample/university.webp' },
        { name: 'Princeton University', shortName: 'PRIN', state: 'New Jersey', city: 'Princeton', imagePath: '/uploads/sample/university.webp' }
    ],
    CAN: [
        { name: 'University of Toronto', shortName: 'UONT', state: 'Ontario', city: 'Toronto', imagePath: '/uploads/sample/university.webp' },
        { name: 'McGill University', shortName: 'MCGL', state: 'Quebec', city: 'Montreal', imagePath: '/uploads/sample/university.webp' },
        { name: 'University of British Columbia', shortName: 'UBCV', state: 'British Columbia', city: 'Vancouver', imagePath: '/uploads/sample/university.webp' },
        { name: 'McMaster University', shortName: 'MCMC', state: 'Ontario', city: 'Hamilton', imagePath: '/uploads/sample/university.webp' },
        { name: 'University of Alberta', shortName: 'UALB', state: 'Alberta', city: 'Edmonton', imagePath: '/uploads/sample/university.webp' }
    ],
    AUS: [
        { name: 'University of Melbourne', shortName: 'UNMD', state: 'Victoria', city: 'Melbourne', imagePath: '/uploads/sample/university.webp' },
        { name: 'University of Sydney', shortName: 'UNSY', state: 'New South Wales', city: 'Sydney', imagePath: '/uploads/sample/university.webp' },
        { name: 'Australian National University', shortName: 'ANUS', state: 'Australian Capital Territory', city: 'Canberra', imagePath: '/uploads/sample/university.webp' },
        { name: 'UNSW Sydney', shortName: 'UNSW', state: 'New South Wales', city: 'Sydney', imagePath: '/uploads/sample/university.webp' },
        { name: 'Monash University', shortName: 'MNSH', state: 'Victoria', city: 'Clayton', imagePath: '/uploads/sample/university.webp' }
    ],
    NZL: [
        { name: 'University of Auckland', shortName: 'UAAK', state: 'Auckland', city: 'Auckland', imagePath: '/uploads/sample/university.webp' },
        { name: 'University of Otago', shortName: 'UOTA', state: 'Otago', city: 'Dunedin', imagePath: '/uploads/sample/university.webp' },
        { name: 'Victoria University of Wellington', shortName: 'VUWL', state: 'Wellington', city: 'Wellington', imagePath: '/uploads/sample/university.webp' },
        { name: 'Massey University', shortName: 'MSSU', state: 'Manawatu', city: 'Palmerston North', imagePath: '/uploads/sample/university.webp' },
        { name: 'University of Canterbury', shortName: 'UCTR', state: 'Canterbury', city: 'Christchurch', imagePath: '/uploads/sample/university.webp' }
    ],
    DEU: [
        { name: 'University of Berlin', shortName: 'UBLN', state: 'Berlin', city: 'Berlin', imagePath: '/uploads/sample/university.webp' },
        { name: 'Heidelberg University', shortName: 'UHDG', state: 'Baden-Wurttemberg', city: 'Heidelberg', imagePath: '/uploads/sample/university.webp' },
        { name: 'Technical University of Munich', shortName: 'TUMM', state: 'Bavaria', city: 'Munich', imagePath: '/uploads/sample/university.webp' },
        { name: 'University of Hamburg', shortName: 'UHMB', state: 'Hamburg', city: 'Hamburg', imagePath: '/uploads/sample/university.webp' },
        { name: 'University of Cologne', shortName: 'UCLN', state: 'North Rhine-Westphalia', city: 'Cologne', imagePath: '/uploads/sample/university.webp' }
    ],
    NLD: [
        { name: 'University of Amsterdam', shortName: 'UAMM', state: 'North Holland', city: 'Amsterdam', imagePath: '/uploads/sample/university.webp' },
        { name: 'Utrecht University', shortName: 'UUTR', state: 'Utrecht', city: 'Utrecht', imagePath: '/uploads/sample/university.webp' },
        { name: 'Erasmus University Rotterdam', shortName: 'EROТ', state: 'South Holland', city: 'Rotterdam', imagePath: '/uploads/sample/university.webp' },
        { name: 'University of Groningen', shortName: 'UGRN', state: 'Groningen', city: 'Groningen', imagePath: '/uploads/sample/university.webp' },
        { name: 'Leiden University', shortName: 'ULDN', state: 'South Holland', city: 'Leiden', imagePath: '/uploads/sample/university.webp' }
    ],
    PKR: [
        { name: 'FAST NUCES', shortName: 'FASTL', state: 'Punjab', city: 'Lahore', imagePath: '/uploads/sample/university.webp' },
        { name: 'Lahore University of Management Sciences', shortName: 'LUML', state: 'Punjab', city: 'Lahore', imagePath: '/uploads/sample/university.webp' },
        { name: 'Karachi University', shortName: 'UKRK', state: 'Sindh', city: 'Karachi', imagePath: '/uploads/sample/university.webp' },
        { name: 'COMSATS University Islamabad', shortName: 'COMC', state: 'Islamabad Capital Territory', city: 'Islamabad', imagePath: '/uploads/sample/university.webp' },
        { name: 'Pakistan Institute of Engineering and Applied Sciences', shortName: 'PIAS', state: 'Islamabad Capital Territory', city: 'Islamabad', imagePath: '/uploads/sample/university.webp' }
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
    const hashpswd = await hashPassword(TEST_PASSWORD);
    const admin = await User.create({
        email: 'admin@hnh.com',
        password: hashpswd,
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
    admin.staffRole = 'ADMIN';
    users.push(admin);

    // Create managers
    for (let i = 1; i <= 2; i++) {
        const manager = await User.create({
            email: `manager${i}@hnh.com`,
            password: hashpswd,
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
        manager.staffRole = 'MANAGER';
        users.push(manager);
    }

    // Create consultants
    for (let i = 1; i <= 20; i++) {
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
        consultant.staffRole = 'CONSULTANT';
        users.push(consultant);
    }


    const staffRoles = ['ACCOUNTANT', 'RECEPTIONIST', 'AGENT'];
    let staffCounter = 0;
    for (const role of staffRoles) {
        for (let i = 1; i <= 5; i++) {
            staffCounter++;
            const staffHash = await hashPassword(TEST_PASSWORD);
            const staff = await User.create({
                email: `${role.toLowerCase()}${i}@hnh.com`,
                password: staffHash,
                firstName: role.charAt(0) + role.slice(1).toLowerCase(),
                lastName: String.fromCharCode(65 + staffCounter) + "Stf",
                role: 'STAFF',
                status: 'ACTIVE',
                source: 'ONLINE',
                phone: {
                    number: `9230033333${String(staffCounter).padStart(2, '0')}`,
                    otp: { ...generateOtp(), verified: true }
                },
                emailOtp: { ...generateOtp(), verified: true }
            });
            staff.staffRole = role;
            users.push(staff);
        }
    }


    // Create students (some with password, some without)
    for (let i = 1; i <= 20; i++) {
        const hasPassword = i < 19;
        const uniqueLetter = String.fromCharCode(65 + (i % 26));
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

    // Get staff users (who now have the temporary 'staffRole' property)
    const staffUsers = users.filter(u => u.role === 'STAFF');

    // Create a StaffProfile for every staff user using the attached staffRole
    for (const user of staffUsers) {
        const role = user.staffRole;

        // This check ensures we only create a profile if the role was successfully attached
        if (!role) {
            console.warn(`Skipping staff profile creation for ${user.email}: staffRole property is missing.`);
            continue;
        }

        const profile = await StaffProfile.create({
            userId: user._id,
            staffRole: role,
            verificationStatus: 'VERIFIED'
        });
        staffProfiles.push(profile);
    }

    console.log(T + `${GREEN}Created ${staffProfiles.length} staff profiles${RESET}`);
    return staffProfiles;
};
/**
 * Create countries with consultants
 */
const createCountries = async (staffProfiles) => {
    console.log(`\n${CYAN}${A} Ensuring countries exist and assigning consultants...${RESET}`);
    const countries = [];
    const consultants = staffProfiles.filter(sp => sp.staffRole === 'CONSULTANT');

    for (let i = 0; i < COUNTRIES_DATA.length; i++) {
        const countryData = COUNTRIES_DATA[i];
        let country = await Country.findOne({ code: countryData.code });
        if (!country) {
            // minimal fallback if countrypull hasn't run
            country = await Country.create({ name: countryData.code, code: countryData.code });
        }

        // assign consultants to country if not set
        if (!country.consultantId || !country.visitConsultantId) {
            const consultant = consultants[(i * 2) % Math.max(1, consultants.length)];
            const visitConsultant = consultants[(i * 2 + 1) % Math.max(1, consultants.length)];
            country.consultantId = consultant ? consultant.userId : country.consultantId;
            country.visitConsultantId = visitConsultant ? visitConsultant.userId : country.visitConsultantId;
            await country.save();
        }

        countries.push(country);
    }

    console.log(T + `${GREEN}Prepared ${countries.length} countries${RESET}`);
    return countries;
};

/**
 * Activate existing universities by country code (countrypull should have created them).
 * Also assign some random consultants to countries and ensure a few unis are activated.
 */
const activateUniversities = async (countries, staffProfiles) => {
    console.log(`\n${CYAN}${A} Activating existing universities and assigning consultants...${RESET}`);
    const activated = [];
    const consultants = staffProfiles.filter(sp => sp.staffRole === 'CONSULTANT');

    for (const country of countries) {
        const unis = await University.find({ country: country._id }).limit(100).lean();
        if (!unis || unis.length === 0) continue;

        // Activate most universities for this country
        for (const u of unis) {
            await University.updateOne({ _id: u._id }, { $set: { deactivatedAt: null } });
            activated.push(u._id);
        }

        // Assign consultants to country (if not already assigned)
        if (!country.consultantId || !country.visitConsultantId) {
            const c1 = consultants[Math.floor(Math.random() * Math.max(1, consultants.length))];
            const c2 = consultants[Math.floor(Math.random() * Math.max(1, consultants.length))];
            country.consultantId = c1 ? c1.userId : country.consultantId;
            country.visitConsultantId = c2 ? c2.userId : country.visitConsultantId;
            await country.save();
        }
    }

    // Ensure at least one extra university (global) is activated for variety
    const one = await University.findOne();
    if (one) await University.updateOne({ _id: one._id }, { $set: { deactivatedAt: null } });

    console.log(T + `${GREEN}Activated ${activated.length} universities${RESET}`);
    return activated;
};

/**
 * Create student profiles
 */
const createStudentProfiles = async (users) => {
    console.log(`\n${CYAN}${A} Creating student profiles...${RESET}`);
    const studentProfiles = [];
    const studentUsers = users.filter(u => u.role === 'STUDENT');

    for (let i = 0; i < studentUsers.length; i++) {
        const user = studentUsers[i];
        // pick a country by code and fetch its name if available
        const code = COUNTRIES_DATA[i % COUNTRIES_DATA.length].code;
        const countryDoc = await Country.findOne({ code });
        const nationality = countryDoc ? countryDoc.name : code;

        const student = await StudentProfile.create({
            userId: user._id,
            nationality,
            passportNumber: `PSP${String(i + 1).padStart(6, '0')}`,
            passportExpiry: new Date(new Date().getFullYear() + 5, 0, 1),
            address: {
                street: `${i + 1} Main Street`,
                city: `City${i + 1}`,
                state: `State${i + 1}`,
                postalCode: `12345`,
                country: nationality
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
 * Create initials with distributed statuses and ensure declined/rejected ones have review metadata.
 */
const createInitials = async (studentProfiles, countries, staffProfiles) => {
    console.log(`\n${CYAN}${A} Creating initials...${RESET}`);
    const initials = [];
    const consultants = staffProfiles.filter(sp => sp.staffRole === 'CONSULTANT');

    const statusWeights = [
        { s: INITIAL_STATUS.DONE, w: 60 },
        { s: INITIAL_STATUS.PENDING, w: 10 },
        { s: INITIAL_STATUS.APPROVED, w: 10 },
        { s: INITIAL_STATUS.DECLINED, w: 5 },
        { s: INITIAL_STATUS.REJECTED, w: 5 },
        { s: INITIAL_STATUS.REFUSED, w: 10 }
    ];

    const pickStatus = () => {
        const total = statusWeights.reduce((a, b) => a + b.w, 0);
        let r = Math.random() * total;
        for (const item of statusWeights) {
            if (r < item.w) return item.s;
            r -= item.w;
        }
        return INITIAL_STATUS.DONE;
    };

    for (const student of studentProfiles) {
        // each student gets 1-3 initials (most 1)
        const count = Math.random() < 0.7 ? 1 : (Math.random() < 0.85 ? 2 : 3);
        for (let i = 0; i < count; i++) {
            const type = Math.random() < 0.8 ? INITIAL_TYPE.STUDY : INITIAL_TYPE.VISIT;
            const country = countries[Math.floor(Math.random() * countries.length)];
            const unis = await University.find({ country: country._id }).limit(50);
            const preferredUniversity = (unis && unis.length > 0 && Math.random() < 0.8) ? unis[Math.floor(Math.random() * unis.length)]._id : null;
            const assigned = consultants[Math.floor(Math.random() * Math.max(1, consultants.length))];

            const status = pickStatus();

            const initialData = {
                studentId: student._id,
                type,
                preferredCountry: country._id,
                otherCountry: null,
                preferredUniversity: preferredUniversity || null,
                otherUniversity: preferredUniversity ? null : `Other Uni ${Math.random().toString(36).slice(2, 7)}`,
                assignedConsultantId: assigned ? assigned._id : null,
                notes: `Auto-generated initial for student ${student._id}`,
                source: INITIAL_SOURCE.ONLINE,
                status
            };

            if (status === INITIAL_STATUS.DECLINED || status === INITIAL_STATUS.REJECTED) {
                const reviewer = assigned || consultants[0];
                initialData.reviewedBy = reviewer ? reviewer.userId : null;
                initialData.reviewedAt = new Date();
                initialData.rejectionReason = 'Auto-generated rejection/decline for sample data';
                initialData.markedBy = reviewer ? reviewer._id : null;
                initialData.markedAt = new Date();
            }

            if (status === INITIAL_STATUS.DONE) {
                const marker = assigned || consultants[0];
                initialData.markedBy = marker ? marker._id : null;
                initialData.markedAt = new Date();
            }

            const initial = await Initial.create(initialData);
            initials.push(initial);
        }
    }

    console.log(T + `${GREEN}Created ${initials.length} initials${RESET}`);
    return initials;
};


/**
 * Create Processes (applications) for DONE initials.
 */
const createApplications = async (initials, studentProfiles, staffProfiles) => {
    console.log(`\n${CYAN}${A} Creating applications (processes) for DONE initials...${RESET}`);
    const processes = [];
    const staffById = {};
    for (const s of staffProfiles) staffById[s._id.toString()] = s;

    for (const initial of initials.filter(i => i.status === INITIAL_STATUS.DONE)) {
        const student = studentProfiles.find(sp => sp._id.toString() === initial.studentId.toString());
        if (!student) continue;

        const user = await User.findById(student.userId).lean();
        const consultantProfile = staffById[initial.assignedConsultantId?.toString()] || staffProfiles[Math.floor(Math.random() * staffProfiles.length)];
        const consultantUserId = consultantProfile ? consultantProfile.userId : null;

        const procData = {
            studentId: student._id,
            initialId: initial._id,
            consultantId: consultantProfile ? consultantProfile._id : null,
            agentId: null,

            applicantFirstName: user?.firstName || 'First',
            applicantLastName: user?.lastName || 'Last',
            applicantEmail: user?.email || null,
            applicantPhone: user?.phone?.number || null,
            applicantDob: user?.dob || null,
            applicantGender: user?.gender || null,
            visaType: initial.type,

            nationality: student.nationality,
            passportNumber: student.passportNumber,
            passportExpiry: student.passportExpiry,
            address: student.address || {},
            educationLevel: student.educationLevel,
            currentInstitution: student.currentInstitution,
            graduationYear: student.graduationYear,
            lastGpa: student.lastGpa,
            englishProficiency: student.englishProficiency || {},

            targetCourse: `Target Course ${Math.random().toString(36).slice(2, 6)}`,
            intakePreference: INTAKE_PREFERENCE.FLEXIBLE,
            intakeYear: new Date().getFullYear(),
            budget: {},

            status: PROCESS_STATUS.GATHERING_INFO,
            statusHistory: [{ status: PROCESS_STATUS.GATHERING_INFO, changedBy: consultantUserId || user?._id, changedAt: new Date() }]
        };

        try {
            const process = await Process.create(procData);
            processes.push(process);
        } catch (err) {
            // ignore unique initial constraints or other issues in sample seeding
            console.warn('Process create skipped:', err.message);
        }
    }

    console.log(T + `${GREEN}Created ${processes.length} processes${RESET}`);
    return processes;
};


// Stubs for tasks, invoices and documents: left empty as requested
const createTasks = async () => [];
const createInvoices = async () => [];
const createDocuments = async () => [];


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
        const activatedUnis = await activateUniversities(countries, staffProfiles);
        const studentProfiles = await createStudentProfiles(users);
        const initials = await createInitials(studentProfiles, countries, staffProfiles);
        const processes = await createApplications(initials, studentProfiles, staffProfiles);
        const tasks = await createTasks();
        const invoices = await createInvoices();
        const documents = await createDocuments();

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
            universities: activatedUnis.length,
            studentProfiles: studentProfiles.length,
            initials: initials.length,
            processes: processes.length,
            tasks: tasks.length,
            invoices: invoices.length,
            documents: documents.length
        }

        const unisFull = await University.find({ _id: { $in: activatedUnis } }).limit(100);

        const Responce = await wrapInHtml({
            summary,
            users: users,
            staffProfiles: staffProfiles,
            countries: countries,
            universities: unisFull,
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
