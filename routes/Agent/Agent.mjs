// routes/Agent/Agent.mjs
import express from 'express';
import { attachUser, requireRole } from '../../middlewares/Auth.mjs';
import { STAFF_ROLE } from '../../models/Users/StaffProfile.mjs';
import Process, { PROCESS_STATUS } from '../../models/Process/Process.mjs';
import Task from '../../models/Task/Tasks.mjs';
import Document from '../../models/Docx/Document.mjs';

const router = express.Router();

const requireAgent = [
    attachUser,
    requireRole(STAFF_ROLE.AGENT),
];

// Get all processes assigned to the agent
router.get('/processes', requireAgent, async (req, res) => {
    try {
        const processes = await Process.find({ agentId: req.user.staffProfile._id });
        res.status(200).json({ success: true, data: processes });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch processes', error: error.message });
    }
});

// Get all unassigned processes in ADMISSION_PENDING state
router.get('/processes/unassigned', requireAgent, async (req, res) => {
    try {
        const processes = await Process.find({ agentId: null, status: PROCESS_STATUS.ADMISSION_PENDING });
        res.status(200).json({ success: true, data: processes });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch unassigned processes', error: error.message });
    }
});

// Assign a process to the current agent
router.patch('/processes/:processId/assign', requireAgent, async (req, res) => {
    try {
        const { processId } = req.params;
        const process = await Process.findById(processId);
        if (!process) {
            return res.status(404).json({ success: false, message: 'Process not found.' });
        }
        if (process.agentId) {
            return res.status(400).json({ success: false, message: 'Process is already assigned.' });
        }
        process.agentId = req.user.staffProfile._id;
        await process.save();
        res.status(200).json({ success: true, message: 'Process assigned successfully.', data: process });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to assign process', error: error.message });
    }
});

// Update process status
router.patch('/processes/:processId/status', requireAgent, async (req, res) => {
    try {
        const { processId } = req.params;
        const { status, notes } = req.body;
        const process = await Process.findById(processId);

        if (!process || process.agentId.toString() !== req.user.staffProfile._id.toString()) {
            return res.status(404).json({ success: false, message: 'Process not found or not assigned to you.' });
        }

        await process.updateStatus(status, req.user, notes);
        res.status(200).json({ success: true, message: `Process status updated to ${status}` });

    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Create a task for a process
router.post('/processes/:processId/tasks', requireAgent, async (req, res) => {
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

export default router;
