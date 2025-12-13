// seeds/seeder.mjs
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
    RESET,
    T,
    X,
    P,
    A
} from '../config/constants.mjs';

// Import models
import User from '../models/Users/_UsersMain.mjs';
import StaffProfile, { STAFF_VERIFICATION_STATUS } from '../models/Users/StaffProfile.mjs';

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
const PASSWORD_SALT_ROUNDS = 12;

const hashPassword = async (password) => {
    return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
};

const generateOtp = () => {
    const code = '111111'; // Dev mode
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    return { code, hashedCode, expiresAt };
};

// ============================================
// SEED FUNCTION
// ============================================

/**
 * Create or verify admin and manager accounts
 * Requires password as parameter
 */
const createAdminAndManager = async (password) => {
    console.log(`\n${BLUE}${A} Creating admin and manager accounts...${RESET}`);

    try {
        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: 'admin@hnh.com' });
        if (existingAdmin) {
            console.log(X + `${RED}Admin account already exists. Skipping creation.${RESET}`);
            return false;
        }

        // Check if manager already exists
        const existingManager = await User.findOne({ email: 'manager@hnh.com' });
        if (existingManager) {
            console.log(X + `${RED}Manager account already exists. Skipping creation.${RESET}`);
            return false;
        }

        // Hash the provided password
        const hashedPassword = await hashPassword(password);

        // Create admin user
        const admin = await User.create({
            email: 'admin@hnh.com',
            password: hashedPassword,
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

        // Create admin staff profile
        const adminProfile = await StaffProfile.create({
            userId: admin._id,
            staffRole: 'ADMIN',
            verificationStatus: STAFF_VERIFICATION_STATUS.VERIFIED
        });

        console.log(T + `${GREEN}Admin account created and verified${RESET}`);
        console.log(`   ${BLUE}Email: ${YELLOW}admin@hnh.com${RESET}`);

        // Create manager user
        const manager = await User.create({
            email: 'manager@hnh.com',
            password: hashedPassword,
            firstName: 'Manager',
            lastName: 'User',
            role: 'STAFF',
            status: 'ACTIVE',
            source: 'ONLINE',
            phone: {
                number: '923001111112',
                otp: { ...generateOtp(), verified: true }
            },
            emailOtp: { ...generateOtp(), verified: true }
        });

        // Create manager staff profile
        const managerProfile = await StaffProfile.create({
            userId: manager._id,
            staffRole: 'MANAGER',
            verificationStatus: STAFF_VERIFICATION_STATUS.VERIFIED
        });

        console.log(T + `${GREEN}Manager account created and verified${RESET}`);
        console.log(`   ${BLUE}Email: ${YELLOW}manager@hnh.com${RESET}`);

        console.log(`\n${YELLOW}${P} Password: ${YELLOW}${password}${RESET}`);

        return true;
    } catch (error) {
        console.error(X + `${RED}Error creating accounts: ${error.message}${RESET}`);
        throw error;
    }
};

// ============================================
// MAIN SEED FUNCTION
// ============================================
/**
 * Seed admin and manager accounts
 * @param {Object} options - Configuration options
 * @param {string} options.password - Password for accounts (required)
 * @param {boolean} options.exitOnFinish - Exit process when finished (default: false)
 * @returns {Promise<boolean>} - Returns true if accounts were created, false otherwise
 */
const seedDatabase = async (options = {}) => {
    const { password, exitOnFinish = false } = options;

    try {
        console.log(`\n${GREEN}${'='.repeat(60)}${RESET}`);
        console.log(`${GREEN}HNH CMS - ADMIN & MANAGER SEEDER${RESET}`);
        console.log(`${GREEN}${'='.repeat(60)}${RESET}`);

        if (!password) {
            console.error(X + `${RED}Password is required as a configuration option${RESET}`);
            if (exitOnFinish) process.exit(1);
            throw new Error('Password is required');
        }

        // Connect to database
        await connectDB();

        // Create accounts
        const created = await createAdminAndManager(password);

        if (created) {
            console.log(`\n${T}${GREEN}Seeding completed successfully!${RESET}\n`);
        } else {
            console.log(`\n${P}${YELLOW}No new accounts were created (accounts may already exist)${RESET}\n`);
        }

        // Close database connection
        await mongoose.connection.close();

        if (exitOnFinish) process.exit(0);
        return created;
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
    const password = process.argv[2];
    if (!password) {
        console.error(X + `${RED}Password is required as a command-line argument${RESET}`);
        console.log(`\n${YELLOW}Usage: node seeds/seeder.mjs <password>${RESET}`);
        console.log(`${YELLOW}Example: node seeds/seeder.mjs MySecurePassword@123${RESET}\n`);
        process.exit(1);
    }
    seedDatabase({ password, exitOnFinish: true });
}
