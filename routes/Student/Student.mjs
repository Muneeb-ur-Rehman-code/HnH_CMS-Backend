// routes/Student/Student.mjs
import express from 'express';
import StudentProfile from '../../models/Users/Student.mjs';
import User, { USER_ROLE, USER_STATUS, USER_SOURCE } from '../../models/Users/_UsersMain.mjs';
import Initial, { INITIAL_STATUS, INITIAL_TYPE } from '../../models/initial/Initial.mjs';
import Process from '../../models/Process/Process.mjs';
import { PROCESS_STATUS } from '../../config/enums.mjs';
import Invoice, { INVOICE_STATUS, INVOICE_PAYMENT_TYPE } from '../../models/Invoice/Invoice.mjs';
import Task, { TASK_STATUS } from '../../models/Task/Tasks.mjs';
import Document, { DOCUMENT_STATUS } from '../../models/Docx/Document.mjs';
import { attachUser, requireRole, requireOnboardingComplete } from '../../middlewares/Auth.mjs';
import { uploadSingle } from '../../middlewares/upload.mjs';

const router = express.Router();

// Middleware to ensure student is authenticated and onboarded
const requireStudent = [
    attachUser,
    requireRole(USER_ROLE.STUDENT),
    requireOnboardingComplete
];

// ==========================================
// PROFILE ENDPOINTS
// ==========================================

// GET student profile
router.get('/profile', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const studentProfile = await StudentProfile.findOne({ userId: user._id });

        return res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phone: user?.phone?.number || null,
                    dob: user?.dob || null,
                    gender: user?.gender || null
                },
                profile: studentProfile || {}
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch profile',
            error: error.message
        });
    }
});

// PUT update student profile
router.put('/profile', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const {
            nationality,
            passportNumber,
            passportExpiry,
            address,
            educationLevel,
            currentInstitution,
            graduationYear,
            lastGpa,
            englishProficiency
        } = req.body;

        let studentProfile = await StudentProfile.findOne({ userId: user._id });
        if (!studentProfile) {
            studentProfile = await StudentProfile.create({ userId: user._id });
        }

        if (nationality !== undefined) studentProfile.nationality = nationality;
        if (passportNumber !== undefined) studentProfile.passportNumber = passportNumber;
        if (passportExpiry !== undefined) studentProfile.passportExpiry = passportExpiry;
        if (educationLevel !== undefined) studentProfile.educationLevel = educationLevel;
        if (currentInstitution !== undefined) studentProfile.currentInstitution = currentInstitution;
        if (graduationYear !== undefined) studentProfile.graduationYear = graduationYear;
        if (lastGpa !== undefined) studentProfile.lastGpa = lastGpa;

        if (address !== undefined) {
            studentProfile.address = {
                ...studentProfile.address?.toObject?.() || {},
                ...address
            };
        }

        if (englishProficiency !== undefined) {
            studentProfile.englishProficiency = {
                ...studentProfile.englishProficiency?.toObject?.() || {},
                ...englishProficiency
            };
        }

        await studentProfile.save();

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: studentProfile
        });
    } catch (error) {
        return res.status(error.name === 'ValidationError' ? 400 : 500).json({
            success: false,
            message: error.message
        });
    }
});

// ==========================================
// INITIAL / LEAD ENDPOINTS
// ==========================================

// GET all initials for this student (any status)
router.get('/initials', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const studentProfile = await StudentProfile.findOne({ userId: user._id });
        if (!studentProfile) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        const initials = await Initial.find({ studentId: studentProfile._id }).sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            count: initials.length,
            data: initials
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// POST create new initial
router.post('/initials', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const { type, preferredCountry, otherCountry, preferredUniversity, otherUniversity, notes } = req.body;

        if (!type || ![INITIAL_TYPE.STUDY, INITIAL_TYPE.VISIT].includes(type)) {
            return res.status(400).json({ success: false, message: 'Valid type (STUDY or VISIT) is required' });
        }

        const studentProfile = await StudentProfile.findOne({ userId: user._id });
        if (!studentProfile) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        const initial = await Initial.create({
            studentId: studentProfile._id,
            type,
            preferredCountry: preferredCountry || null,
            otherCountry: otherCountry || null,
            preferredUniversity: preferredUniversity || null,
            otherUniversity: otherUniversity || null,
            notes: notes || null,
            status: INITIAL_STATUS.PENDING
        });

        return res.status(201).json({
            success: true,
            message: 'Initial created successfully',
            data: initial
        });
    } catch (error) {
        return res.status(error.name === 'ValidationError' ? 400 : 500).json({
            success: false,
            message: error.message
        });
    }
});

// PUT set initial status to REFUSED (soft delete)
router.put('/initials/:initialId/refuse', requireStudent, async (req, res) => {
    try {
        const { initialId } = req.params;
        const user = req.user;
        const studentProfile = await StudentProfile.findOne({ userId: user._id });

        const initial = await Initial.findOne({ _id: initialId, studentId: studentProfile._id });
        if (!initial) {
            return res.status(404).json({ success: false, message: 'Initial not found' });
        }

        initial.status = INITIAL_STATUS.REFUSED;
        await initial.save();

        return res.status(200).json({
            success: true,
            message: 'Initial marked as refused',
            data: initial
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ==========================================
// PROCESS / APPLICATION ENDPOINTS
// ==========================================

// GET all processes/applications for this student
router.get('/applications', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const studentProfile = await StudentProfile.findOne({ userId: user._id });
        if (!studentProfile) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        const processes = await Process.find({ studentId: studentProfile._id }).sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            count: processes.length,
            data: processes
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET process/application by ID
router.get('/applications/:applicationId', requireStudent, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const user = req.user;
        const studentProfile = await StudentProfile.findOne({ userId: user._id });

        const process = await Process.findOne({ _id: applicationId, studentId: studentProfile._id })
            .populate('consultantId', 'firstName lastName')
            .populate('agentId', 'firstName lastName');

        if (!process) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        return res.status(200).json({
            success: true,
            data: process
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ==========================================
// TASK ENDPOINTS
// ==========================================

// GET all tasks for a process (only visible to student)
router.get('/applications/:applicationId/tasks', requireStudent, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const user = req.user;
        const studentProfile = await StudentProfile.findOne({ userId: user._id });

        const process = await Process.findOne({ _id: applicationId, studentId: studentProfile._id });
        if (!process) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        // Only show tasks that are visibleToStudent
        const tasks = await Task.find({ processId: applicationId, visibleToStudent: true }).sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            count: tasks.length,
            data: tasks
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ==========================================
// DOCUMENT ENDPOINTS
// ==========================================

// GET all documents for a process (only visible to student)
router.get('/applications/:applicationId/documents', requireStudent, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const user = req.user;
        const studentProfile = await StudentProfile.findOne({ userId: user._id });

        const process = await Process.findOne({ _id: applicationId, studentId: studentProfile._id });
        if (!process) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        // Only show documents that are visibleToStudent
        const documents = await Document.find({ processId: applicationId, visibleToStudent: true }).sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            count: documents.length,
            data: documents
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// POST upload document (only if status is PENDING or UPLOADED)
router.post('/applications/:applicationId/documents/:documentId/upload', requireStudent, uploadSingle('file'), async (req, res) => {
    try {
        const { applicationId, documentId } = req.params;
        const user = req.user;
        const studentProfile = await StudentProfile.findOne({ userId: user._id });

        const fileInfo = req.fileInfo;
        if (!fileInfo || !fileInfo.path) {
            return res.status(400).json({ success: false, message: 'File upload failed or not provided' });
        }

        const process = await Process.findOne({ _id: applicationId, studentId: studentProfile._id });
        if (!process) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        const doc = await Document.findOne({ _id: documentId, processId: applicationId });
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }

        if (doc.status !== DOCUMENT_STATUS.PENDING && doc.status !== DOCUMENT_STATUS.UPLOADED) {
            return res.status(400).json({
                success: false,
                message: 'Can only upload to documents with PENDING or UPLOADED status'
            });
        }

        // Use the upload method to handle state changes. Pass stored uploads path
        await doc.upload(user._id, fileInfo.path);
        return res.status(200).json({
            success: true,
            message: 'Document uploaded successfully',
            data: doc
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ==========================================
// INVOICE ENDPOINTS
// ==========================================

// GET invoices for application (only DIRECT payment type)
router.get('/applications/:applicationId/invoices', requireStudent, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const user = req.user;
        const studentProfile = await StudentProfile.findOne({ userId: user._id });

        const process = await Process.findOne({ _id: applicationId, studentId: studentProfile._id });
        if (!process) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        // Only show DIRECT payment type invoices
        const invoices = await Invoice.find({
            processId: applicationId,
            paymentType: INVOICE_PAYMENT_TYPE.DIRECT
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: invoices.length,
            data: invoices
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// POST upload invoice payment screenshot (append to paymentTracking array)
router.post('/applications/:applicationId/invoices/:invoiceId/upload-payment', requireStudent, uploadSingle('file'), async (req, res) => {
    try {
        const { applicationId, invoiceId } = req.params;
        const { paymentMethod, transactionId } = req.body;
        const fileInfo = req.fileInfo;
        const user = req.user;
        const studentProfile = await StudentProfile.findOne({ userId: user._id });

        if (!paymentMethod || !fileInfo || !fileInfo.path) {
            return res.status(400).json({
                success: false,
                message: 'Payment method and file upload are required'
            });
        }

        const process = await Process.findOne({ _id: applicationId, studentId: studentProfile._id });
        if (!process) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        const invoice = await Invoice.findOne({ _id: invoiceId, processId: applicationId, paymentType: INVOICE_PAYMENT_TYPE.DIRECT });
        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        // Append to paymentTracking array using stored uploads path
        invoice.paymentTracking.push({
            paymentMethod,
            transactionId: transactionId || null,
            filePath: fileInfo.path,
            recordedBy: user._id,
            recordedAt: new Date(),
            status: 'PENDING'
        });

        // Change invoice status to PAYMENT_RECEIVED if not already
        if (invoice.status === INVOICE_STATUS.PENDING) {
            invoice.status = INVOICE_STATUS.PAYMENT_RECEIVED;
        }

        await invoice.save();
        return res.status(200).json({
            success: true,
            message: 'Payment uploaded successfully',
            data: invoice
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ==========================================
// PROCESS SUMMARY ENDPOINTS
// ==========================================

// GET process summary (document, task, invoice counts by status)
router.get('/applications/:applicationId/summary', requireStudent, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const user = req.user;
        const studentProfile = await StudentProfile.findOne({ userId: user._id });

        const process = await Process.findOne({ _id: applicationId, studentId: studentProfile._id });
        if (!process) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        // Get visible documents
        const documents = await Document.find({ processId: applicationId, visibleToStudent: true });
        const docCountByStatus = {};
        documents.forEach(doc => {
            docCountByStatus[doc.status] = (docCountByStatus[doc.status] || 0) + 1;
        });

        // Get visible tasks
        const tasks = await Task.find({ processId: applicationId, visibleToStudent: true });
        const taskCountByStatus = {};
        tasks.forEach(task => {
            taskCountByStatus[task.status] = (taskCountByStatus[task.status] || 0) + 1;
        });

        // Get DIRECT payment invoices
        const invoices = await Invoice.find({ processId: applicationId, paymentType: INVOICE_PAYMENT_TYPE.DIRECT });
        const invoiceCountByStatus = {};
        invoices.forEach(inv => {
            invoiceCountByStatus[inv.status] = (invoiceCountByStatus[inv.status] || 0) + 1;
        });

        return res.status(200).json({
            success: true,
            data: {
                processId: applicationId,
                status: process.status,
                documents: {
                    total: documents.length,
                    byStatus: docCountByStatus
                },
                tasks: {
                    total: tasks.length,
                    byStatus: taskCountByStatus
                },
                invoices: {
                    total: invoices.length,
                    byStatus: invoiceCountByStatus
                }
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET all processes summary
router.get('/applications-summary', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const studentProfile = await StudentProfile.findOne({ userId: user._id });
        if (!studentProfile) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        const processes = await Process.find({ studentId: studentProfile._id });
        const summaries = [];

        for (const process of processes) {
            const documents = await Document.find({ processId: process._id, visibleToStudent: true });
            const docCountByStatus = {};
            documents.forEach(doc => {
                docCountByStatus[doc.status] = (docCountByStatus[doc.status] || 0) + 1;
            });

            const tasks = await Task.find({ processId: process._id, visibleToStudent: true });
            const taskCountByStatus = {};
            tasks.forEach(task => {
                taskCountByStatus[task.status] = (taskCountByStatus[task.status] || 0) + 1;
            });

            const invoices = await Invoice.find({ processId: process._id, paymentType: INVOICE_PAYMENT_TYPE.DIRECT });
            const invoiceCountByStatus = {};
            invoices.forEach(inv => {
                invoiceCountByStatus[inv.status] = (invoiceCountByStatus[inv.status] || 0) + 1;
            });

            summaries.push({
                processId: process._id,
                status: process.status,
                documents: {
                    total: documents.length,
                    byStatus: docCountByStatus
                },
                tasks: {
                    total: tasks.length,
                    byStatus: taskCountByStatus
                },
                invoices: {
                    total: invoices.length,
                    byStatus: invoiceCountByStatus
                }
            });
        }

        return res.status(200).json({
            success: true,
            count: summaries.length,
            data: summaries
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ==========================================
// PROCESS CANCELLATION
// ==========================================

// PATCH cancel process (complex logic based on invoice status)
router.patch('/applications/:applicationId/cancel', requireStudent, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const user = req.user;
        const studentProfile = await StudentProfile.findOne({ userId: user._id });

        const process = await Process.findOne({ _id: applicationId, studentId: studentProfile._id });
        if (!process) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        // Get all invoices for this process
        const invoices = await Invoice.find({ processId: applicationId });

        let newProcessStatus = PROCESS_STATUS.WITHDRAWN;

        // Check if any invoice has payment received or approved
        const hasPaymentReceived = invoices.some(inv => inv.status === INVOICE_STATUS.PAYMENT_RECEIVED);
        const hasApproved = invoices.some(inv => inv.status === INVOICE_STATUS.APPROVED);

        if (hasPaymentReceived || hasApproved) {
            newProcessStatus = 'REFUND-PEND';
        }

        process.status = newProcessStatus;
        await process.save();

        // Update tasks: set non-completed/cancelled tasks to WITHDRAWN
        const tasksToUpdate = await Task.find({
            processId: applicationId,
            status: { $nin: [TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED] }
        });
        for (const task of tasksToUpdate) {
            task.status = TASK_STATUS.WITHDRAWN;
            await task.save();
        }

        // Update documents: set non-verified/rejected/cancelled docs to WITHDRAWN
        const docsToUpdate = await Document.find({
            processId: applicationId,
            status: { $nin: [DOCUMENT_STATUS.VERIFIED, DOCUMENT_STATUS.REJECTED, DOCUMENT_STATUS.CANCELLED] }
        });
        for (const doc of docsToUpdate) {
            doc.status = DOCUMENT_STATUS.WITHDRAWN;
            await doc.save();
        }

        return res.status(200).json({
            success: true,
            message: 'Application cancelled successfully',
            data: {
                processId: applicationId,
                newStatus: newProcessStatus
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

export default router;
