// routes/Consultant/Consultant.mjs
import express from 'express';
import mongoose from 'mongoose';
import { USER_ROLE } from '../../models/Users/_UsersMain.mjs';
import { STAFF_ROLE } from '../../models/Users/StaffProfile.mjs';
import Initial, { INITIAL_STATUS, INITIAL_TYPE } from '../../models/initial/Initial.mjs';
import Process from '../../models/Process/Process.mjs';
import { PROCESS_STATUS, PROCESS_STATUS, ENGLISH_TEST } from '../../config/enums.mjs';
import StudentProfile from '../../models/Users/Student.mjs';
import User from '../../models/Users/_UsersMain.mjs';
import Invoice from '../../models/Invoice/Invoice.mjs';
import StaffProfile, { STAFF_ROLE as ACCOUNTANT_ROLE } from '../../models/Users/StaffProfile.mjs';
import Task, { TASK_STATUS } from '../../models/Task/Tasks.mjs';
import Document from '../../models/Docx/Document.mjs';
import Invoice, { INVOICE_STATUS } from '../../models/Invoice/Invoice.mjs';

const router = express.Router();

const validateProcessData = (data) => {
    if (data.englishProficiency?.testType && !Object.values(ENGLISH_TEST).includes(data.englishProficiency.testType)) throw { status: 400, message: 'Invalid English Test Type', code: 'VALIDATION_ERROR' };
    if (data.applicantEmail && !/^\S+@\S+\.\S+$/.test(data.applicantEmail)) throw { status: 400, message: 'Invalid Email Format', code: 'VALIDATION_ERROR' };
    if (data.lastGpa && (data.lastGpa < 0 || data.lastGpa > 4)) throw { status: 400, message: 'GPA must be between 0 and 4', code: 'VALIDATION_ERROR' };
};

router.get('/unassigned-initials', async (req, res) => {
    try {
        const rtype = req.rtype;
        const query = {
            status: INITIAL_STATUS.APPROVED,
            assignedConsultantId: null
        };
        if (rtype === 'STUDY') {
            query.type = INITIAL_TYPE.STUDY;
        } else if (rtype === 'VISIT') {
            query.type = INITIAL_TYPE.VISIT;
        }
        const initials = await Initial.find(query)
            .populate('studentId', 'firstName lastName email')
            .sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            count: initials.length,
            data: initials
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server Error fetching initials',
            error: error.message
        });
    }
});

// Get all initials assigned to the consultant that are in the 'APPROVED' state
router.get('/initials', async (req, res) => {
    try {
        const consultantId = req.user.staffProfile._id;
        const initials = await Initial.find({
            assignedConsultantId: consultantId,
            status: INITIAL_STATUS.APPROVED
        }).populate('studentId');
        res.status(200).json({ success: true, data: initials });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch initials', error: error.message });
    }
});



// PUT: /self-assign/:id
router.put('/self-assign/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const staffId = req.user?.staffProfile?._id;

        if (!staffId) throw { status: 401, message: 'Staff profile not found in session', code: 'AUTH_ERROR' };

        const initial = await Initial.findOne({ _id: id, status: INITIAL_STATUS.APPROVED, assignedConsultantId: null });
        if (!initial) throw { status: 404, message: 'Initial not found or already assigned', code: 'NOT_AVAILABLE' };

        initial.assignedConsultantId = staffId;
        await initial.save();
        return res.status(200).json({ success: true, message: 'Assigned successfully', data: initial });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message, error: error.code || 'SERVER_ERROR' });
    }
});

// PUT: /unassign-me/:id
router.put('/unassign-me/:id', async (req, res) => {
    try {
        const staffId = req.user?.staffProfile?._id;
        const initial = await Initial.findOne({ _id: req.params.id, assignedConsultantId: staffId });

        if (!initial) throw { status: 404, message: 'Assignment not found', code: 'NOT_OWNER' };
        if (initial.status === INITIAL_STATUS.DONE) throw { status: 400, message: 'Cannot unassign a completed lead', code: 'LOCKED' };

        initial.assignedConsultantId = null;
        await initial.save();
        return res.status(200).json({ success: true, message: 'Unassigned successfully' });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message });
    }
});

// PUT: /decline/:id
router.put('/decline/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const staffId = req.user?.staffProfile?._id;

        if (!staffId) throw { status: 401, message: 'Staff profile not found', code: 'AUTH_ERROR' };

        const initial = await Initial.findOne({ _id: id, assignedConsultantId: staffId });
        if (!initial) throw { status: 404, message: 'Initial not found or not assigned to you', code: 'NOT_FOUND' };

        if (initial.status !== INITIAL_STATUS.APPROVED) throw { status: 400, message: `Cannot decline initial with status: ${initial.status}`, code: 'INVALID_STATUS' };

        // 3. Use your model's instance method to update status, markedBy, and markedAt
        await initial.markAsDeclined(staffId);

        return res.status(200).json({ success: true, message: 'Initial marked as declined', data: initial });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message, error: error.code || 'SERVER_ERROR' });
    }
});

// GET: /my-declined
router.get('/my-declined', async (req, res) => {
    try {
        const staffId = req.user?.staffProfile?._id;
        if (!staffId) throw { status: 401, message: 'Staff profile not found', code: 'AUTH_ERROR' };

        const initials = await Initial.find({ status: INITIAL_STATUS.DECLINED, markedBy: staffId }).sort({ markedAt: -1 }).populate('studentId', 'firstName lastName email');

        return res.status(200).json({ success: true, count: initials.length, data: initials });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message, error: error.code || 'SERVER_ERROR' });
    }
});

// PUT: /restore-declined/:id
router.put('/restore-declined/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const staffId = req.user?.staffProfile?._id;

        const initial = await Initial.findOne({ _id: id, status: INITIAL_STATUS.DECLINED, markedBy: staffId });
        if (!initial) throw { status: 404, message: 'Declined initial not found or not marked by you', code: 'NOT_FOUND' };

        initial.status = INITIAL_STATUS.APPROVED;
        initial.markedBy = null;
        initial.markedAt = null;

        await initial.save();
        return res.status(200).json({ success: true, message: 'Initial restored to approved status', data: initial });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message, error: error.code || 'SERVER_ERROR' });
    }
});

router.post('/start-process', async (req, res) => {
    try {
        const { initialId, ...body } = req.body;
        const staffId = req.user?.staffProfile?._id;
        if (!initialId || !staffId) throw { status: 400, message: 'Initial ID and Auth required', code: 'MISSING_DATA' };

        const initial = await Initial.findOne({ _id: initialId, assignedConsultantId: staffId, status: 'APPROVED' }).populate('studentId');
        if (!initial) throw { status: 404, message: 'Initial lead not available', code: 'NOT_FOUND' };

        const studentUser = await User.findById(initial.studentId.userId);
        validateProcessData(body);

        const process = new Process({
            studentId: initial.studentId._id,
            initialId: initial._id,
            consultantId: staffId,
            applicantFirstName: body.applicantFirstName || studentUser?.firstName,
            applicantLastName: body.applicantLastName || studentUser?.lastName,
            applicantEmail: body.applicantEmail || studentUser?.email,
            applicantPhone: body.applicantPhone || studentUser?.phone?.number,
            applicantDob: body.applicantDob || studentUser?.dob,
            applicantGender: body.applicantGender || studentUser?.gender,
            nationality: body.nationality || initial.studentId.nationality,
            passportNumber: body.passportNumber || initial.studentId.passportNumber,
            passportExpiry: body.passportExpiry || initial.studentId.passportExpiry,
            address: body.address || initial.studentId.address,
            educationLevel: body.educationLevel || initial.studentId.educationLevel,
            currentInstitution: body.currentInstitution || initial.studentId.currentInstitution,
            graduationYear: body.graduationYear || initial.studentId.graduationYear,
            lastGpa: body.lastGpa || initial.studentId.lastGpa,
            englishProficiency: body.englishProficiency || initial.studentId.englishProficiency,
            targetCourse: body.targetCourse,
            intakePreference: body.intakePreference,
            intakeYear: body.intakeYear,
            budget: body.budget
        });

        // Initialize status using the method
        await process.updateStatus(PROCESS_STATUS.PROGRESS, req.user._id);
        await initial.markAsDone(staffId);

        return res.status(201).json({ success: true, data: process });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message, error: error.code });
    }
});

// GET: /my-processes (with filtering)
router.get('/my-processes', async (req, res) => {
    try {
        const query = { consultantId: req.user.staffProfile._id };
        if (req.query.status) query.status = req.query.status;
        const processes = await Process.find(query).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, count: processes.length, data: processes });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// PUT: /edit-process/:id (Only if status is PROGRESS)
router.put('/edit-process/:id', async (req, res) => {
    try {
        validateProcessData(req.body);
        const process = await Process.findOne({ _id: req.params.id, consultantId: req.user.staffProfile._id });
        if (!process) throw { status: 404, message: 'Process not found', code: 'NOT_FOUND' };
        if (process.status !== PROCESS_STATUS.PROGRESS) throw { status: 400, message: 'Can only edit during PROGRESS state', code: 'LOCKED' };

        Object.assign(process, req.body);
        await process.save();
        return res.status(200).json({ success: true, data: process });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message });
    }
});

// GET: /process/:id
router.get('/process/:id', async (req, res) => {
    try {
        const process = await Process.findOne({ _id: req.params.id, consultantId: req.user.staffProfile._id })
            .populate('studentId')
            .populate('initialId');
        if (!process) throw { status: 404, message: 'Process not found', code: 'NOT_FOUND' };
        return res.status(200).json({ success: true, data: process });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message });
    }
});

// --- STATUS TRANSITION ROUTES ---

// PROGRESS -> CANCELLED
router.put('/process/cancel/:id', async (req, res) => {
    try {
        const process = await Process.findOne({ _id: req.params.id, consultantId: req.user.staffProfile._id });
        if (!process || process.status !== PROCESS_STATUS.PROGRESS) throw { status: 400, message: 'Invalid transition', code: 'TRANSITION_ERROR' };
        await process.updateStatus(PROCESS_STATUS.CANCELLED, req.user._id);
        return res.status(200).json({ success: true, data: process });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message });
    }
});

// CANCELLED -> PROGRESS (Resume)
router.put('/process/resume/:id', async (req, res) => {
    try {
        const process = await Process.findOne({ _id: req.params.id, consultantId: req.user.staffProfile._id });
        if (!process || process.status !== PROCESS_STATUS.CANCELLED) throw { status: 400, message: 'Process is not cancelled', code: 'TRANSITION_ERROR' };
        await process.updateStatus(PROCESS_STATUS.PROGRESS, req.user._id);
        return res.status(200).json({ success: true, data: process });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message });
    }
});

// PROGRESS -> DONE (Finalize)
router.put('/process/done/:id', async (req, res) => {
    try {
        const process = await Process.findOne({ _id: req.params.id, consultantId: req.user.staffProfile._id });
        if (!process || process.status !== PROCESS_STATUS.PROGRESS) throw { status: 400, message: 'Only progress leads can be finished', code: 'TRANSITION_ERROR' };
        await process.updateStatus(PROCESS_STATUS.DONE, req.user._id);
        return res.status(200).json({ success: true, data: process });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message });
    }
});

router.post('/invoice/create', async (req, res) => {
    try {
        const { processId, amount, paymentType, currency, breakdown, dueDate } = req.body;
        const staffId = req.user?.staffProfile?._id;

        // Verify process ownership
        const process = await Process.findOne({ _id: processId, consultantId: staffId });
        if (!process) throw { status: 404, message: 'Process not found or unauthorized', code: 'FORBIDDEN' };

        const invoice = await Invoice.create({
            processId,
            amount,
            paymentType,
            currency,
            breakdown,
            dueDate,
            status: INVOICE_STATUS.PENDING
        });

        return res.status(201).json({ success: true, data: invoice });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message });
    }
});

// GET: /process/:processId/invoices
router.get('/process-invoices/:processId', async (req, res) => {
    try {
        const invoices = await Invoice.find({ processId: req.params.processId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: invoices });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// PUT: /invoice/edit/:id
router.put('/invoice/edit/:id', async (req, res) => {
    try {
        const { amount, breakdown, dueDate } = req.body;
        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) throw { status: 404, message: 'Invoice not found' };
        if (invoice.status !== INVOICE_STATUS.PENDING) throw { status: 400, message: 'Only pending invoices can be edited', code: 'LOCKED' };

        // Update fields
        if (amount !== undefined) invoice.amount = amount;
        if (breakdown) invoice.breakdown = breakdown;
        if (dueDate) invoice.dueDate = dueDate;

        await invoice.save();
        return res.status(200).json({ success: true, data: invoice });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message });
    }
});

// PUT: /invoice/decline/:id
router.put('/invoice/decline/:id', async (req, res) => {
    try {
        const { reason } = req.body;
        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) throw { status: 404, message: 'Invoice not found' };
        if (invoice.status !== INVOICE_STATUS.PENDING) throw { status: 400, message: 'Only pending invoices can be declined', code: 'LOCKED' };

        // Set Decline status and record reviewer info
        invoice.status = INVOICE_STATUS.DECLINE;
        invoice.reviewedAt = new Date();
        invoice.reviewedBy = req.user._id;
        invoice.reviewReason = reason || 'Declined by consultant';

        await invoice.save();
        return res.status(200).json({ success: true, message: 'Invoice declined', data: invoice });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message });
    }
});



// Get tasks for a process created by the current consultant
router.get('/processes/:processId/tasks', async (req, res) => {
    try {
        const { processId } = req.params;
        const userId = req.user && req.user._id;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const tasks = await Task.find({ processId, createdBy: userId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, count: tasks.length, data: tasks });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// Edit a task (only if not withdrawn)
router.put('/tasks/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user && req.user._id;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

        // Only the creator can edit their task
        if (task.createdBy && task.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Not allowed to edit this task' });
        }

        if (task.status === TASK_STATUS.WITHDRAWN) {
            return res.status(400).json({ success: false, message: 'Cannot edit withdrawn tasks' });
        }

        // Allow editing of title, description, visibleToStudent, notes
        const { title, description, visibleToStudent, notes } = req.body;
        if (title) task.title = title;
        if (description !== undefined) task.description = description;
        if (visibleToStudent !== undefined) task.visibleToStudent = visibleToStudent;
        if (notes !== undefined) task.notes = notes;

        await task.save();
        return res.status(200).json({ success: true, data: task });
    } catch (error) {
        return res.status(error.name === 'ValidationError' ? 400 : 500).json({ success: false, message: error.message });
    }
});

// Create a task for a process
router.post('/processes/:processId/tasks', async (req, res) => {
    try {
        const { processId } = req.params;
        const userId = req.user && req.user._id;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const taskData = { processId, createdBy: userId, ...req.body };
        const newTask = new Task(taskData);
        await newTask.save();

        // If a document type is provided, attach a document to the process (no name field)
        if (req.body.documentType) {
            const docData = {
                processId,
                documentType: req.body.documentType,
                description: req.body.documentDescription || null
            };
            const newDoc = new Document(docData);
            await newDoc.save();
        }

        res.status(201).json({ success: true, message: 'Task created successfully', data: newTask });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to create task', error: error.message });
    }
});

// Update task status (consultant can set any status except cannot modify withdrawn tasks)
router.patch('/tasks/:taskId/status', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status, notes } = req.body;
        const userId = req.user && req.user._id;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

        // Only the creator can modify their task's status via this route
        if (task.createdBy && task.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Not allowed to modify this task' });
        }

        if (task.status === TASK_STATUS.WITHDRAWN) {
            return res.status(400).json({ success: false, message: 'Cannot modify withdrawn tasks' });
        }

        // Allow any status change (no enforced transitions)
        if (status) task.status = status;
        if (notes) task.notes = notes;

        await task.save();
        return res.status(200).json({ success: true, data: task });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// DOCUMENT MANAGEMENT ENDPOINTS
// ==========================================

// Get documents for a process
router.get('/processes/:processId/documents', async (req, res) => {
    try {
        const { processId } = req.params;
        const documents = await Document.find({ processId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, count: documents.length, data: documents });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// Create a document for a process
router.post('/processes/:processId/documents', async (req, res) => {
    try {
        const { processId } = req.params;
        const { documentType, description, visibleToStudent } = req.body;

        if (!documentType) {
            return res.status(400).json({ success: false, message: 'Document type is required' });
        }

        const docData = {
            processId,
            documentType,
            description: description || null,
            visibleToStudent: visibleToStudent !== undefined ? visibleToStudent : true
        };

        const newDoc = new Document(docData);
        await newDoc.save();
        return res.status(201).json({ success: true, message: 'Document created successfully', data: newDoc });
    } catch (error) {
        return res.status(error.name === 'ValidationError' ? 400 : 500).json({ success: false, message: error.message });
    }
});

// Edit a document (only if not withdrawn)
router.put('/documents/:documentId', async (req, res) => {
    try {
        const { documentId } = req.params;
        const doc = await Document.findById(documentId);

        if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

        if (doc.status === 'WITHDRAWN') {
            return res.status(400).json({ success: false, message: 'Cannot edit withdrawn documents' });
        }

        // Allow editing of documentType, description, visibleToStudent
        const { documentType, description, visibleToStudent } = req.body;
        if (documentType) doc.documentType = documentType;
        if (description !== undefined) doc.description = description;
        if (visibleToStudent !== undefined) doc.visibleToStudent = visibleToStudent;

        await doc.save();
        return res.status(200).json({ success: true, data: doc });
    } catch (error) {
        return res.status(error.name === 'ValidationError' ? 400 : 500).json({ success: false, message: error.message });
    }
});

// Upload file to a document (only if not withdrawn)
router.post('/documents/:documentId/upload', async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user && req.user._id;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const doc = await Document.findById(documentId);
        if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

        if (doc.status === 'WITHDRAWN') {
            return res.status(400).json({ success: false, message: 'Cannot upload to withdrawn documents' });
        }

        // Get file path from request (assuming file upload middleware provides it)
        const { filePath } = req.body;
        if (!filePath) {
            return res.status(400).json({ success: false, message: 'File path is required' });
        }

        // Use the document's upload method
        await doc.upload(userId, filePath);
        return res.status(200).json({ success: true, message: 'File uploaded successfully', data: doc });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// Change document status (only if not withdrawn)
router.patch('/documents/:documentId/status', async (req, res) => {
    try {
        const { documentId } = req.params;
        const { status, notes } = req.body;
        const userId = req.user && req.user._id;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const doc = await Document.findById(documentId);
        if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

        if (doc.status === 'WITHDRAWN') {
            return res.status(400).json({ success: false, message: 'Cannot modify withdrawn documents' });
        }

        // Allow any status change except transitions from withdrawn
        if (status) {
            // For review-like statuses, use review method if available
            if ([doc.DOCUMENT_STATUS?.VERIFIED, doc.DOCUMENT_STATUS?.REJECTED].includes(status)) {
                if (status === 'VERIFIED' || (status === 'REJECTED' && notes)) {
                    await doc.review(userId, status, notes);
                } else {
                    return res.status(400).json({ success: false, message: 'Rejection requires notes' });
                }
            } else {
                doc.status = status;
                if (notes) doc.notes = notes;
                await doc.save();
            }
        }

        return res.status(200).json({ success: true, data: doc });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});



export default router;
