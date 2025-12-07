// seeders/SeederStart.mjs
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import readline from 'readline';
import User from '../models/User.mjs';
import { USER_ROLE, USER_STATUS, USER_SOURCE } from '../models/User.mjs';
import { X, T, A, E, P } from "../config/constants.mjs"

dotenv.config({ quiet: true });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validatePassword = (password) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    return passwordRegex.test(password);
};

async function seedAdminAccount() {
    try {
        console.log('\n╔════════════════════════════════════════════════════════╗');
        console.log('║         ADMIN ACCOUNT SEEDER - Initial Setup          ║');
        console.log('╚════════════════════════════════════════════════════════╝\n');

        // Connect to database
        const MONGO_URI = process.env.MONGO_URI;

        if (!MONGO_URI) {
            console.error(X + 'ERROR: MONGO_URI not found in environment variables');
            process.exit(1);
        }

        console.log(P + 'Connecting to database...');
        await mongoose.connect(MONGO_URI);
        console.log(T + ' Connected to database\n');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ role: USER_ROLE.ADMIN });

        if (existingAdmin) {
            console.log(E + 'WARNING: Admin account already exists!');
            console.log(A + `Email: ${existingAdmin.email}`);
            console.log(A + `Name: ${existingAdmin.firstName} ${existingAdmin.lastName || ''}`);
            console.log(A + `Created: ${existingAdmin.createdAt}\n`);

            const overwrite = await question('\n\nDo you want to create another admin account? (yes/no): ');

            if (overwrite.toLowerCase() !== 'yes' && overwrite.toLowerCase() !== 'y') {
                console.log('\n\n' + X + 'Seeding cancelled.');
                await mongoose.disconnect();
                rl.close();
                process.exit(0);
            }
            console.log('');
        }

        // Get email
        let email = '';
        while (!email) {
            email = await question(A + 'Enter admin email: ');
            email = email.trim().toLowerCase();

            if (!validateEmail(email)) {
                console.log(X + 'Invalid email format. Please try again.\n');
                email = '';
                continue;
            }

            // Check if email already exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                console.log(X + 'Email already exists in database. Please use a different email.\n');
                email = '';
                continue;
            }
        }

        // Get password
        let password = '';
        while (!password) {
            password = await question(A + 'Enter admin password (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char): ');

            if (!validatePassword(password)) {
                console.log(X + 'Password does not meet requirements. Please try again.\n');
                console.log('   Requirements:');
                console.log('   - At least 8 characters');
                console.log('   - At least 1 uppercase letter');
                console.log('   - At least 1 lowercase letter');
                console.log('   - At least 1 number');
                console.log('   - At least 1 special character (@$!%*?&#)\n');
                password = '';
                continue;
            }

            const confirmPassword = await question(A + 'Confirm password: ');
            if (password !== confirmPassword) {
                console.log(X + 'Passwords do not match. Please try again.\n');
                password = '';
            }
        }

        // Get first name
        let firstName = '';
        while (!firstName) {
            firstName = await question(A + 'Enter first name: ');
            firstName = firstName.trim();
            if (!firstName) {
                console.log(X + 'First name is required.\n');
            }
        }

        // Get last name (optional)
        const lastName = await question(A + 'Enter last name (optional): ');

        console.log('\n\n' + P + 'Creating admin account...');

        // Create admin user
        const admin = await User.create({
            email,
            password, // Will be hashed by pre-save hook
            firstName,
            lastName: lastName.trim() || null,
            role: USER_ROLE.ADMIN,
            status: USER_STATUS.ACTIVE,
            source: USER_SOURCE.ONLINE,
            emailVerified: true,
            phoneVerified: true // Admin doesn't need phone verification for initial setup
        });

        console.log('\n');
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║              ' + T + ' ADMIN ACCOUNT CREATED!                 ║');
        console.log('╚════════════════════════════════════════════════════════╝\n');
        console.log(T + 'ADMIN CREDENTIALS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(A + `Email:      ${admin.email}`);
        console.log(A + `Password:   ${password}`);
        console.log(A + `Name:       ${admin.firstName} ${admin.lastName || ''}`);
        console.log(A + `User ID:    ${admin._id}`);
        console.log(A + `Created:    ${admin.createdAt}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log(E + 'IMPORTANT: Save these credentials in a secure location!\n');

        await mongoose.disconnect();
        console.log(T + 'Disconnected from database');
        console.log(T + ' Seeding completed successfully!\n');

        rl.close();
        process.exit(0);

    } catch (error) {
        console.error('\n' + X + 'ERROR during seeding:');
        console.error(error);
        await mongoose.disconnect();
        rl.close();
        process.exit(1);
    }
}

// Run seeder
seedAdminAccount();