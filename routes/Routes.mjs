import express from 'express';
import loginRoutes from './Auth/LogInRoute.mjs';
import signupRoutes from './Auth/SignUpRoute.mjs';
import onboardingRoutes from './Onboarding/Onboarding.mjs';
import receptionistRoutes from './Receptionist/receptionist.mjs';
import accountantRoutes from './Accountant/accountant.mjs';
import signupStaffRoutes from './Auth/SignUpStaffRoute.mjs';
import StudentRoutes from './Student/Student.mjs';
import ConsultantRoutes from './Consultant/Consultant.mjs';
import CheckRoute from './Gen/CheckRole.mjs';
import CountryRoutes from './Gen/CountryRoutes.mjs';
import UniversityRoutes from './Gen/UniversityRoutes.mjs';
import ManagerRoutes from './Manager/ManagerRoutes.mjs';
import AgentRoutes from './Agent/Agent.mjs';
import AdminRoutes from './Admin/AdminRoutes.mjs';

const router = express.Router();




router.use('/auth', loginRoutes);
router.use('/auth/signup', signupRoutes);
router.use('/auth/signup-staff', signupStaffRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/receptionist', receptionistRoutes);
router.use('/accountant', accountantRoutes);
router.use('/student', StudentRoutes);
router.use('/consultant', ConsultantRoutes);
router.use('/country', CountryRoutes);
router.use('/university', UniversityRoutes);
router.use('/checkAccess', CheckRoute);
router.use('/manager', ManagerRoutes);
router.use('/agent', AgentRoutes);
router.use('/admin', AdminRoutes);



export default router;