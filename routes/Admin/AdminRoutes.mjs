// routes/Admin/AdminRoutes.mjs
import express from 'express';
import { attachUser, requireRole } from '../../middlewares/Auth.mjs';
import { STAFF_ROLE } from '../../models/Users/StaffProfile.mjs';
import StaffProfile, { STAFF_VERIFICATION_STATUS } from '../../models/Users/StaffProfile.mjs';
import Invoice, { INVOICE_STATUS } from '../../models/Invoice/Invoice.mjs';
import Process from '../../models/Process/Process.mjs';
import { PROCESS_STATUS } from '../../config/enums.mjs';
import Task, { TASK_STATUS } from '../../models/Task/Tasks.mjs';
import Document, { DOCUMENT_STATUS } from '../../models/Docx/Document.mjs';
import University from '../../models/University/UniModel.mjs';
import Country from '../../models/Country/CountryModel.mjs';

const router = express.Router();

const requireAdmin = [
    attachUser,
    requireRole(STAFF_ROLE.ADMIN),
];

const sendResponse = (res, success, data, error) => {
    if (success) {
        if (Array.isArray(data)) {
            return res.status(200).json({ success: true, count: data.length, data });
        }
        return res.status(200).json({ success: true, data });
    }
    return res.status(error?.status || 500).json({
        success: false,
        message: error?.message || 'Server error',
        code: error?.code || 'SERVER_ERROR'
    });
};

// ============================================
// ROUTES: STAFF MANAGEMENT (Admin privileges)
// ============================================

/**
 * GET /admin/staff
 * Get all staff list (admin version with more details)
 */
router.get('/staff', requireAdmin, async (req, res) => {
    try {
        const { role, status } = req.query;

        let query = {};

        if (role) {
            const roleArray = role.split(',').map(r => r.trim().toUpperCase());
            const validRoles = Object.values(STAFF_ROLE);
            const invalidRoles = roleArray.filter(r => !validRoles.includes(r));

            if (invalidRoles.length > 0) {
                return sendResponse(res, false, null, {
                    status: 400,
                    message: `Invalid role(s): ${invalidRoles.join(', ')}`,
                    code: 'INVALID_ROLE'
                });
            }

            query.staffRole = { $in: roleArray };
        }

        if (status) {
            const statusArray = status.split(',').map(s => s.trim().toUpperCase());
            const validStatuses = Object.values(STAFF_VERIFICATION_STATUS);
            const invalidStatuses = statusArray.filter(s => !validStatuses.includes(s));

            if (invalidStatuses.length > 0) {
                return sendResponse(res, false, null, {
                    status: 400,
                    message: `Invalid status(es): ${invalidStatuses.join(', ')}`,
                    code: 'INVALID_STATUS'
                });
            }

            query.verificationStatus = { $in: statusArray };
        }

        const staff = await StaffProfile.find(query)
            .populate('userId', 'email firstName lastName phone status')
            .sort({ createdAt: -1 });

        return sendResponse(res, true, staff);
    } catch (error) {
        console.error('Error fetching staff:', error);
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch staff', code: 'FETCH_ERROR' });
    }
});

/**
 * GET /admin/staff/:staffId
 * Get a specific staff member with details
 */
router.get('/staff/:staffId', requireAdmin, async (req, res) => {
    try {
        const { staffId } = req.params;

        const staff = await StaffProfile.findById(staffId)
            .populate('userId', 'email firstName lastName phone status');

        if (!staff) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Staff member not found',
                code: 'NOT_FOUND'
            });
        }

        return sendResponse(res, true, staff);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch staff', code: 'FETCH_ERROR' });
    }
});

/**
 * PATCH /admin/staff/:staffId/verify
 * Verify a staff member
 */
router.patch('/staff/:staffId/verify', requireAdmin, async (req, res) => {
    try {
        const { staffId } = req.params;

        const staff = await StaffProfile.findById(staffId);
        if (!staff) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Staff member not found',
                code: 'NOT_FOUND'
            });
        }

        if (staff.verificationStatus === STAFF_VERIFICATION_STATUS.VERIFIED) {
            return sendResponse(res, false, null, {
                status: 400,
                message: 'Staff member is already verified',
                code: 'ALREADY_VERIFIED'
            });
        }

        staff.verificationStatus = STAFF_VERIFICATION_STATUS.VERIFIED;
        staff.rejectionReason = null;
        await staff.save();

        const populated = await StaffProfile.findById(staffId)
            .populate('userId', 'email firstName lastName phone status');

        return sendResponse(res, true, populated);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to verify staff', code: 'VERIFY_ERROR' });
    }
});

/**
 * PATCH /admin/staff/:staffId/reject
 * Reject a staff member
 */
router.patch('/staff/:staffId/reject', requireAdmin, async (req, res) => {
    try {
        const { staffId } = req.params;
        const { reason } = req.body;

        const staff = await StaffProfile.findById(staffId);
        if (!staff) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Staff member not found',
                code: 'NOT_FOUND'
            });
        }

        staff.verificationStatus = STAFF_VERIFICATION_STATUS.REJECTED;
        staff.rejectionReason = reason ? reason.trim() : null;
        await staff.save();

        const populated = await StaffProfile.findById(staffId)
            .populate('userId', 'email firstName lastName phone status');

        return sendResponse(res, true, populated);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to reject staff', code: 'REJECT_ERROR' });
    }
});

/**
 * PATCH /admin/staff/:staffId/role
 * Change a staff member's role
 */
router.patch('/staff/:staffId/role', requireAdmin, async (req, res) => {
    try {
        const { staffId } = req.params;
        const { staffRole } = req.body;

        if (!staffRole) {
            return sendResponse(res, false, null, {
                status: 400,
                message: 'Staff role is required',
                code: 'ROLE_REQUIRED'
            });
        }

        if (!Object.values(STAFF_ROLE).includes(staffRole.toUpperCase())) {
            return sendResponse(res, false, null, {
                status: 400,
                message: 'Invalid staff role',
                code: 'INVALID_ROLE'
            });
        }

        const staff = await StaffProfile.findById(staffId);
        if (!staff) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Staff member not found',
                code: 'NOT_FOUND'
            });
        }

        staff.staffRole = staffRole.toUpperCase();
        await staff.save();

        const populated = await StaffProfile.findById(staffId)
            .populate('userId', 'email firstName lastName phone status');

        return sendResponse(res, true, populated);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to update staff role', code: 'UPDATE_ERROR' });
    }
});

/**
 * PATCH /admin/staff/:staffId/status
 * Change staff verification status
 */
router.patch('/staff/:staffId/status', requireAdmin, async (req, res) => {
    try {
        const { staffId } = req.params;
        const { verificationStatus } = req.body;

        if (!verificationStatus) {
            return sendResponse(res, false, null, {
                status: 400,
                message: 'Verification status is required',
                code: 'STATUS_REQUIRED'
            });
        }

        if (!Object.values(STAFF_VERIFICATION_STATUS).includes(verificationStatus.toUpperCase())) {
            return sendResponse(res, false, null, {
                status: 400,
                message: 'Invalid verification status',
                code: 'INVALID_STATUS'
            });
        }

        const staff = await StaffProfile.findById(staffId);
        if (!staff) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Staff member not found',
                code: 'NOT_FOUND'
            });
        }

        staff.verificationStatus = verificationStatus.toUpperCase();
        await staff.save();

        const populated = await StaffProfile.findById(staffId)
            .populate('userId', 'email firstName lastName phone status');

        return sendResponse(res, true, populated);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to update staff status', code: 'UPDATE_ERROR' });
    }
});

// ============================================
// ROUTES: INVOICE MANAGEMENT (Admin privileges)
// ============================================

/**
 * GET /admin/invoices
 * Get all invoices (with admin privileges)
 */
router.get('/invoices', requireAdmin, async (req, res) => {
    try {
        const { status, accountantId } = req.query;

        let query = {};

        if (status) {
            const statusArray = status.split(',').map(s => s.trim().toUpperCase());
            query.status = { $in: statusArray };
        }

        if (accountantId) {
            query.accountantId = accountantId;
        }

        const invoices = await Invoice.find(query)
            .populate('accountantId', 'userId')
            .sort({ createdAt: -1 });

        return sendResponse(res, true, invoices);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch invoices', code: 'FETCH_ERROR' });
    }
});

/**
 * GET /admin/invoices/:invoiceId
 * Get a specific invoice
 */
router.get('/invoices/:invoiceId', requireAdmin, async (req, res) => {
    try {
        const { invoiceId } = req.params;

        const invoice = await Invoice.findById(invoiceId)
            .populate('accountantId', 'userId');

        if (!invoice) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Invoice not found',
                code: 'NOT_FOUND'
            });
        }

        return sendResponse(res, true, invoice);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch invoice', code: 'FETCH_ERROR' });
    }
});

/**
 * PATCH /admin/invoices/:invoiceId/assign-accountant
 * Assign or reassign an invoice to an accountant
 * Can reassign if status is PENDING, STUDENT_CONTACTED, PAYMENT_RECEIVED, or REJECTED
 */
router.patch('/invoices/:invoiceId/assign-accountant', requireAdmin, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { accountantId } = req.body;

        if (!accountantId) {
            return sendResponse(res, false, null, {
                status: 400,
                message: 'Accountant ID is required',
                code: 'ACCOUNTANT_ID_REQUIRED'
            });
        }

        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Invoice not found',
                code: 'NOT_FOUND'
            });
        }

        // Check if accountant exists
        const accountant = await StaffProfile.findById(accountantId);
        if (!accountant || accountant.staffRole !== STAFF_ROLE.ACCOUNTANT) {
            return sendResponse(res, false, null, {
                status: 400,
                message: 'Invalid accountant ID',
                code: 'INVALID_ACCOUNTANT'
            });
        }

        // Can reassign if in editable statuses
        const reassignableStatuses = [
            INVOICE_STATUS.PENDING,
            INVOICE_STATUS.STUDENT_CONTACTED,
            INVOICE_STATUS.PAYMENT_RECEIVED,
            INVOICE_STATUS.REJECTED
        ];

        if (!reassignableStatuses.includes(invoice.status)) {
            return sendResponse(res, false, null, {
                status: 400,
                message: `Cannot reassign an invoice with status '${invoice.status}'`,
                code: 'INVALID_STATUS'
            });
        }

        invoice.accountantId = accountantId;
        await invoice.save();

        const populated = await Invoice.findById(invoiceId)
            .populate('accountantId', 'userId');

        return sendResponse(res, true, populated);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to assign accountant', code: 'ASSIGN_ERROR' });
    }
});

/**
 * PUT /admin/invoices/:invoiceId
 * Update invoice details
 */
router.put('/invoices/:invoiceId', requireAdmin, async (req, res) => {
    try {
        const { invoiceId } = req.params;

        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Invoice not found',
                code: 'NOT_FOUND'
            });
        }

        // Cannot edit if in terminal status
        if ([INVOICE_STATUS.APPROVED, INVOICE_STATUS.CANCELLED].includes(invoice.status)) {
            return sendResponse(res, false, null, {
                status: 400,
                message: `Cannot update an invoice with status '${invoice.status}'`,
                code: 'INVALID_STATUS'
            });
        }

        Object.assign(invoice, req.body);
        await invoice.save();

        return sendResponse(res, true, invoice);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return sendResponse(res, false, null, { status: 400, message: error.message, code: 'VALIDATION_ERROR' });
        }
        return sendResponse(res, false, null, { status: 500, message: 'Failed to update invoice', code: 'UPDATE_ERROR' });
    }
});

/**
 * PATCH /admin/invoices/:invoiceId/status
 * Change invoice status (with admin privileges)
 */
router.patch('/invoices/:invoiceId/status', requireAdmin, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { status, reason } = req.body;

        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Invoice not found',
                code: 'NOT_FOUND'
            });
        }

        await invoice.updateStatus(status, req.user, reason);

        return sendResponse(res, true, invoice);
    } catch (error) {
        return sendResponse(res, false, null, { status: 400, message: error.message, code: 'STATUS_ERROR' });
    }
});

// ============================================
// ROUTES: PROCESS MANAGEMENT (Admin privileges)
// ============================================

/**
 * GET /admin/processes
 * Get all processes (with admin privileges)
 */
router.get('/processes', requireAdmin, async (req, res) => {
    try {
        const { status, consultantId, agentId } = req.query;

        let query = {};

        if (status) {
            const statusArray = status.split(',').map(s => s.trim().toUpperCase());
            query.status = { $in: statusArray };
        }

        if (consultantId) {
            query.consultantId = consultantId;
        }

        if (agentId) {
            query.agentId = agentId;
        }

        const processes = await Process.find(query)
            .populate('consultantId', 'userId')
            .populate('agentId', 'userId')
            .sort({ createdAt: -1 });

        return sendResponse(res, true, processes);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch processes', code: 'FETCH_ERROR' });
    }
});

/**
 * GET /admin/processes/:processId
 * Get a specific process
 */
router.get('/processes/:processId', requireAdmin, async (req, res) => {
    try {
        const { processId } = req.params;

        const process = await Process.findById(processId)
            .populate('consultantId', 'userId')
            .populate('agentId', 'userId');

        if (!process) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Process not found',
                code: 'NOT_FOUND'
            });
        }

        return sendResponse(res, true, process);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch process', code: 'FETCH_ERROR' });
    }
});

/**
 * PATCH /admin/processes/:processId/assign-agent
 * Assign or reassign an agent to a process
 * Can reassign at most stages except terminal ones
 */
router.patch('/processes/:processId/assign-agent', requireAdmin, async (req, res) => {
    try {
        const { processId } = req.params;
        const { agentId } = req.body;

        if (!agentId) {
            return sendResponse(res, false, null, {
                status: 400,
                message: 'Agent ID is required',
                code: 'AGENT_ID_REQUIRED'
            });
        }

        const process = await Process.findById(processId);
        if (!process) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Process not found',
                code: 'NOT_FOUND'
            });
        }

        // Check if agent exists
        const agent = await StaffProfile.findById(agentId);
        if (!agent || agent.staffRole !== STAFF_ROLE.AGENT) {
            return sendResponse(res, false, null, {
                status: 400,
                message: 'Invalid agent ID',
                code: 'INVALID_AGENT'
            });
        }

        // Can reassign at most stages except terminal ones
        const terminalStates = [PROCESS_STATUS.DONE, PROCESS_STATUS.CANCELLED, PROCESS_STATUS.REJECTED, PROCESS_STATUS.REFUND_COMPLETED, PROCESS_STATUS.REFUND_REJECTED, PROCESS_STATUS.DECLINED];
        if (terminalStates.includes(process.status)) {
            return sendResponse(res, false, null, {
                status: 400,
                message: `Cannot assign agent to a process with status '${process.status}'`,
                code: 'INVALID_STATUS'
            });
        }

        process.agentId = agentId;
        await process.save();

        const populated = await Process.findById(processId)
            .populate('consultantId', 'userId')
            .populate('agentId', 'userId');

        return sendResponse(res, true, populated);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to assign agent', code: 'ASSIGN_ERROR' });
    }
});

/**
 * PUT /admin/processes/:processId
 * Update process details
 */
router.put('/processes/:processId', requireAdmin, async (req, res) => {
    try {
        const { processId } = req.params;

        const process = await Process.findById(processId);
        if (!process) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Process not found',
                code: 'NOT_FOUND'
            });
        }

        // Cannot edit in terminal states
        const terminalStates = [PROCESS_STATUS.DONE, PROCESS_STATUS.CANCELLED, PROCESS_STATUS.REJECTED, PROCESS_STATUS.DECLINED];
        if (terminalStates.includes(process.status)) {
            return sendResponse(res, false, null, {
                status: 400,
                message: `Cannot update a process with status '${process.status}'`,
                code: 'INVALID_STATUS'
            });
        }

        Object.assign(process, req.body);
        await process.save();

        return sendResponse(res, true, process);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return sendResponse(res, false, null, { status: 400, message: error.message, code: 'VALIDATION_ERROR' });
        }
        return sendResponse(res, false, null, { status: 500, message: 'Failed to update process', code: 'UPDATE_ERROR' });
    }
});

/**
 * PATCH /admin/processes/:processId/status
 * Change process status with flexible transitions (admin privileges)
 * Allowed transitions:
 * - PROGRESS → CANCELLED, DONE, VERIFIED, REJECTED
 * - REFUND-PEND → REFUND-APPR, REFUND-REJC, REFUND-COMP
 * - REFUND-APPR, REFUND-REJC, REFUND-COMP → REFUND-PEND
 */
router.patch('/processes/:processId/status', requireAdmin, async (req, res) => {
    try {
        const { processId } = req.params;
        const { status, notes } = req.body;

        if (!status) {
            return sendResponse(res, false, null, {
                status: 400,
                message: 'Status is required',
                code: 'MISSING_FIELDS'
            });
        }

        const process = await Process.findById(processId);
        if (!process) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Process not found',
                code: 'NOT_FOUND'
            });
        }

        const currentStatus = process.status;

        // Define flexible transition rules for admin
        const allowedTransitions = {
            [PROCESS_STATUS.PROGRESS]: [PROCESS_STATUS.CANCELLED, PROCESS_STATUS.DONE, PROCESS_STATUS.VERIFIED, PROCESS_STATUS.REJECTED],
            [PROCESS_STATUS.REFUND_PENDING]: [PROCESS_STATUS.REFUND_APPROVED, PROCESS_STATUS.REFUND_REJECTED, PROCESS_STATUS.REFUND_COMPLETED],
            [PROCESS_STATUS.REFUND_APPROVED]: [PROCESS_STATUS.REFUND_PENDING],
            [PROCESS_STATUS.REFUND_REJECTED]: [PROCESS_STATUS.REFUND_PENDING],
            [PROCESS_STATUS.REFUND_COMPLETED]: [PROCESS_STATUS.REFUND_PENDING]
        };

        // Check if transition is allowed
        const allowed = allowedTransitions[currentStatus];
        if (!allowed) {
            return sendResponse(res, false, null, {
                status: 400,
                message: `Cannot change status from ${currentStatus}`,
                code: 'INVALID_TRANSITION'
            });
        }

        if (!allowed.includes(status)) {
            return sendResponse(res, false, null, {
                status: 400,
                message: `Cannot transition from ${currentStatus} to ${status}`,
                code: 'INVALID_TRANSITION'
            });
        }

        process.status = status;
        if (notes) process.notes = notes;
        await process.save();

        const populated = await Process.findById(processId)
            .populate('studentId')
            .populate('consultantId')
            .populate('agentId')
            .populate('universityId')
            .populate('countryId');

        return sendResponse(res, true, populated);
    } catch (error) {
        return sendResponse(res, false, null, { status: 400, message: error.message, code: 'STATUS_ERROR' });
    }
});

// ============================================
// ROUTES: TASK MANAGEMENT (Admin privileges)
// ============================================

/**
 * GET /admin/tasks
 * Get all tasks (with admin privileges)
 */
router.get('/tasks', requireAdmin, async (req, res) => {
    try {
        const { status, processId } = req.query;

        let query = {};

        if (status) {
            const statusArray = status.split(',').map(s => s.trim().toUpperCase());
            query.status = { $in: statusArray };
        }

        if (processId) {
            query.processId = processId;
        }

        const tasks = await Task.find(query)
            .populate('createdBy', 'email firstName lastName')
            .populate('processId')
            .sort({ createdAt: -1 });

        return sendResponse(res, true, tasks);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch tasks', code: 'FETCH_ERROR' });
    }
});

/**
 * GET /admin/tasks/:taskId
 * Get a specific task
 */
router.get('/tasks/:taskId', requireAdmin, async (req, res) => {
    try {
        const { taskId } = req.params;

        const task = await Task.findById(taskId)
            .populate('createdBy', 'email firstName lastName')
            .populate('processId');

        if (!task) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Task not found',
                code: 'NOT_FOUND'
            });
        }

        return sendResponse(res, true, task);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch task', code: 'FETCH_ERROR' });
    }
});

/**
 * POST /admin/processes/:processId/tasks
 * Create a task for a process
 */
router.post('/processes/:processId/tasks', requireAdmin, async (req, res) => {
    try {
        const { processId } = req.params;
        const { title, description, dueDate, visibleToStudent } = req.body;

        if (!title) {
            return sendResponse(res, false, null, {
                status: 400,
                message: 'Task title is required',
                code: 'TITLE_REQUIRED'
            });
        }

        const process = await Process.findById(processId);
        if (!process) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Process not found',
                code: 'NOT_FOUND'
            });
        }

        const task = new Task({
            processId,
            title,
            description: description || null,
            dueDate: dueDate || null,
            visibleToStudent: visibleToStudent !== false,
            createdBy: req.user._id
        });

        await task.save();

        return sendResponse(res, true, task);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return sendResponse(res, false, null, { status: 400, message: error.message, code: 'VALIDATION_ERROR' });
        }
        return sendResponse(res, false, null, { status: 500, message: 'Failed to create task', code: 'CREATE_ERROR' });
    }
});

/**
 * PUT /admin/tasks/:taskId
 * Update a task
 */
router.put('/tasks/:taskId', requireAdmin, async (req, res) => {
    try {
        const { taskId } = req.params;

        const task = await Task.findById(taskId);
        if (!task) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Task not found',
                code: 'NOT_FOUND'
            });
        }

        // Cannot edit completed or declined tasks
        if ([TASK_STATUS.COMPLETED, TASK_STATUS.DECLINED].includes(task.status)) {
            return sendResponse(res, false, null, {
                status: 400,
                message: `Cannot update a task with status '${task.status}'`,
                code: 'INVALID_STATUS'
            });
        }

        Object.assign(task, req.body);
        await task.save();

        return sendResponse(res, true, task);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return sendResponse(res, false, null, { status: 400, message: error.message, code: 'VALIDATION_ERROR' });
        }
        return sendResponse(res, false, null, { status: 500, message: 'Failed to update task', code: 'UPDATE_ERROR' });
    }
});

/**
 * PATCH /admin/tasks/:taskId/status
 * Update task status
 */
router.patch('/tasks/:taskId/status', requireAdmin, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status } = req.body;

        if (!status || !Object.values(TASK_STATUS).includes(status.toUpperCase())) {
            return sendResponse(res, false, null, {
                status: 400,
                message: 'Invalid task status',
                code: 'INVALID_STATUS'
            });
        }

        const task = await Task.findById(taskId);
        if (!task) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Task not found',
                code: 'NOT_FOUND'
            });
        }

        task.status = status.toUpperCase();
        await task.save();

        return sendResponse(res, true, task);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to update task status', code: 'UPDATE_ERROR' });
    }
});

// ============================================
// ROUTES: DOCUMENT MANAGEMENT (Admin privileges)
// ============================================

/**
 * GET /admin/documents
 * Get all documents (with admin privileges)
 */
router.get('/documents', requireAdmin, async (req, res) => {
    try {
        const { processId, status } = req.query;

        let query = {};

        if (processId) {
            query.processId = processId;
        }

        if (status) {
            query.status = status.toUpperCase();
        }

        const documents = await Document.find(query)
            .populate('processId')
            .sort({ createdAt: -1 });

        return sendResponse(res, true, documents);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch documents', code: 'FETCH_ERROR' });
    }
});

/**
 * GET /admin/documents/:documentId
 * Get a specific document
 */
router.get('/documents/:documentId', requireAdmin, async (req, res) => {
    try {
        const { documentId } = req.params;

        const document = await Document.findById(documentId)
            .populate('processId');

        if (!document) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Document not found',
                code: 'NOT_FOUND'
            });
        }

        return sendResponse(res, true, document);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch document', code: 'FETCH_ERROR' });
    }
});

/**
 * PATCH /admin/documents/:documentId/status
 * Change document status (any → any)
 */
router.patch('/documents/:documentId/status', requireAdmin, async (req, res) => {
    try {
        const { documentId } = req.params;
        const { status } = req.body;

        if (!status) {
            return sendResponse(res, false, null, {
                status: 400,
                message: 'Status is required',
                code: 'MISSING_FIELDS'
            });
        }

        const document = await Document.findById(documentId);
        if (!document) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Document not found',
                code: 'NOT_FOUND'
            });
        }

        if (!Object.values(DOCUMENT_STATUS).includes(status.toUpperCase())) {
            return sendResponse(res, false, null, {
                status: 400,
                message: 'Invalid status',
                code: 'INVALID_STATUS'
            });
        }

        document.status = status.toUpperCase();
        await document.save();

        const populated = await Document.findById(documentId).populate('processId');
        return sendResponse(res, true, populated);
    } catch (error) {
        return sendResponse(res, false, null, { status: 400, message: error.message, code: 'STATUS_ERROR' });
    }
});

// ============================================
// ROUTES: UNIVERSITY MANAGEMENT (Admin privileges)
// ============================================

/**
 * GET /admin/universities
 * Get all universities (including deactivated)
 */
router.get('/universities', requireAdmin, async (req, res) => {
    try {
        const { active } = req.query;
        let query = {};

        // If active is specified, filter by deactivatedAt
        if (active === 'true') {
            query.deactivatedAt = null;
        } else if (active === 'false') {
            query.deactivatedAt = { $ne: null };
        }

        const universities = await University.find(query)
            .populate('country')
            .sort({ name: 1 });

        return sendResponse(res, true, universities);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch universities', code: 'FETCH_ERROR' });
    }
});

/**
 * GET /admin/universities/:universityId
 * Get a specific university
 */
router.get('/universities/:universityId', requireAdmin, async (req, res) => {
    try {
        const { universityId } = req.params;
        const university = await University.findById(universityId).populate('country');

        if (!university) {
            return sendResponse(res, false, null, { status: 404, message: 'University not found', code: 'NOT_FOUND' });
        }

        return sendResponse(res, true, university);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch university', code: 'FETCH_ERROR' });
    }
});

/**
 * POST /admin/universities
 * Create a new university
 */
router.post('/universities', requireAdmin, async (req, res) => {
    try {
        const { name, country, code, website, location } = req.body;

        if (!name || !country) {
            return sendResponse(res, false, null, { status: 400, message: 'Name and country are required', code: 'MISSING_FIELDS' });
        }

        const countryDoc = await Country.findById(country);
        if (!countryDoc) {
            return sendResponse(res, false, null, { status: 404, message: 'Country not found', code: 'NOT_FOUND' });
        }

        const university = await University.create({
            name: name.trim(),
            country,
            code: code || null,
            website: website || null,
            location: location || null
        });

        const populated = await University.findById(university._id).populate('country');
        return sendResponse(res, true, populated);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return sendResponse(res, false, null, { status: 400, message: error.message, code: 'VALIDATION_ERROR' });
        }
        return sendResponse(res, false, null, { status: 500, message: 'Failed to create university', code: 'CREATE_ERROR' });
    }
});

/**
 * PUT /admin/universities/:universityId
 * Update a university
 */
router.put('/universities/:universityId', requireAdmin, async (req, res) => {
    try {
        const { universityId } = req.params;
        const { name, country, code, website, location } = req.body;

        const university = await University.findById(universityId);
        if (!university) {
            return sendResponse(res, false, null, { status: 404, message: 'University not found', code: 'NOT_FOUND' });
        }

        if (name !== undefined) university.name = name.trim();
        if (country !== undefined) {
            const countryDoc = await Country.findById(country);
            if (!countryDoc) {
                return sendResponse(res, false, null, { status: 404, message: 'Country not found', code: 'NOT_FOUND' });
            }
            university.country = country;
        }
        if (code !== undefined) university.code = code || null;
        if (website !== undefined) university.website = website || null;
        if (location !== undefined) university.location = location || null;

        await university.save();
        const populated = await University.findById(universityId).populate('country');
        return sendResponse(res, true, populated);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return sendResponse(res, false, null, { status: 400, message: error.message, code: 'VALIDATION_ERROR' });
        }
        return sendResponse(res, false, null, { status: 500, message: 'Failed to update university', code: 'UPDATE_ERROR' });
    }
});

/**
 * PATCH /admin/universities/:universityId/deactivate
 * Deactivate a university
 */
router.patch('/universities/:universityId/deactivate', requireAdmin, async (req, res) => {
    try {
        const { universityId } = req.params;
        const university = await University.findById(universityId);

        if (!university) {
            return sendResponse(res, false, null, { status: 404, message: 'University not found', code: 'NOT_FOUND' });
        }

        if (university.deactivatedAt) {
            return sendResponse(res, false, null, { status: 400, message: 'University is already deactivated', code: 'ALREADY_DEACTIVATED' });
        }

        university.deactivatedAt = new Date();
        await university.save();

        const populated = await University.findById(universityId).populate('country');
        return sendResponse(res, true, populated);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to deactivate university', code: 'DEACTIVATE_ERROR' });
    }
});

/**
 * PATCH /admin/universities/:universityId/activate
 * Activate a university
 */
router.patch('/universities/:universityId/activate', requireAdmin, async (req, res) => {
    try {
        const { universityId } = req.params;
        const university = await University.findById(universityId);

        if (!university) {
            return sendResponse(res, false, null, { status: 404, message: 'University not found', code: 'NOT_FOUND' });
        }

        if (!university.deactivatedAt) {
            return sendResponse(res, false, null, { status: 400, message: 'University is already active', code: 'ALREADY_ACTIVE' });
        }

        university.deactivatedAt = null;
        await university.save();

        const populated = await University.findById(universityId).populate('country');
        return sendResponse(res, true, populated);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to activate university', code: 'ACTIVATE_ERROR' });
    }
});

// ============================================
// ROUTES: COUNTRY MANAGEMENT (Admin privileges)
// ============================================

/**
 * GET /admin/countries
 * Get all countries (including deactivated)
 */
router.get('/countries', requireAdmin, async (req, res) => {
    try {
        const { active } = req.query;
        let query = {};

        if (active === 'true') {
            query.deactivatedAt = null;
        } else if (active === 'false') {
            query.deactivatedAt = { $ne: null };
        }

        const countries = await Country.find(query).sort({ name: 1 });
        return sendResponse(res, true, countries);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch countries', code: 'FETCH_ERROR' });
    }
});

/**
 * GET /admin/countries/:countryId
 * Get a specific country
 */
router.get('/countries/:countryId', requireAdmin, async (req, res) => {
    try {
        const { countryId } = req.params;
        const country = await Country.findById(countryId);

        if (!country) {
            return sendResponse(res, false, null, { status: 404, message: 'Country not found', code: 'NOT_FOUND' });
        }

        return sendResponse(res, true, country);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch country', code: 'FETCH_ERROR' });
    }
});

/**
 * POST /admin/countries
 * Create a new country
 */
router.post('/countries', requireAdmin, async (req, res) => {
    try {
        const { name, code, flag } = req.body;

        if (!name) {
            return sendResponse(res, false, null, { status: 400, message: 'Country name is required', code: 'MISSING_FIELDS' });
        }

        const country = await Country.create({
            name: name.trim(),
            code: code || null,
            flag: flag || null
        });

        return sendResponse(res, true, country);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return sendResponse(res, false, null, { status: 400, message: error.message, code: 'VALIDATION_ERROR' });
        }
        return sendResponse(res, false, null, { status: 500, message: 'Failed to create country', code: 'CREATE_ERROR' });
    }
});

/**
 * PUT /admin/countries/:countryId
 * Update a country
 */
router.put('/countries/:countryId', requireAdmin, async (req, res) => {
    try {
        const { countryId } = req.params;
        const { name, code, flag } = req.body;

        const country = await Country.findById(countryId);
        if (!country) {
            return sendResponse(res, false, null, { status: 404, message: 'Country not found', code: 'NOT_FOUND' });
        }

        if (name !== undefined) country.name = name.trim();
        if (code !== undefined) country.code = code || null;
        if (flag !== undefined) country.flag = flag || null;

        await country.save();
        return sendResponse(res, true, country);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return sendResponse(res, false, null, { status: 400, message: error.message, code: 'VALIDATION_ERROR' });
        }
        return sendResponse(res, false, null, { status: 500, message: 'Failed to update country', code: 'UPDATE_ERROR' });
    }
});

/**
 * PATCH /admin/countries/:countryId/deactivate
 * Deactivate a country
 */
router.patch('/countries/:countryId/deactivate', requireAdmin, async (req, res) => {
    try {
        const { countryId } = req.params;
        const country = await Country.findById(countryId);

        if (!country) {
            return sendResponse(res, false, null, { status: 404, message: 'Country not found', code: 'NOT_FOUND' });
        }

        if (country.deactivatedAt) {
            return sendResponse(res, false, null, { status: 400, message: 'Country is already deactivated', code: 'ALREADY_DEACTIVATED' });
        }

        country.deactivatedAt = new Date();
        await country.save();

        return sendResponse(res, true, country);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to deactivate country', code: 'DEACTIVATE_ERROR' });
    }
});

/**
 * PATCH /admin/countries/:countryId/activate
 * Activate a country
 */
router.patch('/countries/:countryId/activate', requireAdmin, async (req, res) => {
    try {
        const { countryId } = req.params;
        const country = await Country.findById(countryId);

        if (!country) {
            return sendResponse(res, false, null, { status: 404, message: 'Country not found', code: 'NOT_FOUND' });
        }

        if (!country.deactivatedAt) {
            return sendResponse(res, false, null, { status: 400, message: 'Country is already active', code: 'ALREADY_ACTIVE' });
        }

        country.deactivatedAt = null;
        await country.save();

        return sendResponse(res, true, country);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to activate country', code: 'ACTIVATE_ERROR' });
    }
});

export default router;
