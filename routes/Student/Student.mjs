// routes/student/student.mjs
import express from 'express';
import User from '../../models/Users/_UsersMain.mjs';
import StudentProfile from '../../models/Users/Student.mjs';
import Initial from '../../models/initial/Initial.mjs';
import Application from '../../models/Process/Process.mjs';
import Invoice from '../../models/Invoice/Invoice.mjs';
import Task from '../../models/Task/Tasks.mjs';
import Document from '../../models/Docx/Document.mjs';
import { attachUser, requireRole, requireEmailVerified, requirePhoneVerified, requireBasicInfo } from '../../middlewares/Auth.mjs';
import { USER_ROLE } from '../../models/Users/_UsersMain.mjs';
import { INITIAL_SOURCE, INITIAL_STATUS } from '../../models/initial/Initial.mjs';

const router = express.Router();

// All routes require student role and completed onboarding
const requireStudent = [
    attachUser,
    requireRole(USER_ROLE.STUDENT),
    requireEmailVerified,
    requirePhoneVerified,
    requireBasicInfo
];

// ============================================
// PROFILE
// ============================================

/**
 * GET /api/student/profile
 * Get student profile
 */
router.get('/profile', requireStudent, async (req, res) => {
    try {
        const user = req.user;

        // Get student profile if exists
        const studentProfile = await StudentProfile.findOne({ userId: user._id }).select('-deletedAt -createdAt -updatedAt -isPassportExpired -isPassportExpiringSoon -hasCompleteAddress -isDeleted -id');

        return res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phoneNumber: user.phoneNumber,
                    dateOfBirth: user.dateOfBirth,
                    gender: user.gender
                },
                profile: studentProfile || null
            }
        });

    } catch (error) {
        console.error('Get profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch profile',
            error: error.message
        });
    }
});

/**
 * PUT /api/student/profile
 * Update student profile
 */
router.put('/profile', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const {
            // User fields
            firstName,
            lastName,
            dateOfBirth,
            gender,
            // Student profile fields
            nationality,
            passportNumber,
            passportExpiry,
            address,
            educationLevel,
            currentInstitution,
            graduationYear,
            lastGPA,
            englishProficiency
        } = req.body;

        // Update user basic info
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
        if (gender !== undefined) user.gender = gender;
        await user.save();

        // Update or create student profile
        let studentProfile = await StudentProfile.findOne({ userId: user._id });

        if (!studentProfile) {
            studentProfile = new StudentProfile({ userId: user._id });
        }

        if (nationality !== undefined) studentProfile.nationality = nationality;
        if (passportNumber !== undefined) studentProfile.passportNumber = passportNumber;
        if (passportExpiry !== undefined) studentProfile.passportExpiry = passportExpiry;
        if (address !== undefined) studentProfile.address = address;
        if (educationLevel !== undefined) studentProfile.educationLevel = educationLevel;
        if (currentInstitution !== undefined) studentProfile.currentInstitution = currentInstitution;
        if (graduationYear !== undefined) studentProfile.graduationYear = graduationYear;
        if (lastGPA !== undefined) studentProfile.lastGPA = lastGPA;
        if (englishProficiency !== undefined) studentProfile.englishProficiency = englishProficiency;

        await studentProfile.save();

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phoneNumber: user.phoneNumber,
                    dateOfBirth: user.dateOfBirth,
                    gender: user.gender
                },
                profile: studentProfile
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ')
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message
        });
    }
});

// ============================================
// INITIALS (Application Requests)
// ============================================

/**
 * GET /api/student/initials
 * Get approved initials for this student
 */
router.get('/initials', requireStudent, async (req, res) => {
    try {
        const user = req.user;

        const initials = await Initial.find({
            email: user.email,
            status: INITIAL_STATUS.APPROVED,
            deletedAt: null
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: initials.length,
                initials
            }
        });

    } catch (error) {
        console.error('Get initials error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch initials',
            error: error.message
        });
    }
});

/**
 * POST /api/student/application-request
 * Create or replace application request
 */
router.post('/application-request', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const { preferredCountry, preferredUniversity } = req.body;

        // Check if there's an existing non-DONE initial
        const existingInitial = await Initial.findOne({
            email: user.email,
            status: { $ne: INITIAL_STATUS.DONE },
            deletedAt: null
        });

        if (existingInitial) {
            // Replace existing initial
            existingInitial.firstName = user.firstName;
            existingInitial.lastName = user.lastName;
            existingInitial.phoneNumber = user.phoneNumber;
            existingInitial.preferredCountry = preferredCountry || existingInitial.preferredCountry;
            existingInitial.preferredUniversity = preferredUniversity || existingInitial.preferredUniversity;
            existingInitial.source = INITIAL_SOURCE.ONLINE;
            existingInitial.status = INITIAL_STATUS.APPROVED;
            await existingInitial.save();

            return res.status(200).json({
                success: true,
                message: 'Application request updated successfully',
                data: { initial: existingInitial }
            });
        }

        // Create new initial
        const newInitial = await Initial.create({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            preferredCountry: preferredCountry || null,
            preferredUniversity: preferredUniversity || null,
            source: INITIAL_SOURCE.ONLINE,
            status: INITIAL_STATUS.APPROVED
        });

        return res.status(201).json({
            success: true,
            message: 'Application request created successfully',
            data: { initial: newInitial }
        });

    } catch (error) {
        console.error('Create application request error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create application request',
            error: error.message
        });
    }
});

/**
 * DELETE /api/student/application-request
 * Delete pending application request
 */
router.delete('/application-request', requireStudent, async (req, res) => {
    try {
        const user = req.user;

        const initial = await Initial.findOne({
            email: user.email,
            status: INITIAL_STATUS.APPROVED,
            deletedAt: null
        });

        if (!initial) {
            return res.status(404).json({
                success: false,
                message: 'No pending application request found'
            });
        }

        await initial.softDelete();

        return res.status(200).json({
            success: true,
            message: 'Application request deleted successfully'
        });

    } catch (error) {
        console.error('Delete application request error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete application request',
            error: error.message
        });
    }
});

// ============================================
// APPLICATIONS
// ============================================

/**
 * GET /api/student/applications
 * Get all applications for this student
 */
router.get('/applications', requireStudent, async (req, res) => {
    try {
        const user = req.user;

        const applications = await Application.find({
            studentId: user._id,
            deletedAt: null
        })
            .populate('consultantId', 'email firstName lastName phoneNumber')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: applications.length,
                applications: applications.map(app => ({
                    id: app._id,
                    targetCountry: app.targetCountry,
                    targetUniversity: app.targetUniversity,
                    targetCourse: app.targetCourse,
                    intakePreference: app.intakePreference,
                    status: app.status,
                    consultant: app.consultantId ? {
                        name: `${app.consultantId.firstName} ${app.consultantId.lastName}`,
                        email: app.consultantId.email,
                        phone: app.consultantId.phoneNumber
                    } : null,
                    createdAt: app.createdAt,
                    updatedAt: app.updatedAt
                }))
            }
        });

    } catch (error) {
        console.error('Get applications error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch applications',
            error: error.message
        });
    }
});

/**
 * GET /api/student/applications/:applicationId
 * Get specific application details
 */
router.get('/applications/:applicationId', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const { applicationId } = req.params;

        const application = await Application.findOne({
            _id: applicationId,
            studentId: user._id,
            deletedAt: null
        }).populate('consultantId', 'email firstName lastName phoneNumber');

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                application: {
                    id: application._id,
                    targetCountry: application.targetCountry,
                    targetUniversity: application.targetUniversity,
                    targetCourse: application.targetCourse,
                    intakePreference: application.intakePreference,
                    budget: application.budget,
                    status: application.status,
                    statusHistory: application.statusHistory,
                    consultant: application.consultantId ? {
                        name: `${application.consultantId.firstName} ${application.consultantId.lastName}`,
                        email: application.consultantId.email,
                        phone: application.consultantId.phoneNumber
                    } : null,
                    createdAt: application.createdAt,
                    updatedAt: application.updatedAt
                }
            }
        });

    } catch (error) {
        console.error('Get application error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch application',
            error: error.message
        });
    }
});

/**
 * GET /api/student/applications/:applicationId/invoices
 * Get invoices for an application
 */
router.get('/applications/:applicationId/invoices', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const { applicationId } = req.params;

        // Verify application belongs to student
        const application = await Application.findOne({
            _id: applicationId,
            studentId: user._id,
            deletedAt: null
        });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        const invoices = await Invoice.find({
            applicationId,
            deletedAt: null
        }).sort({ issuedAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: invoices.length,
                invoices: invoices.map(inv => ({
                    id: inv._id,
                    invoiceNumber: inv.invoiceNumber,
                    amount: inv.amount,
                    currency: inv.currency,
                    paymentType: inv.paymentType,
                    status: inv.status,
                    breakdown: inv.breakdown,
                    dueDate: inv.dueDate,
                    issuedAt: inv.issuedAt,
                    approvedAt: inv.approvedAt
                }))
            }
        });

    } catch (error) {
        console.error('Get invoices error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch invoices',
            error: error.message
        });
    }
});

/**
 * GET /api/student/applications/:applicationId/tasks
 * Get tasks for an application (visible to student only)
 */
router.get('/applications/:applicationId/tasks', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const { applicationId } = req.params;

        // Verify application belongs to student
        const application = await Application.findOne({
            _id: applicationId,
            studentId: user._id,
            deletedAt: null
        });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        const tasks = await Task.find({
            applicationId,
            visibleToStudent: true,
            deletedAt: null
        })
            .populate('createdBy', 'firstName lastName')
            .sort({ dueDate: 1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: tasks.length,
                tasks: tasks.map(task => ({
                    id: task._id,
                    title: task.title,
                    description: task.description,
                    status: task.status,
                    priority: task.priority,
                    dueDate: task.dueDate,
                    completedAt: task.completedAt,
                    createdBy: task.createdBy ? `${task.createdBy.firstName} ${task.createdBy.lastName}` : null,
                    createdAt: task.createdAt
                }))
            }
        });

    } catch (error) {
        console.error('Get tasks error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch tasks',
            error: error.message
        });
    }
});

/**
 * GET /api/student/applications/:applicationId/documents
 * Get documents for an application (visible to student only)
 */
router.get('/applications/:applicationId/documents', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const { applicationId } = req.params;

        // Verify application belongs to student
        const application = await Application.findOne({
            _id: applicationId,
            studentId: user._id,
            deletedAt: null
        });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        const documents = await Document.find({
            applicationId,
            visibleToStudent: true,
            deletedAt: null
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: documents.length,
                documents: documents.map(doc => ({
                    id: doc._id,
                    documentType: doc.documentType,
                    name: doc.name,
                    description: doc.description,
                    status: doc.status,
                    filePath: doc.filePath,
                    fileName: doc.fileName,
                    rejectionReason: doc.rejectionReason,
                    expiryDate: doc.expiryDate,
                    uploadedAt: doc.uploadedAt,
                    verifiedAt: doc.verifiedAt
                }))
            }
        });

    } catch (error) {
        console.error('Get documents error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch documents',
            error: error.message
        });
    }
});

/**
 * POST /api/student/applications/:applicationId/documents/:documentId/upload
 * Upload a document
 */
router.post('/applications/:applicationId/documents/:documentId/upload', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const { applicationId, documentId } = req.params;

        // Verify application belongs to student
        const application = await Application.findOne({
            _id: applicationId,
            studentId: user._id,
            deletedAt: null
        });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // Find document
        const document = await Document.findOne({
            _id: documentId,
            applicationId,
            visibleToStudent: true,
            deletedAt: null
        });

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        if (!req.fileInfo) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        await document.upload(user._id, {
            filePath: req.fileInfo.path,
            fileName: req.fileInfo.name,
            fileSize: req.fileInfo.size,
            mimeType: req.fileInfo.mimeType
        });

        return res.status(200).json({
            success: true,
            message: 'Document uploaded successfully',
            data: { document }
        });

    } catch (error) {
        console.error('Upload document error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to upload document',
            error: error.message
        });
    }
});

// ============================================
// DASHBOARD SUMMARY
// ============================================

/**
 * GET /api/student/dashboard
 * Get dashboard summary
 */
router.get('/dashboard', requireStudent, async (req, res) => {
    try {
        const user = req.user;

        // Get counts
        const pendingInitials = await Initial.countDocuments({
            email: user.email,
            status: INITIAL_STATUS.APPROVED,
            deletedAt: null
        });

        const applications = await Application.find({
            studentId: user._id,
            deletedAt: null
        }).select('status targetCountry targetUniversity');

        const activeApplications = applications.filter(
            app => !['COMPLETE', 'REJECTED', 'CANCELLED'].includes(app.status)
        ).length;

        // Get pending tasks
        const pendingTasks = await Task.countDocuments({
            applicationId: { $in: applications.map(a => a._id) },
            visibleToStudent: true,
            status: { $in: ['PENDING', 'IN_PROGRESS'] },
            deletedAt: null
        });

        // Get pending documents
        const pendingDocuments = await Document.countDocuments({
            applicationId: { $in: applications.map(a => a._id) },
            visibleToStudent: true,
            status: { $in: ['PENDING', 'REJECTED'] },
            deletedAt: null
        });

        // Get unpaid invoices
        const unpaidInvoices = await Invoice.countDocuments({
            applicationId: { $in: applications.map(a => a._id) },
            status: { $nin: ['APPROVED', 'CANCELLED'] },
            deletedAt: null
        });

        return res.status(200).json({
            success: true,
            data: {
                user: {
                    name: `${user.firstName} ${user.lastName}`,
                    email: user.email
                },
                summary: {
                    pendingInitials,
                    totalApplications: applications.length,
                    activeApplications,
                    pendingTasks,
                    pendingDocuments,
                    unpaidInvoices
                },
                recentApplications: applications.slice(0, 5).map(app => ({
                    id: app._id,
                    targetCountry: app.targetCountry,
                    targetUniversity: app.targetUniversity,
                    status: app.status
                }))
            }
        });

    } catch (error) {
        console.error('Get dashboard error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard',
            error: error.message
        });
    }
});

export default router;