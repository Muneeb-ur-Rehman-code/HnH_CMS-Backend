// routes/Consultant/Consultant.mjs
import express from 'express';
import mongoose from 'mongoose';
import { attachUser, requireRole } from '../../middlewares/Auth.mjs';
import { USER_ROLE } from '../../models/Users/_UsersMain.mjs';
import { STAFF_ROLE } from '../../models/Users/StaffProfile.mjs';
import Initial, { INITIAL_STATUS } from '../../models/initial/Initial.mjs';
import Process, { PROCESS_STATUS } from '../../models/Process/Process.mjs';
import StudentProfile from '../../models/Users/Student.mjs';
import User from '../../models/Users/_UsersMain.mjs';
import Invoice from '../../models/Invoice/Invoice.mjs';
import StaffProfile, { STAFF_ROLE as ACCOUNTANT_ROLE } from '../../models/Users/StaffProfile.mjs';
import Task from '../../models/Task/Tasks.mjs';
import Document from '../../models/Docx/Document.mjs';

const router = express.Router();

const requireConsultant = [
    attachUser,
    requireRole(STAFF_ROLE.CONSULTANT),
];

// Get all initials assigned to the consultant that are in the 'APPROVED' state
router.get('/initials', requireConsultant, async (req, res) => {
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

// Decline an initial
router.patch('/initials/:initialId/decline', requireConsultant, async (req, res) => {
    try {
        const { initialId } = req.params;
        const initial = await Initial.findById(initialId);

        if (!initial || initial.assignedConsultantId.toString() !== req.user.staffProfile._id.toString()) {
            return res.status(404).json({ success: false, message: 'Initial not found or not assigned to you.' });
        }
        if (initial.status !== INITIAL_STATUS.APPROVED) {
            return res.status(400).json({ success: false, message: `Cannot decline an initial with status '${initial.status}'` });
        }

        initial.status = INITIAL_STATUS.DECLINED;
        await initial.save();
        res.status(200).json({ success: true, message: 'Initial declined successfully.', data: initial });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to decline initial', error: error.message });
    }
});

// Create a process from an initial
router.post('/initials/:initialId/create-process', requireConsultant, async (req, res) => {
    try {
        const { initialId } = req.params;
        const initial = await Initial.findById(initialId).populate({
            path: 'studentId',
            populate: { path: 'user' }
        });

        if (!initial || initial.assignedConsultantId.toString() !== req.user.staffProfile._id.toString()) {
            return res.status(404).json({ success: false, message: 'Initial not found or not assigned to you.' });
        }
        if (initial.status !== INITIAL_STATUS.APPROVED) {
            return res.status(400).json({ success: false, message: `Cannot create a process from an initial with status '${initial.status}'.` });
        }

        const studentUser = initial.studentId.user;
        const studentProfile = initial.studentId;

        const processData = {
            studentId: studentProfile._id,
            initialId: initial._id,
            consultantId: req.user.staffProfile._id,
            applicantData: {
                firstName: studentUser.firstName,
                lastName: studentUser.lastName,
                email: studentUser.email,
                phone: studentUser.phone.number,
                dob: studentUser.dob,
                gender: studentUser.gender,
                nationality: studentProfile.nationality,
                passportNumber: studentProfile.passportNumber,
                passportExpiry: studentProfile.passportExpiry,
                address: studentProfile.address,
                educationLevel: studentProfile.educationLevel,
                currentInstitution: studentProfile.currentInstitution,
                graduationYear: studentProfile.graduationYear,
                lastGpa: studentProfile.lastGpa,
                englishProficiency: studentProfile.englishProficiency
            },
            ...req.body // Any additional fields from the request body
        };

        const newProcess = new Process(processData);
        await newProcess.save();

        initial.status = INITIAL_STATUS.DONE;
        await initial.save();

        res.status(201).json({ success: true, message: 'Process created successfully', data: newProcess });

    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to create process', error: error.message });
    }
});

// Get a process by ID
router.get('/processes/:processId', requireConsultant, async (req, res) => {
    try {
        const { processId } = req.params;
        const process = await Process.findById(processId).populate('initial');
        if (!process || process.consultantId.toString() !== req.user.staffProfile._id.toString()) {
            return res.status(404).json({ success: false, message: 'Process not found or not assigned to you.' });
        }
        res.status(200).json({ success: true, data: process });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch process', error: error.message });
    }
});

// Update a process (only when GATHERING_INFO)
router.put('/processes/:processId', requireConsultant, async (req, res) => {
    try {
        const { processId } = req.params;
        const process = await Process.findById(processId);

        if (!process || process.consultantId.toString() !== req.user.staffProfile._id.toString()) {
            return res.status(404).json({ success: false, message: 'Process not found or not assigned to you.' });
        }
        if (process.status !== PROCESS_STATUS.GATHERING_INFO) {
            return res.status(400).json({ success: false, message: `Cannot update a process with status '${process.status}'.` });
        }

        Object.assign(process, req.body);
        await process.save();

        res.status(200).json({ success: true, message: 'Process updated successfully', data: process });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to update process', error: error.message });
    }
});

// Update process status
router.patch('/processes/:processId/status', requireConsultant, async (req, res) => {
    try {
        const { processId } = req.params;
        const { status, notes } = req.body;
        const process = await Process.findById(processId);

        if (!process || process.consultantId.toString() !== req.user.staffProfile._id.toString()) {
            return res.status(404).json({ success: false, message: 'Process not found or not assigned to you.' });
        }

        await process.updateStatus(status, req.user, notes);
        res.status(200).json({ success: true, message: `Process status updated to ${status}` });

    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Create an invoice for a process
router.post('/processes/:processId/invoices', requireConsultant, async (req, res) => {
    try {
        const { processId } = req.params;
        const process = await Process.findById(processId);

        if (!process || process.consultantId.toString() !== req.user.staffProfile._id.toString()) {
            return res.status(404).json({ success: false, message: 'Process not found or not assigned to you.' });
        }

        const openInvoice = await Invoice.findOne({ processId, status: { $nin: [INVOICE_STATUS.APPROVED, INVOICE_STATUS.CANCELLED] } });
        if (openInvoice) {
            return res.status(400).json({ success: false, message: 'An open invoice already exists for this process.' });
        }

        const invoiceData = { processId, ...req.body };
        const newInvoice = new Invoice(invoiceData);
        await newInvoice.save();

        await process.updateStatus(PROCESS_STATUS.INVOICE_PENDING, req.user, 'Invoice created.');

        res.status(201).json({ success: true, message: 'Invoice created successfully', data: newInvoice });

    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to create invoice', error: error.message });
    }
});

// Get all verified accountants
router.get('/accountants', requireConsultant, async (req, res) => {
    try {
        const accountants = await StaffProfile.find({ staffRole: ACCOUNTANT_ROLE.ACCOUNTANT, verificationStatus: 'VERIFIED' }).populate('user', 'firstName lastName email phone');
        res.status(200).json({ success: true, data: accountants });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch accountants', error: error.message });
    }
});

// Get all verified agents
router.get('/agents', requireConsultant, async (req, res) => {
    try {
        const agents = await StaffProfile.find({ staffRole: STAFF_ROLE.AGENT, verificationStatus: 'VERIFIED' }).populate('user', 'firstName lastName email phone');
        res.status(200).json({ success: true, data: agents });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch agents', error: error.message });
    }
});

// Assign an agent to a process
router.patch('/processes/:processId/assign-agent', requireConsultant, async (req, res) => {
    try {
        const { processId } = req.params;
        const { agentId } = req.body;
        const process = await Process.findById(processId);

        if (!process || process.consultantId.toString() !== req.user.staffProfile._id.toString()) {
            return res.status(404).json({ success: false, message: 'Process not found or not assigned to you.' });
        }

        const agentTasks = await Task.findOne({ processId, createdBy: process.agentId });
        if (agentTasks) {
            return res.status(400).json({ success: false, message: 'Cannot change agent after they have created a task.' });
        }

        process.agentId = agentId;
        await process.save();
        res.status(200).json({ success: true, message: 'Agent assigned successfully.', data: process });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to assign agent', error: error.message });
    }
});

// Create a task for a process
router.post('/processes/:processId/tasks', requireConsultant, async (req, res) => {
    try {
        const { processId } = req.params;
        const taskData = { processId, createdBy: req.user._id, ...req.body };
        const newTask = new Task(taskData);
        await newTask.save();

        if (req.body.documentType) {
            const docData = {
                taskId: newTask._id,
                documentType: req.body.documentType,
                name: req.body.documentName || req.body.documentType,
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

// Review a document
router.patch('/documents/:documentId/review', requireConsultant, async (req, res) => {
    try {
        const { documentId } = req.params;
        const { status, notes } = req.body;
        const doc = await Document.findById(documentId);
        // TODO: Add validation to ensure consultant can only review documents for their processes
        await doc.review(req.user._id, status, notes);
        res.status(200).json({ success: true, message: `Document status updated to ${status}` });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});


export default router;
