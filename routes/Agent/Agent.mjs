// routes/Agent/Agent.mjs
import express from 'express';
import { attachUser, requireRole } from '../../middlewares/Auth.mjs';
import { STAFF_ROLE } from '../../models/Users/StaffProfile.mjs';
import Process from '../../models/Process/Process.mjs';
import { PROCESS_STATUS } from '../../config/enums.mjs';
import { TASK_STATUS } from '../../models/Task/Tasks.mjs';
import Task from '../../models/Task/Tasks.mjs';
import Document from '../../models/Docx/Document.mjs';

const router = express.Router();

// ==========================================
// UNASSIGNED PROCESSES
// ==========================================

// Get all unassigned processes of type PROGRESS
router.get('/unassigned-processes', async (req, res) => {
    try {
        const rtype = req.rtype; // 'STUDY' or 'VISIT' from middleware
        const query = {
            status: PROCESS_STATUS.PROGRESS,
            agentId: null
        };

        const processes = await Process.find(query)
            .populate('studentId', 'firstName lastName email')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: processes.length,
            data: processes
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server Error fetching unassigned processes',
            error: error.message
        });
    }
});

// ==========================================
// ASSIGNMENT
// ==========================================

// Self-assign a process
router.put('/self-assign/:processId', async (req, res) => {
    try {
        const { processId } = req.params;
        const staffId = req.user?.staffProfile?._id;

        if (!staffId) throw { status: 401, message: 'Staff profile not found', code: 'AUTH_ERROR' };

        const process = await Process.findOne({ _id: processId, status: PROCESS_STATUS.PROGRESS, agentId: null });
        if (!process) throw { status: 404, message: 'Process not found or already assigned', code: 'NOT_AVAILABLE' };

        process.agentId = staffId;
        await process.save();
        return res.status(200).json({ success: true, message: 'Self-assigned successfully', data: process });
    } catch (error) {
        return res.status(error.status || 500).json({ success: false, message: error.message, error: error.code || 'SERVER_ERROR' });
    }
});

// Get all processes assigned to the agent
router.get('/my-processes', async (req, res) => {
    try {
        const staffId = req.user?.staffProfile?._id;
        if (!staffId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const processes = await Process.find({ agentId: staffId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, count: processes.length, data: processes });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// Unassign a process (only if agent has not created any tasks)
router.put('/unassign/:processId', async (req, res) => {
    try {
        const { processId } = req.params;
        const staffId = req.user?.staffProfile?._id;
        if (!staffId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const process = await Process.findOne({ _id: processId, agentId: staffId });
        if (!process) return res.status(404).json({ success: false, message: 'Process not found or not assigned to you' });

        // Check if agent has created any tasks on this process
        const taskCount = await Task.countDocuments({ processId, createdBy: staffId });
        if (taskCount > 0) {
            return res.status(400).json({ success: false, message: 'Cannot unassign: you have already created tasks on this process' });
        }

        process.agentId = null;
        await process.save();
        return res.status(200).json({ success: true, message: 'Unassigned successfully', data: process });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// TASK MANAGEMENT
// ==========================================

// Get tasks for a process (created by current agent)
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

// Create a task for a process
router.post('/processes/:processId/tasks', async (req, res) => {
    try {
        const { processId } = req.params;
        const userId = req.user && req.user._id;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const taskData = { processId, createdBy: userId, ...req.body };
        const newTask = new Task(taskData);
        await newTask.save();

        // If a document type is provided, attach a document to the process
        if (req.body.documentType) {
            const docData = {
                processId,
                documentType: req.body.documentType,
                description: req.body.documentDescription || null,
                visibleToStudent: req.body.visibleToStudent !== undefined ? req.body.visibleToStudent : true
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

// Update task status (any → any, except cannot modify withdrawn tasks)
router.patch('/tasks/:taskId/status', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status, notes } = req.body;
        const userId = req.user && req.user._id;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

        // Only the creator can modify their task's status
        if (task.createdBy && task.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Not allowed to modify this task' });
        }

        if (task.status === TASK_STATUS.WITHDRAWN) {
            return res.status(400).json({ success: false, message: 'Cannot modify withdrawn tasks' });
        }

        // Allow any status change
        if (status) task.status = status;
        if (notes) task.notes = notes;

        await task.save();
        return res.status(200).json({ success: true, data: task });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// DOCUMENT MANAGEMENT
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

        const { filePath } = req.body;
        if (!filePath) {
            return res.status(400).json({ success: false, message: 'File path is required' });
        }

        await doc.upload(userId, filePath);
        return res.status(200).json({ success: true, message: 'File uploaded successfully', data: doc });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// Change document status (any → any, except cannot modify withdrawn)
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

        if (status) {
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

// ==========================================
// PROCESS MANAGEMENT
// ==========================================

// Cancel a process (change status to CANCELLED)
router.put('/processes/:processId/cancel', async (req, res) => {
    try {
        const { processId } = req.params;
        const staffId = req.user?.staffProfile?._id;
        if (!staffId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const process = await Process.findOne({ _id: processId, agentId: staffId });
        if (!process) return res.status(404).json({ success: false, message: 'Process not found or not assigned to you' });

        if (process.status === PROCESS_STATUS.CANCELLED) {
            return res.status(400).json({ success: false, message: 'Process is already cancelled' });
        }

        process.status = PROCESS_STATUS.CANCELLED;
        await process.save();
        return res.status(200).json({ success: true, message: 'Process cancelled successfully', data: process });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});


export default router;
