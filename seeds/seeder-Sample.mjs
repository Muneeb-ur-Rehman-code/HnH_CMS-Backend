// seeders/SeederSample.mjs
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import User from '../models/Users/_UsersMain.mjs';
import StaffProfile from '../models/Users/StaffProfile.mjs';
import ConsultantCountry from '../models/Users/ConsultantCountry.mjs';
import StudentProfile from '../models/Users/Student.mjs';
import Initial from '../models/initial/Initial.mjs';
import Application from '../models/Process/Process.mjs';
import Invoice from '../models/Inoice/Invoice.mjs';
import Task from '../models/Task/Tasks.mjs';
import Document from '../models/Docx/Document.mjs';

import { USER_ROLE, USER_STATUS, USER_SOURCE } from '../models/Users/_UsersMain.mjs';
import { STAFF_ROLE, STAFF_VERIFICATION_STATUS } from '../models/Users/StaffProfile.mjs';
import { GENDER, EDUCATION_LEVEL, ENGLISH_TEST } from '../models/Users/Student.mjs';
import { INITIAL_SOURCE, INITIAL_STATUS } from '../models/initial/Initial.mjs';
import { APPLICATION_STATUS, INTAKE_PREFERENCE, CURRENCY } from '../models/Process/Process.mjs';
import { INVOICE_STATUS, INVOICE_PAYMENT_TYPE, PAYMENT_METHOD } from '../models/Inoice/Invoice.mjs';
import { TASK_STATUS, TASK_PRIORITY } from '../models/Task/Tasks.mjs';
import { DOCUMENT_TYPE, DOCUMENT_STATUS } from '../models/Docx/Document.mjs';

import { GREEN, RED, RESET, YELLOW, BLUE, CYAN, X, T, P } from '../config/constants.mjs';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Sample data storage
const createdData = {
    users: [],
    staffProfiles: [],
    consultantCountries: [],
    studentProfiles: [],
    initials: [],
    applications: [],
    invoices: [],
    tasks: [],
    documents: []
};

// Sample countries
const COUNTRIES = ['United Kingdom', 'Canada', 'Australia', 'United States', 'Germany', 'Ireland'];

// Sample universities by country
const UNIVERSITIES = {
    'United Kingdom': ['Oxford University', 'Cambridge University', 'Imperial College London'],
    'Canada': ['University of Toronto', 'McGill University', 'UBC'],
    'Australia': ['University of Melbourne', 'ANU', 'University of Sydney'],
    'United States': ['MIT', 'Stanford University', 'Harvard University'],
    'Germany': ['TUM', 'LMU Munich', 'Heidelberg University'],
    'Ireland': ['Trinity College Dublin', 'UCD', 'NUI Galway']
};

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

// ============================================
// SEEDING FUNCTIONS
// ============================================

async function seedUsers() {
    progress('Seeding users...');

    const users = [
        // Admin
        {
            email: 'admin@visaconsult.com',
            password: 'Admin123!',
            firstName: 'System',
            lastName: 'Administrator',
            role: USER_ROLE.ADMIN,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.ONLINE,
            emailVerified: true,
            phoneVerified: true,
            phoneNumber: '923001234567'
        },
        // Managers
        {
            email: 'manager1@visaconsult.com',
            password: 'Manager123!',
            firstName: 'John',
            lastName: 'Manager',
            role: USER_ROLE.MANAGER,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.ONLINE,
            emailVerified: true,
            phoneVerified: true,
            phoneNumber: '923001234568'
        },
        {
            email: 'manager2@visaconsult.com',
            password: 'Manager123!',
            firstName: 'Sarah',
            lastName: 'Smith',
            role: USER_ROLE.MANAGER,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.ONLINE,
            emailVerified: true,
            phoneVerified: true,
            phoneNumber: '923001234569'
        },
        // Consultants
        {
            email: 'consultant1@visaconsult.com',
            password: 'Consultant123!',
            firstName: 'Michael',
            lastName: 'Brown',
            role: USER_ROLE.STAFF,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.ONLINE,
            emailVerified: true,
            phoneVerified: true,
            phoneNumber: '923001234570'
        },
        {
            email: 'consultant2@visaconsult.com',
            password: 'Consultant123!',
            firstName: 'Emma',
            lastName: 'Wilson',
            role: USER_ROLE.STAFF,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.ONLINE,
            emailVerified: true,
            phoneVerified: true,
            phoneNumber: '923001234571'
        },
        // Accountants
        {
            email: 'accountant1@visaconsult.com',
            password: 'Accountant123!',
            firstName: 'David',
            lastName: 'Johnson',
            role: USER_ROLE.STAFF,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.ONLINE,
            emailVerified: true,
            phoneVerified: true,
            phoneNumber: '923001234572'
        },
        {
            email: 'accountant2@visaconsult.com',
            password: 'Accountant123!',
            firstName: 'Lisa',
            lastName: 'Anderson',
            role: USER_ROLE.STAFF,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.ONLINE,
            emailVerified: true,
            phoneVerified: true,
            phoneNumber: '923001234573'
        },
        // Agents
        {
            email: 'agent1@visaconsult.com',
            password: 'Agent123!',
            firstName: 'Robert',
            lastName: 'Taylor',
            role: USER_ROLE.STAFF,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.ONLINE,
            emailVerified: true,
            phoneVerified: true,
            phoneNumber: '923001234574'
        },
        {
            email: 'agent2@visaconsult.com',
            password: 'Agent123!',
            firstName: 'Jennifer',
            lastName: 'Martinez',
            role: USER_ROLE.STAFF,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.ONLINE,
            emailVerified: true,
            phoneVerified: true,
            phoneNumber: '923001234575'
        },
        // Receptionists
        {
            email: 'receptionist1@visaconsult.com',
            password: 'Reception123!',
            firstName: 'Alice',
            lastName: 'Davis',
            role: USER_ROLE.STAFF,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.ONLINE,
            emailVerified: true,
            phoneVerified: true,
            phoneNumber: '923001234576'
        },
        {
            email: 'receptionist2@visaconsult.com',
            password: 'Reception123!',
            firstName: 'Mark',
            lastName: 'Garcia',
            role: USER_ROLE.STAFF,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.ONLINE,
            emailVerified: true,
            phoneVerified: true,
            phoneNumber: '923001234577'
        },
        // Students
        {
            email: 'student1@email.com',
            password: 'Student123!',
            firstName: 'Ahmed',
            lastName: 'Khan',
            role: USER_ROLE.STUDENT,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.ONLINE,
            emailVerified: true,
            phoneVerified: true,
            phoneNumber: '923001234578',
            dateOfBirth: new Date('2000-05-15'),
            gender: GENDER.MALE
        },
        {
            email: 'student2@email.com',
            password: 'Student123!',
            firstName: 'Fatima',
            lastName: 'Ali',
            role: USER_ROLE.STUDENT,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.ONLINE,
            emailVerified: true,
            phoneVerified: true,
            phoneNumber: '923001234579',
            dateOfBirth: new Date('1999-08-22'),
            gender: GENDER.FEMALE
        },
        {
            email: 'student3@email.com',
            password: 'Student123!',
            firstName: 'Hassan',
            lastName: 'Ahmed',
            role: USER_ROLE.STUDENT,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.WALK_IN,
            emailVerified: true,
            phoneVerified: true,
            phoneNumber: '923001234580',
            dateOfBirth: new Date('2001-03-10'),
            gender: GENDER.MALE
        },
        {
            email: 'student4@email.com',
            password: 'Student123!',
            firstName: 'Ayesha',
            lastName: 'Malik',
            role: USER_ROLE.STUDENT,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.MARKETING,
            emailVerified: true,
            phoneVerified: true,
            phoneNumber: '923001234581',
            dateOfBirth: new Date('2000-11-30'),
            gender: GENDER.FEMALE
        }
    ];

    for (const userData of users) {
        const user = await User.create(userData);
        createdData.users.push(user);
    }

    success(`Created ${createdData.users.length} users`);
}

async function seedStaffProfiles() {
    progress('Seeding staff profiles...');

    const staffUsers = createdData.users.filter(u =>
        u.role === USER_ROLE.STAFF || u.role === USER_ROLE.MANAGER
    );

    const staffRoles = [
        STAFF_ROLE.CONSULTANT,
        STAFF_ROLE.CONSULTANT,
        STAFF_ROLE.ACCOUNTANT,
        STAFF_ROLE.ACCOUNTANT,
        STAFF_ROLE.AGENT,
        STAFF_ROLE.AGENT,
        STAFF_ROLE.RECEPTIONIST,
        STAFF_ROLE.RECEPTIONIST
    ];

    for (let i = 0; i < staffUsers.length; i++) {
        const profile = await StaffProfile.create({
            userId: staffUsers[i]._id,
            staffRole: staffRoles[i] || STAFF_ROLE.CONSULTANT,
            verificationStatus: STAFF_VERIFICATION_STATUS.VERIFIED
        });
        createdData.staffProfiles.push(profile);
    }

    success(`Created ${createdData.staffProfiles.length} staff profiles`);
}

async function seedConsultantCountries() {
    progress('Seeding consultant countries...');

    const consultants = createdData.staffProfiles.filter(
        s => s.staffRole === STAFF_ROLE.CONSULTANT
    );

    // Assign countries to consultants
    const assignments = [
        { consultant: consultants[0], countries: ['United Kingdom', 'Ireland'] },
        { consultant: consultants[1], countries: ['Canada', 'United States'] }
    ];

    for (const assignment of assignments) {
        for (const country of assignment.countries) {
            const consultantCountry = await ConsultantCountry.create({
                staffProfileId: assignment.consultant._id,
                country
            });
            createdData.consultantCountries.push(consultantCountry);
        }
    }

    success(`Created ${createdData.consultantCountries.length} consultant country assignments`);
}

async function seedStudentProfiles() {
    progress('Seeding student profiles...');

    const students = createdData.users.filter(u => u.role === USER_ROLE.STUDENT);

    const profiles = [
        {
            userId: students[0]._id,
            nationality: 'Pakistani',
            passportNumber: 'AB1234567',
            passportExpiry: new Date('2030-12-31'),
            address: {
                street: '123 Main Street',
                city: 'Lahore',
                state: 'Punjab',
                postalCode: '54000',
                country: 'Pakistan'
            },
            educationLevel: EDUCATION_LEVEL.BACHELORS,
            currentInstitution: 'LUMS',
            graduationYear: 2022,
            lastGPA: 3.5,
            englishProficiency: {
                testType: ENGLISH_TEST.IELTS,
                overallScore: 7.0
            }
        },
        {
            userId: students[1]._id,
            nationality: 'Pakistani',
            passportNumber: 'CD9876543',
            passportExpiry: new Date('2031-06-30'),
            address: {
                street: '456 University Road',
                city: 'Karachi',
                state: 'Sindh',
                postalCode: '75000',
                country: 'Pakistan'
            },
            educationLevel: EDUCATION_LEVEL.MASTERS,
            currentInstitution: 'IBA Karachi',
            graduationYear: 2023,
            lastGPA: 3.8,
            englishProficiency: {
                testType: ENGLISH_TEST.TOEFL,
                overallScore: 105
            }
        },
        {
            userId: students[2]._id,
            nationality: 'Pakistani',
            passportNumber: 'EF5555555',
            passportExpiry: new Date('2032-09-15'),
            address: {
                street: '789 College Avenue',
                city: 'Islamabad',
                state: 'ICT',
                postalCode: '44000',
                country: 'Pakistan'
            },
            educationLevel: EDUCATION_LEVEL.BACHELORS,
            currentInstitution: 'NUST',
            graduationYear: 2024,
            lastGPA: 3.2,
            englishProficiency: {
                testType: ENGLISH_TEST.PTE,
                overallScore: 65
            }
        },
        {
            userId: students[3]._id,
            nationality: 'Pakistani',
            passportNumber: 'GH7777777',
            passportExpiry: new Date('2033-03-20'),
            address: {
                street: '321 Campus Road',
                city: 'Faisalabad',
                state: 'Punjab',
                postalCode: '38000',
                country: 'Pakistan'
            },
            educationLevel: EDUCATION_LEVEL.BACHELORS,
            currentInstitution: 'UAF',
            graduationYear: 2023,
            lastGPA: 3.6,
            englishProficiency: {
                testType: ENGLISH_TEST.IELTS,
                overallScore: 6.5
            }
        }
    ];

    for (const profileData of profiles) {
        const profile = await StudentProfile.create(profileData);
        createdData.studentProfiles.push(profile);
    }

    success(`Created ${createdData.studentProfiles.length} student profiles`);
}

async function seedInitials() {
    progress('Seeding initial entries...');

    const students = createdData.users.filter(u => u.role === USER_ROLE.STUDENT);

    const initials = [
        {
            email: students[0].email,
            firstName: students[0].firstName,
            lastName: students[0].lastName,
            phoneNumber: students[0].phoneNumber,
            preferredCountry: 'United Kingdom',
            preferredUniversity: 'Oxford University',
            source: INITIAL_SOURCE.ONLINE,
            status: INITIAL_STATUS.APPROVED
        },
        {
            email: students[1].email,
            firstName: students[1].firstName,
            lastName: students[1].lastName,
            phoneNumber: students[1].phoneNumber,
            preferredCountry: 'Canada',
            preferredUniversity: 'University of Toronto',
            source: INITIAL_SOURCE.MARKETING,
            status: INITIAL_STATUS.APPROVED
        },
        {
            email: students[2].email,
            firstName: students[2].firstName,
            lastName: students[2].lastName,
            phoneNumber: students[2].phoneNumber,
            preferredCountry: 'Australia',
            preferredUniversity: 'University of Melbourne',
            source: INITIAL_SOURCE.WALK_IN,
            status: INITIAL_STATUS.APPROVED
        },
        {
            email: 'newlead1@email.com',
            firstName: 'Omar',
            lastName: 'Hassan',
            phoneNumber: '923001234590',
            preferredCountry: 'Germany',
            preferredUniversity: 'TUM',
            source: INITIAL_SOURCE.MARKETING,
            status: INITIAL_STATUS.PENDING
        },
        {
            email: 'newlead2@email.com',
            firstName: 'Zainab',
            lastName: 'Yousaf',
            phoneNumber: null,
            preferredCountry: 'Ireland',
            preferredUniversity: 'Trinity College Dublin',
            source: INITIAL_SOURCE.MARKETING,
            status: INITIAL_STATUS.PENDING
        }
    ];

    for (const initialData of initials) {
        const initial = await Initial.create(initialData);
        createdData.initials.push(initial);
    }

    success(`Created ${createdData.initials.length} initial entries`);
}

async function seedApplications() {
    progress('Seeding applications...');

    const students = createdData.users.filter(u => u.role === USER_ROLE.STUDENT);
    const consultants = createdData.staffProfiles.filter(s => s.staffRole === STAFF_ROLE.CONSULTANT);

    const applications = [
        {
            userId: students[0]._id,
            consultantId: consultants[0].userId,
            email: students[0].email,
            firstName: students[0].firstName,
            lastName: students[0].lastName,
            phoneNumber: students[0].phoneNumber,
            nationality: 'Pakistani',
            passportNumber: 'AB1234567',
            passportExpiry: new Date('2030-12-31'),
            address: {
                street: '123 Main Street',
                city: 'Lahore',
                state: 'Punjab',
                postalCode: '54000',
                country: 'Pakistan'
            },
            educationLevel: EDUCATION_LEVEL.BACHELORS,
            targetCountry: 'United Kingdom',
            targetUniversity: 'Oxford University',
            targetCourse: 'MSc Computer Science',
            intakePreference: INTAKE_PREFERENCE.FALL,
            budget: {
                amount: 30000,
                currency: CURRENCY.GBP
            },
            status: APPLICATION_STATUS.GATHERING_INFO
        },
        {
            userId: students[1]._id,
            consultantId: consultants[1].userId,
            email: students[1].email,
            firstName: students[1].firstName,
            lastName: students[1].lastName,
            phoneNumber: students[1].phoneNumber,
            nationality: 'Pakistani',
            passportNumber: 'CD9876543',
            passportExpiry: new Date('2031-06-30'),
            address: {
                street: '456 University Road',
                city: 'Karachi',
                state: 'Sindh',
                postalCode: '75000',
                country: 'Pakistan'
            },
            educationLevel: EDUCATION_LEVEL.MASTERS,
            targetCountry: 'Canada',
            targetUniversity: 'University of Toronto',
            targetCourse: 'MBA',
            intakePreference: INTAKE_PREFERENCE.SPRING,
            budget: {
                amount: 50000,
                currency: CURRENCY.CAD
            },
            status: APPLICATION_STATUS.INVOICE_PENDING
        }
    ];

    for (const appData of applications) {
        const app = await Application.create(appData);
        createdData.applications.push(app);
    }

    success(`Created ${createdData.applications.length} applications`);
}

async function seedInvoices() {
    progress('Seeding invoices...');

    const accountants = createdData.staffProfiles.filter(s => s.staffRole === STAFF_ROLE.ACCOUNTANT);

    const invoices = [
        {
            applicationId: createdData.applications[0]._id,
            accountantId: accountants[0].userId,
            paymentType: INVOICE_PAYMENT_TYPE.DIRECT,
            amount: 5000,
            currency: CURRENCY.USD,
            breakdown: [
                { description: 'Application Fee', amount: 2000 },
                { description: 'Consultation Fee', amount: 2000 },
                { description: 'Document Processing', amount: 1000 }
            ],
            status: INVOICE_STATUS.PENDING,
            dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days from now
        },
        {
            applicationId: createdData.applications[1]._id,
            accountantId: accountants[1].userId,
            paymentType: INVOICE_PAYMENT_TYPE.UNIVERSITY,
            amount: 3000,
            currency: CURRENCY.USD,
            breakdown: [
                { description: 'Consultation Fee', amount: 3000 }
            ],
            status: INVOICE_STATUS.APPROVED,
            approvedAt: new Date(),
            approvedBy: accountants[1].userId
        }
    ];

    for (const invoiceData of invoices) {
        const invoice = await Invoice.create(invoiceData);
        createdData.invoices.push(invoice);
    }

    success(`Created ${createdData.invoices.length} invoices`);
}

async function seedTasks() {
    progress('Seeding tasks...');

    const consultants = createdData.staffProfiles.filter(s => s.staffRole === STAFF_ROLE.CONSULTANT);
    const students = createdData.users.filter(u => u.role === USER_ROLE.STUDENT);

    const tasks = [
        {
            applicationId: createdData.applications[0]._id,
            title: 'Collect Academic Transcripts',
            description: 'Request and collect all academic transcripts from previous institutions',
            status: TASK_STATUS.PENDING,
            priority: TASK_PRIORITY.HIGH,
            createdBy: consultants[0].userId,
            assignedTo: students[0]._id,
            visibleToStudent: true,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        {
            applicationId: createdData.applications[0]._id,
            title: 'Submit English Test',
            description: 'Take IELTS exam and submit scores',
            status: TASK_STATUS.IN_PROGRESS,
            priority: TASK_PRIORITY.HIGH,
            createdBy: consultants[0].userId,
            assignedTo: students[0]._id,
            visibleToStudent: true,
            startedAt: new Date(),
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        },
        {
            applicationId: createdData.applications[1]._id,
            title: 'Prepare Statement of Purpose',
            description: 'Draft and finalize statement of purpose',
            status: TASK_STATUS.COMPLETED,
            priority: TASK_PRIORITY.MEDIUM,
            createdBy: consultants[1].userId,
            assignedTo: students[1]._id,
            visibleToStudent: true,
            startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            completedAt: new Date(),
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        {
            applicationId: createdData.applications[1]._id,
            title: 'Internal Review',
            description: 'Internal document verification by consultant',
            status: TASK_STATUS.PENDING,
            priority: TASK_PRIORITY.LOW,
            createdBy: consultants[1].userId,
            visibleToStudent: false,
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        }
    ];

    for (const taskData of tasks) {
        const task = await Task.create(taskData);
        createdData.tasks.push(task);
    }

    success(`Created ${createdData.tasks.length} tasks`);
}

async function seedDocuments() {
    progress('Seeding documents...');

    const consultants = createdData.staffProfiles.filter(s => s.staffRole === STAFF_ROLE.CONSULTANT);
    const students = createdData.users.filter(u => u.role === USER_ROLE.STUDENT);

    const documents = [
        {
            applicationId: createdData.applications[0]._id,
            documentType: DOCUMENT_TYPE.PASSPORT,
            name: 'Passport Copy',
            description: 'Valid passport copy',
            filePath: 'uploads/sample/passport.jpg',
            fileName: 'passport.jpg',
            status: DOCUMENT_STATUS.VERIFIED,
            uploadedBy: students[0]._id,
            uploadedAt: new Date(),
            verifiedBy: consultants[0].userId,
            verifiedAt: new Date(),
            verificationNotes: 'Passport verified, valid until 2030',
            expiryDate: new Date('2030-12-31'),
            visibleToStudent: true
        },
        {
            applicationId: createdData.applications[0]._id,
            documentType: DOCUMENT_TYPE.ACADEMIC_TRANSCRIPT,
            name: 'Bachelor Degree Transcript',
            description: 'Official transcript from university',
            filePath: 'uploads/sample/transcript.pdf',
            fileName: 'transcript.pdf',
            status: DOCUMENT_STATUS.UPLOADED,
            uploadedBy: students[0]._id,
            uploadedAt: new Date(),
            visibleToStudent: true
        },
        {
            applicationId: createdData.applications[0]._id,
            documentType: DOCUMENT_TYPE.ENGLISH_TEST,
            name: 'IELTS Results',
            description: 'IELTS Academic test results',
            status: DOCUMENT_STATUS.PENDING,
            visibleToStudent: true
        },
        {
            applicationId: createdData.applications[1]._id,
            documentType: DOCUMENT_TYPE.PASSPORT,
            name: 'Passport Copy',
            filePath: 'uploads/sample/passport.jpg',
            fileName: 'passport.jpg',
            status: DOCUMENT_STATUS.VERIFIED,
            uploadedBy: students[1]._id,
            uploadedAt: new Date(),
            verifiedBy: consultants[1].userId,
            verifiedAt: new Date(),
            expiryDate: new Date('2031-06-30'),
            visibleToStudent: true
        },
        {
            applicationId: createdData.applications[1]._id,
            documentType: DOCUMENT_TYPE.STATEMENT_OF_PURPOSE,
            name: 'Statement of Purpose',
            filePath: 'uploads/sample/sop.pdf',
            fileName: 'sop.pdf',
            status: DOCUMENT_STATUS.VERIFIED,
            uploadedBy: students[1]._id,
            uploadedAt: new Date(),
            verifiedBy: consultants[1].userId,
            verifiedAt: new Date(),
            verificationNotes: 'Well written SOP',
            visibleToStudent: true
        },
        {
            applicationId: createdData.applications[1]._id,
            documentType: DOCUMENT_TYPE.CV_RESUME,
            name: 'Curriculum Vitae',
            filePath: 'uploads/sample/cv.pdf',
            fileName: 'cv.pdf',
            status: DOCUMENT_STATUS.REJECTED,
            uploadedBy: students[1]._id,
            uploadedAt: new Date(),
            rejectedBy: consultants[1].userId,
            rejectedAt: new Date(),
            rejectionReason: 'Please update with recent work experience',
            visibleToStudent: true
        }
    ];

    for (const docData of documents) {
        const doc = await Document.create(docData);
        createdData.documents.push(doc);
    }

    success(`Created ${createdData.documents.length} documents`);
}

// ============================================
// GENERATE MARKDOWN REPORT
// ============================================

async function generateMarkdownReport() {
    progress('Generating markdown report...');

    let markdown = '# Sample Database Seed Report\n\n';
    markdown += `**Generated**: ${new Date().toISOString()}\n\n`;
    markdown += '---\n\n';

    // Users
    markdown += '## Users\n\n';
    markdown += '| Email | Password | Role | Name | Phone | Status |\n';
    markdown += '|-------|----------|------|------|-------|--------|\n';
    createdData.users.forEach(user => {
        const password = user.email.includes('@visaconsult.com')
            ? user.role.charAt(0) + user.role.slice(1).toLowerCase() + '123!'
            : 'Student123!';
        markdown += `| ${user.email} | ${password} | ${user.role} | ${user.firstName} ${user.lastName} | ${user.phoneNumber} | ${user.status} |\n`;
    });
    markdown += '\n';

    // Staff Profiles
    markdown += '## Staff Profiles\n\n';
    markdown += '| Name | Staff Role | Verification Status |\n';
    markdown += '|------|------------|---------------------|\n';
    for (const profile of createdData.staffProfiles) {
        const user = await User.findById(profile.userId);
        markdown += `| ${user ? `${user.firstName} ${user.lastName}` : 'N/A'} | ${profile.staffRole} | ${profile.verificationStatus} |\n`;
    }
    markdown += '\n';

    // Consultant Countries
    markdown += '## Consultant Country Assignments\n\n';
    markdown += '| Consultant | Countries |\n';
    markdown += '|------------|----------|\n';
    const consultantMap = {};
    for (const cc of createdData.consultantCountries) {
        const staffProfile = await StaffProfile.findById(cc.staffProfileId);
        if (staffProfile) {
            const user = await User.findById(staffProfile.userId);
            if (user) {
                const name = `${user.firstName} ${user.lastName}`;
                if (!consultantMap[name]) {
                    consultantMap[name] = [];
                }
                consultantMap[name].push(cc.country);
            }
        }
    }
    Object.entries(consultantMap).forEach(([name, countries]) => {
        markdown += `| ${name} | ${countries.join(', ')} |\n`;
    });
    markdown += '\n';

    // Student Profiles
    markdown += '## Student Profiles\n\n';
    markdown += '| Name | Nationality | Passport | Education | Institution | GPA | English Test |\n';
    markdown += '|------|-------------|----------|-----------|-------------|-----|-------------|\n';
    for (const profile of createdData.studentProfiles) {
        const user = await User.findById(profile.userId);
        markdown += `| ${user ? `${user.firstName} ${user.lastName}` : 'N/A'} | ${profile.nationality} | ${profile.passportNumber} | ${profile.educationLevel} | ${profile.currentInstitution} | ${profile.lastGPA} | ${profile.englishProficiency.testType} (${profile.englishProficiency.overallScore}) |\n`;
    }
    markdown += '\n';

    // Initial Entries
    markdown += '## Initial Entries\n\n';
    markdown += '| Email | Name | Phone | Country | University | Source | Status |\n';
    markdown += '|-------|------|-------|---------|------------|--------|--------|\n';
    createdData.initials.forEach(initial => {
        markdown += `| ${initial.email} | ${initial.firstName} ${initial.lastName} | ${initial.phoneNumber || 'N/A'} | ${initial.preferredCountry || 'N/A'} | ${initial.preferredUniversity || 'N/A'} | ${initial.source} | ${initial.status} |\n`;
    });
    markdown += '\n';

    // Applications
    markdown += '## Applications\n\n';
    markdown += '| Student | Consultant | Country | University | Course | Status |\n';
    markdown += '|---------|------------|---------|------------|--------|--------|\n';
    for (const app of createdData.applications) {
        const student = await User.findById(app.userId);
        const consultant = await User.findById(app.consultantId);
        markdown += `| ${student ? `${student.firstName} ${student.lastName}` : 'N/A'} | ${consultant ? `${consultant.firstName} ${consultant.lastName}` : 'N/A'} | ${app.targetCountry} | ${app.targetUniversity} | ${app.targetCourse} | ${app.status} |\n`;
    }
    markdown += '\n';

    // Invoices
    markdown += '## Invoices\n\n';
    markdown += '| Invoice# | Application | Accountant | Amount | Type | Status |\n';
    markdown += '|----------|-------------|------------|--------|------|--------|\n';
    for (const invoice of createdData.invoices) {
        const app = await Application.findById(invoice.applicationId);
        const student = app ? await User.findById(app.userId) : null;
        const accountant = await User.findById(invoice.accountantId);
        markdown += `| ${invoice.invoiceNumber} | ${student ? `${student.firstName} ${student.lastName}` : 'N/A'} | ${accountant ? `${accountant.firstName} ${accountant.lastName}` : 'N/A'} | ${invoice.amount} ${invoice.currency} | ${invoice.paymentType} | ${invoice.status} |\n`;
    }
    markdown += '\n';

    // Tasks
    markdown += '## Tasks\n\n';
    markdown += '| Application | Title | Status | Priority | Assigned To | Visible to Student | Due Date |\n';
    markdown += '|-------------|-------|--------|----------|-------------|-------------------|----------|\n';
    for (const task of createdData.tasks) {
        const app = await Application.findById(task.applicationId);
        const student = app ? await User.findById(app.userId) : null;
        const assignee = task.assignedTo ? await User.findById(task.assignedTo) : null;
        markdown += `| ${student ? `${student.firstName} ${student.lastName}` : 'N/A'} | ${task.title} | ${task.status} | ${task.priority} | ${assignee ? `${assignee.firstName} ${assignee.lastName}` : 'N/A'} | ${task.visibleToStudent ? 'Yes' : 'No'} | ${task.dueDate ? task.dueDate.toISOString().split('T')[0] : 'N/A'} |\n`;
    }
    markdown += '\n';

    // Documents
    markdown += '## Documents\n\n';
    markdown += '| Application | Type | Name | File Path | Status | Uploaded By |\n';
    markdown += '|-------------|------|------|-----------|--------|-------------|\n';
    for (const doc of createdData.documents) {
        const app = await Application.findById(doc.applicationId);
        const student = app ? await User.findById(app.userId) : null;
        const uploader = doc.uploadedBy ? await User.findById(doc.uploadedBy) : null;
        markdown += `| ${student ? `${student.firstName} ${student.lastName}` : 'N/A'} | ${doc.documentType} | ${doc.name} | ${doc.filePath || 'N/A'} | ${doc.status} | ${uploader ? `${uploader.firstName} ${uploader.lastName}` : 'N/A'} |\n`;
    }
    markdown += '\n';

    // Sample Files Required
    markdown += '## Required Sample Files\n\n';
    markdown += 'Place the following files in `uploads/sample/` directory:\n\n';
    markdown += '- `passport.jpg` - Sample passport document (used by multiple students)\n';
    markdown += '- `transcript.pdf` - Sample academic transcript\n';
    markdown += '- `sop.pdf` - Sample statement of purpose\n';
    markdown += '- `cv.pdf` - Sample curriculum vitae\n\n';
    markdown += '**Note**: All sample students use the same document files for demonstration purposes.\n\n';

    // Summary
    markdown += '## Summary\n\n';
    markdown += `- **Total Users**: ${createdData.users.length}\n`;
    markdown += `  - Admin: 1\n`;
    markdown += `  - Managers: 2\n`;
    markdown += `  - Staff: 8 (2 Consultants, 2 Accountants, 2 Agents, 2 Receptionists)\n`;
    markdown += `  - Students: 4\n`;
    markdown += `- **Staff Profiles**: ${createdData.staffProfiles.length}\n`;
    markdown += `- **Consultant Countries**: ${createdData.consultantCountries.length}\n`;
    markdown += `- **Student Profiles**: ${createdData.studentProfiles.length}\n`;
    markdown += `- **Initial Entries**: ${createdData.initials.length}\n`;
    markdown += `- **Applications**: ${createdData.applications.length}\n`;
    markdown += `- **Invoices**: ${createdData.invoices.length}\n`;
    markdown += `- **Tasks**: ${createdData.tasks.length}\n`;
    markdown += `- **Documents**: ${createdData.documents.length}\n`;

    // Write to file
    const reportPath = path.join(__dirname, 'SampleDatabaseReport.md');
    await fs.writeFile(reportPath, markdown, 'utf8');

    success(`Markdown report generated: ${reportPath}`);
}

// ============================================
// MAIN SEEDER FUNCTION
// ============================================

async function seedDatabase() {
    try {
        console.log('\n' + '='.repeat(60));
        log('SAMPLE DATABASE SEEDER', CYAN);
        console.log('='.repeat(60) + '\n');

        // Connect to database
        const MONGO_URI = process.env.MONGO_URI;

        if (!MONGO_URI) {
            error('MONGO_URI not found in environment variables');
            process.exit(1);
        }

        progress('Connecting to database...');
        await mongoose.connect(MONGO_URI);
        success('Connected to database\n');

        // Clear existing data
        progress('Clearing existing data...');
        await User.deleteMany({});
        await StaffProfile.deleteMany({});
        await ConsultantCountry.deleteMany({});
        await StudentProfile.deleteMany({});
        await Initial.deleteMany({});
        await Application.deleteMany({});
        await Invoice.deleteMany({});
        await Task.deleteMany({});
        await Document.deleteMany({});
        success('Existing data cleared\n');

        // Seed data
        await seedUsers();
        await seedStaffProfiles();
        await seedConsultantCountries();
        await seedStudentProfiles();
        await seedInitials();
        await seedApplications();
        await seedInvoices();
        await seedTasks();
        await seedDocuments();

        // Generate report
        await generateMarkdownReport();

        console.log('\n' + '='.repeat(60));
        success('DATABASE SEEDING COMPLETED SUCCESSFULLY');
        console.log('='.repeat(60) + '\n');

        log('Summary:', YELLOW);
        log(`  Users: ${createdData.users.length}`, RESET);
        log(`  Staff Profiles: ${createdData.staffProfiles.length}`, RESET);
        log(`  Consultant Countries: ${createdData.consultantCountries.length}`, RESET);
        log(`  Student Profiles: ${createdData.studentProfiles.length}`, RESET);
        log(`  Initial Entries: ${createdData.initials.length}`, RESET);
        log(`  Applications: ${createdData.applications.length}`, RESET);
        log(`  Invoices: ${createdData.invoices.length}`, RESET);
        log(`  Tasks: ${createdData.tasks.length}`, RESET);
        log(`  Documents: ${createdData.documents.length}\n`, RESET);

        log('Check SampleDatabaseReport.md for detailed information\n', CYAN);

        await mongoose.disconnect();
        success('Disconnected from database');
        process.exit(0);

    } catch (err) {
        console.error('\n');
        error('ERROR during seeding:');
        console.error(err);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run seeder
seedDatabase();