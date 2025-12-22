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


import { requireFullAuth, requireConsultant, requireVisit, requireReceptionist, requireManager, requireAccountant, requireAgent } from '../middlewares/Auth.mjs';
const requireRecept = [requireFullAuth, requireReceptionist];
const managerAuth = [requireFullAuth, requireManager];
const ConsulAuth = [requireFullAuth, requireConsultant];
const VisitAuth = [requireFullAuth, requireVisit];
const AccountantAuth = [requireFullAuth, requireAccountant];
const AgentAuth = [requireFullAuth, requireAgent];

const studyattach = function (req, res, next) { req.rtype = 'STUDY'; next(); }
const visitattach = function (req, res, next) { req.rtype = 'VISIT'; next(); }

router.use('/auth', loginRoutes);
router.use('/auth/signup', signupRoutes);
router.use('/auth/signup-staff', signupStaffRoutes);
router.use('/onboarding', onboardingRoutes);

router.use('/country', CountryRoutes);
router.use('/university', UniversityRoutes);

router.use('/checkAccess', CheckRoute);

router.use('/student', StudentRoutes);

router.use('/receptionist', requireRecept, receptionistRoutes);
router.use('/accountant', AccountantAuth, accountantRoutes);
router.use('/consultant/study', ConsulAuth, studyattach, ConsultantRoutes);
router.use('/consultant/visit', VisitAuth, visitattach, ConsultantRoutes);

// Agent routes with study/visit separation
router.use('/agent/study', AgentAuth, studyattach, AgentRoutes);
router.use('/agent/visit', AgentAuth, visitattach, AgentRoutes);

router.use('/manager/study', managerAuth, studyattach, ManagerRoutes);
router.use('/manager/visit', managerAuth, visitattach, ManagerRoutes);

router.use('/manager', managerAuth, ManagerRoutes);
router.use('/admin', AdminRoutes);



export default router;