import express from 'express';
import loginRoutes from './Auth/LogInRoute.mjs';
import signupRoutes from './Auth/SignUpRoute.mjs';
import onboardingRoutes from './Onboarding/Onboarding.mjs';
import receptionistRoutes from './Receptionist/receptionist.mjs';
import accountantRoutes from './Accountant/accountant.mjs';
import signupStaffRoutes from './Auth/SignUpStaffRoute.mjs';

const router = express.Router();




router.use('/auth', loginRoutes);
router.use('/auth/signup', signupRoutes);
router.use('/auth/signup-staff', signupStaffRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/receptionist', receptionistRoutes);
router.use('/accountant', accountantRoutes);



export default router;