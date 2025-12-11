// routes/consultant/consultant.mjs
import express from 'express';
import mongoose from 'mongoose';
import User from '../../models/Users/_UsersMain.mjs';
import StaffProfile from '../../models/Users/StaffProfile.mjs';
import Country from '../../models/Country/CountryModel.mjs';
import StudentProfile from '../../models/Users/Student.mjs';
import Initial from '../../models/initial/Initial.mjs';
import Application from '../../models/Process/Process.mjs';
import Invoice from '../../models/Invoice/Invoice.mjs';
import Task from '../../models/Task/Tasks.mjs';
import Document from '../../models/Docx/Document.mjs';
import { attachUser, requireRole, requireStaffVerified } from '../../middlewares/Auth.mjs';
import { USER_ROLE, USER_SOURCE, USER_STATUS } from '../../models/Users/_UsersMain.mjs';
import { STAFF_ROLE } from '../../models/Users/StaffProfile.mjs';
import { INITIAL_STATUS } from '../../models/initial/Initial.mjs';
import { APPLICATION_STATUS, CURRENCY } from '../../models/Process/Process.mjs';
import { INVOICE_STATUS, INVOICE_PAYMENT_TYPE } from '../../models/Invoice/Invoice.mjs';
import { TASK_STATUS, TASK_PRIORITY } from '../../models/Task/Tasks.mjs';
import { DOCUMENT_TYPE, DOCUMENT_STATUS } from '../../models/Docx/Document.mjs';
import { uploadSingle } from '../../middlewares/upload.mjs';

const router = express.Router();

// Middleware to verify consultant role
const requireConsultant = [
    attachUser,
    requireStaffVerified,
    async (req, res, next) => {
        const staffProfile = await StaffProfile.findOne({ userId: req.user._id });
        if (!staffProfile || staffProfile.staffRole !== STAFF_ROLE.CONSULTANT) {
            return res.status(403).json({
                success: false,
                message: 'Consultant access required'
            });
        }
        req.staffProfile = staffProfile;
        next();
    }
];

// Helper to get consultant's assigned countries
async function getConsultantCountries(staffProfileId) {
    const countries = await Country.getCountriesByConsultant(staffProfileId);
    return countries.map(c => c.name);
}

// ============================================
// INITIALS
// ============================================

/**
 * GET /api/consultant/initials
 * Get approved initials for consultant's countries
 */
router.get('/initials', requireConsultant, async (req, res) => {
    try {
        const countries = await getConsultantCountries(req.staffProfile._id);

        const query = {
            status: INITIAL_STATUS.APPROVED,
            deletedAt: null
        };

        // Filter by consultant's countries if assigned
        if (countries.length > 0) {
            query.preferredCountry = { $in: countries };
        }

        const initials = await Initial.find(query).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: initials.length,
                assignedCountries: countries,
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
 * GET /api/consultant/initials/:initialId
 * Get specific initial details
 */
router.get('/initials/:initialId', requireConsultant, async (req, res) => {
    try {
        const { initialId } = req.params;

        const initial = await Initial.findOne({
            _id: initialId,
            status: INITIAL_STATUS.APPROVED,
            deletedAt: null
        });

        if (!initial) {
            return res.status(404).json({
                success: false,
                message: 'Initial not found or not approved'
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email: initial.email });
        const studentProfile = existingUser
            ? await StudentProfile.findOne({ userId: existingUser._id })
            : null;

        return res.status(200).json({
            success: true,
            data: {
                initial,
                existingUser: existingUser ? {
                    id: existingUser._id,
                    email: existingUser.email,
                    firstName: existingUser.firstName,
                    lastName: existingUser.lastName,
                    phoneNumber: existingUser.phoneNumber
                } : null,
                studentProfile
            }
        });

    } catch (error) {
        console.error('Get initial error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch initial',
            error: error.message
        });
    }
});

// ============================================
// APPLICATIONS
// ============================================

/**
 * POST /api/consultant/applications
 * Create application from initial
 */
router.post('/applications', requireConsultant, async (req, res) => {
    try {
        const consultantId = req.user._id;
        const {
            initialId,
            targetCountry,
            targetUniversity,
            targetCourse,
            intakePreference,
            budget
        } = req.body;

        // Validate required fields
        if (!initialId || !targetCountry || !targetUniversity || !targetCourse) {
            return res.status(400).json({
                success: false,
                message: 'Initial ID, target country, university, and course are required'
            });
        }

        // Get initial
        const initial = await Initial.findOne({
            _id: initialId,
            status: INITIAL_STATUS.APPROVED,
            deletedAt: null
        });

        if (!initial) {
            return res.status(404).json({
                success: false,
                message: 'Initial not found or not approved'
            });
        }

        // Find or create user
        let user = await User.findOne({ email: initial.email });

        if (!user) {
            user = await User.create({
                email: initial.email,
                firstName: initial.firstName,
                lastName: initial.lastName,
                phoneNumber: initial.phoneNumber,
                role: USER_ROLE.STUDENT,
                source: USER_SOURCE.CONSULTANT,
                status: USER_STATUS.ACTIVE
            });
        }

        // Get student profile if exists
        const studentProfile = await StudentProfile.findOne({ userId: user._id });

        // Create application
        const application = await Application.create({
            studentId: user._id,
            consultantId,
            initialId: initial._id,
            email: user.email,
            firstName: user.firstName || initial.firstName,
            lastName: user.lastName || initial.lastName,
            phoneNumber: user.phoneNumber || initial.phoneNumber,
            nationality: studentProfile?.nationality || null,
            passportNumber: studentProfile?.passportNumber || null,
            passportExpiry: studentProfile?.passportExpiry || null,
            address: studentProfile?.address || null,
            educationLevel: studentProfile?.educationLevel || null,
            targetCountry,
            targetUniversity,
            targetCourse,
            intakePreference: intakePreference || null,
            budget: budget || null,
            status: APPLICATION_STATUS.GATHERING_INFO
        });

        // Mark initial as done
        await initial.markAsDone(consultantId, application._id);

        return res.status(201).json({
            success: true,
            message: 'Application created successfully',
            data: { application }
        });

    } catch (error) {
        console.error('Create application error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create application',
            error: error.message
        });
    }
});

/**
 * GET /api/consultant/applications
 * Get all applications for this consultant
 */
router.get('/applications', requireConsultant, async (req, res) => {
    try {
        const consultantId = req.user._id;
        const { status } = req.query;

        const query = {
            consultantId,
            deletedAt: null
        };

        if (status) {
            query.status = status;
        }

        const applications = await Application.find(query)
            .populate('studentId', 'email firstName lastName phoneNumber')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: applications.length,
                applications
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
 * GET /api/consultant/applications/:applicationId
 * Get specific application details
 */
router.get('/applications/:applicationId', requireConsultant, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const consultantId = req.user._id;

        const application = await Application.findOne({
            _id: applicationId,
            consultantId,
            deletedAt: null
        })
            .populate('studentId', 'email firstName lastName phoneNumber emailVerified phoneVerified')
            .populate('initialId');

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // Get related data counts
        const invoiceCount = await Invoice.countDocuments({ applicationId, deletedAt: null });
        const taskCount = await Task.countDocuments({ applicationId, deletedAt: null });
        const documentCount = await Document.countDocuments({ applicationId, deletedAt: null });

        return res.status(200).json({
            success: true,
            data: {
                application,
                counts: {
                    invoices: invoiceCount,
                    tasks: taskCount,
                    documents: documentCount
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
 * PUT /api/consultant/applications/:applicationId
 * Update application details
 */
router.put('/applications/:applicationId', requireConsultant, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const consultantId = req.user._id;

        const application = await Application.findOne({
            _id: applicationId,
            consultantId,
            deletedAt: null
        });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        const {
            firstName,
            lastName,
            phoneNumber,
            nationality,
            passportNumber,
            passportExpiry,
            address,
            educationLevel,
            targetCountry,
            targetUniversity,
            targetCourse,
            intakePreference,
            budget
        } = req.body;

        // Update allowed fields
        if (firstName) application.firstName = firstName;
        if (lastName) application.lastName = lastName;
        if (phoneNumber) application.phoneNumber = phoneNumber;
        if (nationality !== undefined) application.nationality = nationality;
        if (passportNumber !== undefined) application.passportNumber = passportNumber;
        if (passportExpiry !== undefined) application.passportExpiry = passportExpiry;
        if (address !== undefined) application.address = address;
        if (educationLevel !== undefined) application.educationLevel = educationLevel;
        if (targetCountry) application.targetCountry = targetCountry;
        if (targetUniversity) application.targetUniversity = targetUniversity;
        if (targetCourse) application.targetCourse = targetCourse;
        if (intakePreference !== undefined) application.intakePreference = intakePreference;
        if (budget !== undefined) application.budget = budget;

        await application.save();

        return res.status(200).json({
            success: true,
            message: 'Application updated successfully',
            data: { application }
        });

    } catch (error) {
        console.error('Update application error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update application',
            error: error.message
        });
    }
});

/**
 * PUT /api/consultant/applications/:applicationId/status
 * Update application status
 */
router.put('/applications/:applicationId/status', requireConsultant, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { status, notes } = req.body;
        const consultantId = req.user._id;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        const application = await Application.findOne({
            _id: applicationId,
            consultantId,
            deletedAt: null
        });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        await application.updateStatus(status, consultantId, notes);

        return res.status(200).json({
            success: true,
            message: 'Application status updated successfully',
            data: { application }
        });

    } catch (error) {
        console.error('Update status error:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to update status'
        });
    }
});

// ============================================
// INVOICES
// ============================================

/**
 * POST /api/consultant/applications/:applicationId/invoices
 * Create invoice for application
 */
router.post('/applications/:applicationId/invoices', requireConsultant, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const consultantId = req.user._id;
        const {
            accountantId,
            paymentType,
            amount,
            currency,
            breakdown,
            dueDate,
            notes
        } = req.body;

        // Validate required fields
        if (!paymentType || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Payment type and amount are required'
            });
        }

        // Verify application belongs to consultant
        const application = await Application.findOne({
            _id: applicationId,
            consultantId,
            deletedAt: null
        });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // Verify accountant if provided
        if (accountantId) {
            const accountantProfile = await StaffProfile.findOne({
                userId: accountantId,
                staffRole: STAFF_ROLE.ACCOUNTANT,
                verificationStatus: 'VERIFIED',
                deletedAt: null
            });

            if (!accountantProfile) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid accountant ID'
                });
            }
        }

        // Create invoice
        const invoice = await Invoice.createInvoice({
            applicationId,
            accountantId: accountantId || null,
            paymentType,
            amount,
            currency: currency || CURRENCY.USD,
            breakdown: breakdown || [],
            dueDate: dueDate || null,
            notes: notes || null
        });

        // Update application status if needed
        if (application.status === APPLICATION_STATUS.GATHERING_INFO) {
            await application.updateStatus(APPLICATION_STATUS.INVOICE_PENDING, consultantId, 'Invoice created');
        }

        return res.status(201).json({
            success: true,
            message: 'Invoice created successfully',
            data: { invoice }
        });

    } catch (error) {
        console.error('Create invoice error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create invoice',
            error: error.message
        });
    }
});

/**
 * GET /api/consultant/applications/:applicationId/invoices
 * Get invoices for application
 */
router.get('/applications/:applicationId/invoices', requireConsultant, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const consultantId = req.user._id;

        // Verify application
        const application = await Application.findOne({
            _id: applicationId,
            consultantId,
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
        })
            .populate('accountantId', 'firstName lastName email')
            .sort({ issuedAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: invoices.length,
                invoices
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
 * GET /api/consultant/accountants
 * Get list of available accountants for invoice assignment
 */
router.get('/accountants', requireConsultant, async (req, res) => {
    try {
        const accountantProfiles = await StaffProfile.find({
            staffRole: STAFF_ROLE.ACCOUNTANT,
            verificationStatus: 'VERIFIED',
            deletedAt: null
        }).populate('userId', 'firstName lastName email');

        const accountants = accountantProfiles.map(profile => ({
            id: profile.userId._id,
            name: `${profile.userId.firstName} ${profile.userId.lastName}`,
            email: profile.userId.email
        }));

        return res.status(200).json({
            success: true,
            data: { accountants }
        });

    } catch (error) {
        console.error('Get accountants error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch accountants',
            error: error.message
        });
    }
});

// ============================================
// TASKS
// ============================================

/**
 * POST /api/consultant/applications/:applicationId/tasks
 * Create task for application
 */
router.post('/applications/:applicationId/tasks', requireConsultant, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const consultantId = req.user._id;
        const {
            title,
            description,
            priority,
            visibleToStudent,
            assignedTo,
            dueDate
        } = req.body;

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Task title is required'
            });
        }

        // Verify application
        const application = await Application.findOne({
            _id: applicationId,
            consultantId,
            deletedAt: null
        });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // Check if invoices are paid (at least one approved)
        const approvedInvoice = await Invoice.findOne({
            applicationId,
            status: INVOICE_STATUS.APPROVED,
            deletedAt: null
        });

        if (!approvedInvoice) {
            return res.status(400).json({
                success: false,
                message: 'Cannot create tasks until at least one invoice is approved'
            });
        }

        const task = await Task.create({
            applicationId,
            title,
            description: description || null,
            status: TASK_STATUS.PENDING,
            priority: priority || TASK_PRIORITY.MEDIUM,
            visibleToStudent: visibleToStudent !== false,
            createdBy: consultantId,
            assignedTo: assignedTo || application.studentId,
            dueDate: dueDate || null
        });

        return res.status(201).json({
            success: true,
            message: 'Task created successfully',
            data: { task }
        });

    } catch (error) {
        console.error('Create task error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create task',
            error: error.message
        });
    }
});

/**
 * GET /api/consultant/applications/:applicationId/tasks
 * Get tasks for application
 */
router.get('/applications/:applicationId/tasks', requireConsultant, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const consultantId = req.user._id;

        // Verify application
        const application = await Application.findOne({
            _id: applicationId,
            consultantId,
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
            deletedAt: null
        })
            .populate('assignedTo', 'firstName lastName email')
            .sort({ dueDate: 1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: tasks.length,
                tasks
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
 * PUT /api/consultant/tasks/:taskId
 * Update task
 */
router.put('/tasks/:taskId', requireConsultant, async (req, res) => {
    try {
        const { taskId } = req.params;
        const consultantId = req.user._id;

        const task = await Task.findOne({
            _id: taskId,
            deletedAt: null
        }).populate('applicationId', 'consultantId');

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Verify consultant owns the application
        if (task.applicationId.consultantId.toString() !== consultantId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const {
            title,
            description,
            status,
            priority,
            visibleToStudent,
            assignedTo,
            dueDate,
            completionNotes,
            cancellationReason
        } = req.body;

        if (title) task.title = title;
        if (description !== undefined) task.description = description;
        if (priority) task.priority = priority;
        if (visibleToStudent !== undefined) task.visibleToStudent = visibleToStudent;
        if (assignedTo !== undefined) task.assignedTo = assignedTo;
        if (dueDate !== undefined) task.dueDate = dueDate;

        // Handle status changes
        if (status && status !== task.status) {
            switch (status) {
                case TASK_STATUS.IN_PROGRESS:
                    await task.start();
                    break;
                case TASK_STATUS.COMPLETED:
                    await task.complete(completionNotes);
                    break;
                case TASK_STATUS.CANCELLED:
                    await task.cancel(cancellationReason);
                    break;
                default:
                    task.status = status;
                    await task.save();
            }
        } else {
            await task.save();
        }

        return res.status(200).json({
            success: true,
            message: 'Task updated successfully',
            data: { task }
        });

    } catch (error) {
        console.error('Update task error:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to update task'
        });
    }
});

/**
 * DELETE /api/consultant/tasks/:taskId
 * Delete task
 */
router.delete('/tasks/:taskId', requireConsultant, async (req, res) => {
    try {
        const { taskId } = req.params;
        const consultantId = req.user._id;

        const task = await Task.findOne({
            _id: taskId,
            deletedAt: null
        }).populate('applicationId', 'consultantId');

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        if (task.applicationId.consultantId.toString() !== consultantId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        await task.softDelete();

        return res.status(200).json({
            success: true,
            message: 'Task deleted successfully'
        });

    } catch (error) {
        console.error('Delete task error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete task',
            error: error.message
        });
    }
});

// ============================================
// DOCUMENTS
// ============================================

/**
 * POST /api/consultant/applications/:applicationId/documents
 * Request document from student
 */
router.post('/applications/:applicationId/documents', requireConsultant, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const consultantId = req.user._id;
        const {
            documentType,
            name,
            description,
            taskId,
            visibleToStudent,
            expiryDate
        } = req.body;

        if (!documentType || !name) {
            return res.status(400).json({
                success: false,
                message: 'Document type and name are required'
            });
        }

        // Verify application
        const application = await Application.findOne({
            _id: applicationId,
            consultantId,
            deletedAt: null
        });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        const document = await Document.createRequest({
            applicationId,
            documentType,
            name,
            description: description || null,
            taskId: taskId || null,
            visibleToStudent: visibleToStudent !== false
        });

        if (expiryDate) {
            document.expiryDate = expiryDate;
            await document.save();
        }

        return res.status(201).json({
            success: true,
            message: 'Document request created successfully',
            data: { document }
        });

    } catch (error) {
        console.error('Request document error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create document request',
            error: error.message
        });
    }
});

/**
 * GET /api/consultant/applications/:applicationId/documents
 * Get documents for application
 */
router.get('/applications/:applicationId/documents', requireConsultant, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const consultantId = req.user._id;

        // Verify application
        const application = await Application.findOne({
            _id: applicationId,
            consultantId,
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
            deletedAt: null
        })
            .populate('uploadedBy', 'firstName lastName')
            .populate('verifiedBy', 'firstName lastName')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: documents.length,
                documents
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
 * POST /api/consultant/documents/:documentId/upload
 * Upload document on behalf of student (walk-in scenario)
 */
router.post('/documents/:documentId/upload', requireConsultant, uploadSingle('document'), async (req, res) => {
    try {
        const { documentId } = req.params;
        const consultantId = req.user._id;

        const document = await Document.findOne({
            _id: documentId,
            deletedAt: null
        }).populate('applicationId', 'consultantId');

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        if (document.applicationId.consultantId.toString() !== consultantId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        if (!req.fileInfo) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        await document.upload(consultantId, {
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

/**
 * PUT /api/consultant/documents/:documentId/verify
 * Verify document
 */
router.put('/documents/:documentId/verify', requireConsultant, async (req, res) => {
    try {
        const { documentId } = req.params;
        const { notes } = req.body;
        const consultantId = req.user._id;

        const document = await Document.findOne({
            _id: documentId,
            deletedAt: null
        }).populate('applicationId', 'consultantId');

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        if (document.applicationId.consultantId.toString() !== consultantId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        await document.verify(consultantId, notes);

        return res.status(200).json({
            success: true,
            message: 'Document verified successfully',
            data: { document }
        });

    } catch (error) {
        console.error('Verify document error:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to verify document'
        });
    }
});

/**
 * PUT /api/consultant/documents/:documentId/reject
 * Reject document
 */
router.put('/documents/:documentId/reject', requireConsultant, async (req, res) => {
    try {
        const { documentId } = req.params;
        const { reason } = req.body;
        const consultantId = req.user._id;

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required'
            });
        }

        const document = await Document.findOne({
            _id: documentId,
            deletedAt: null
        }).populate('applicationId', 'consultantId');

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        if (document.applicationId.consultantId.toString() !== consultantId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        await document.reject(consultantId, reason);

        return res.status(200).json({
            success: true,
            message: 'Document rejected',
            data: { document }
        });

    } catch (error) {
        console.error('Reject document error:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to reject document'
        });
    }
});

// ============================================
// DASHBOARD & STATISTICS
// ============================================

/**
 * GET /api/consultant/dashboard
 * Get consultant dashboard summary
 */
router.get('/dashboard', requireConsultant, async (req, res) => {
    try {
        const consultantId = req.user._id;
        const countries = await getConsultantCountries(req.staffProfile._id);

        // Pending initials
        const initialQuery = {
            status: INITIAL_STATUS.APPROVED,
            deletedAt: null
        };
        if (countries.length > 0) {
            initialQuery.preferredCountry = { $in: countries };
        }
        const pendingInitials = await Initial.countDocuments(initialQuery);

        // Applications by status
        const applications = await Application.find({
            consultantId,
            deletedAt: null
        }).select('status targetCountry');

        const statusCounts = {};
        applications.forEach(app => {
            statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
        });

        // Pending invoices (not yet approved)
        const pendingInvoices = await Invoice.countDocuments({
            applicationId: { $in: applications.map(a => a._id) },
            status: { $nin: [INVOICE_STATUS.APPROVED, INVOICE_STATUS.CANCELLED] },
            deletedAt: null
        });

        // Pending tasks
        const pendingTasks = await Task.countDocuments({
            applicationId: { $in: applications.map(a => a._id) },
            status: { $in: [TASK_STATUS.PENDING, TASK_STATUS.IN_PROGRESS] },
            deletedAt: null
        });

        // Pending documents
        const pendingDocuments = await Document.countDocuments({
            applicationId: { $in: applications.map(a => a._id) },
            status: { $in: [DOCUMENT_STATUS.PENDING, DOCUMENT_STATUS.UPLOADED] },
            deletedAt: null
        });

        return res.status(200).json({
            success: true,
            data: {
                consultant: {
                    name: `${req.user.firstName} ${req.user.lastName}`,
                    assignedCountries: countries
                },
                summary: {
                    pendingInitials,
                    totalApplications: applications.length,
                    applicationsByStatus: statusCounts,
                    pendingInvoices,
                    pendingTasks,
                    pendingDocuments
                }
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

/**
 * GET /api/consultant/stats
 * Get detailed statistics
 */
router.get('/stats', requireConsultant, async (req, res) => {
    try {
        const consultantId = req.user._id;
        const { startDate, endDate } = req.query;

        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);

        const applicationMatch = {
            consultantId: new mongoose.Types.ObjectId(consultantId),
            deletedAt: null
        };
        if (Object.keys(dateFilter).length > 0) {
            applicationMatch.createdAt = dateFilter;
        }

        // Applications by country
        const byCountry = await Application.aggregate([
            { $match: applicationMatch },
            { $group: { _id: '$targetCountry', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Applications by status
        const byStatus = await Application.aggregate([
            { $match: applicationMatch },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Revenue (approved invoices)
        const applicationIds = await Application.find(applicationMatch).distinct('_id');

        const revenue = await Invoice.aggregate([
            {
                $match: {
                    applicationId: { $in: applicationIds },
                    status: INVOICE_STATUS.APPROVED,
                    deletedAt: null
                }
            },
            {
                $group: {
                    _id: '$currency',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            data: {
                byCountry,
                byStatus,
                revenue
            }
        });

    } catch (error) {
        console.error('Get stats error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
});

export default router;