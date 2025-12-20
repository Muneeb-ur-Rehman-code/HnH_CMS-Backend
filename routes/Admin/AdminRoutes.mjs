// routes/Admin/AdminRoutes.mjs
import express from 'express';
import mongoose from 'mongoose';
import { attachUser, requireRole } from '../../middlewares/Auth.mjs';
import { STAFF_ROLE } from '../../models/Users/StaffProfile.mjs';
import StaffProfile, { STAFF_VERIFICATION_STATUS } from '../../models/Users/StaffProfile.mjs';
import User from '../../models/Users/_UsersMain.mjs';
import Invoice, { INVOICE_STATUS } from '../../models/Invoice/Invoice.mjs';
import Process from '../../models/Process/Process.mjs';
import { PROCESS_STATUS } from '../../config/enums.mjs';
import Task, { TASK_STATUS } from '../../models/Task/Tasks.mjs';
import Document from '../../models/Docx/Document.mjs';
import Initial, { INITIAL_STATUS } from '../../models/initial/Initial.mjs';

const router = express.Router();

const requireAdmin = [
    attachUser,
    requireRole(STAFF_ROLE.ADMIN),
];

// ============================================
// RESPONSE HELPERS
// ============================================

const sendResponse = (res, success, data, error) => {
    if (success) {
        if (Array.isArray(data)) {
            return res.status(200).json({ success: true, count: data.length, data });
        } else {
            return res.status(200).json({ success: true, data });
        }
    } else {
        return res.status(error?.status || 500).json({
            success: false,
            message: error?.message || 'Server error',
            code: error?.code || 'SERVER_ERROR'
        });
    }
};

// ============================================
// STAFF METRICS - ACCOUNTANT
// ============================================

/**
 * Get accountant performance metrics
 * Returns: total assigned, pending, done/approved, rejected, cancelled
 */
const getAccountantMetrics = async (accountantId) => {
    try {
        const invoices = await Invoice.find({ accountantId });

        const metrics = {
            role: STAFF_ROLE.ACCOUNTANT,
            totalAssigned: invoices.length,
            byStatus: {
                [INVOICE_STATUS.PENDING]: invoices.filter(i => i.status === INVOICE_STATUS.PENDING).length,
                [INVOICE_STATUS.STUDENT_CONTACTED]: invoices.filter(i => i.status === INVOICE_STATUS.STUDENT_CONTACTED).length,
                pending_progress: invoices.filter(i => [INVOICE_STATUS.PENDING, INVOICE_STATUS.STUDENT_CONTACTED].includes(i.status)).length,
                [INVOICE_STATUS.PAYMENT_RECEIVED]: invoices.filter(i => i.status === INVOICE_STATUS.PAYMENT_RECEIVED).length,
                [INVOICE_STATUS.APPROVED]: invoices.filter(i => i.status === INVOICE_STATUS.APPROVED).length,
                done_approved: invoices.filter(i => i.status === INVOICE_STATUS.APPROVED).length,
                [INVOICE_STATUS.REJECTED]: invoices.filter(i => i.status === INVOICE_STATUS.REJECTED).length,
                [INVOICE_STATUS.CANCELLED]: invoices.filter(i => i.status === INVOICE_STATUS.CANCELLED).length,
            },
            invoices: invoices
        };

        return metrics;
    } catch (error) {
        throw error;
    }
};

// ============================================
// STAFF METRICS - CONSULTANT
// ============================================

/**
 * Get consultant performance metrics
 * Returns: total processes, tasks, documents, and their statuses
 */
const getConsultantMetrics = async (consultantId) => {
    try {
        const processes = await Process.find({ consultantId });
        const tasks = await Task.find({
            processId: { $in: processes.map(p => p._id) },
            createdBy: consultantId
        });
        const documents = await Document.find({
            processId: { $in: processes.map(p => p._id) }
        });
        const initials = await Initial.find({ assignedConsultantId: consultantId });

        const metrics = {
            role: STAFF_ROLE.CONSULTANT,
            totalInitials: initials.length,
            initialsByStatus: {
                [INITIAL_STATUS.APPROVED]: initials.filter(i => i.status === INITIAL_STATUS.APPROVED).length,
                [INITIAL_STATUS.PENDING]: initials.filter(i => i.status === INITIAL_STATUS.PENDING).length,
                [INITIAL_STATUS.REJECTED]: initials.filter(i => i.status === INITIAL_STATUS.REJECTED).length,
                [INITIAL_STATUS.DECLINED]: initials.filter(i => i.status === INITIAL_STATUS.DECLINED).length,
                [INITIAL_STATUS.DONE]: initials.filter(i => i.status === INITIAL_STATUS.DONE).length,
            },
            totalProcesses: processes.length,
            processesByStatus: {
                [PROCESS_STATUS.GATHERING_INFO]: processes.filter(p => p.status === PROCESS_STATUS.GATHERING_INFO).length,
                [PROCESS_STATUS.INFO_COMPLETE]: processes.filter(p => p.status === PROCESS_STATUS.INFO_COMPLETE).length,
                [PROCESS_STATUS.INVOICE_PENDING]: processes.filter(p => p.status === PROCESS_STATUS.INVOICE_PENDING).length,
                [PROCESS_STATUS.INVOICE_COMPLETE]: processes.filter(p => p.status === PROCESS_STATUS.INVOICE_COMPLETE).length,
                [PROCESS_STATUS.DOCUMENTS_PENDING]: processes.filter(p => p.status === PROCESS_STATUS.DOCUMENTS_PENDING).length,
                [PROCESS_STATUS.DOCUMENTS_PROCESSING]: processes.filter(p => p.status === PROCESS_STATUS.DOCUMENTS_PROCESSING).length,
                [PROCESS_STATUS.DOCUMENTS_COMPLETE]: processes.filter(p => p.status === PROCESS_STATUS.DOCUMENTS_COMPLETE).length,
                [PROCESS_STATUS.ADMISSION_PENDING]: processes.filter(p => p.status === PROCESS_STATUS.ADMISSION_PENDING).length,
                [PROCESS_STATUS.ADMISSION_PROCESSING]: processes.filter(p => p.status === PROCESS_STATUS.ADMISSION_PROCESSING).length,
                [PROCESS_STATUS.ADMISSION_COMPLETE]: processes.filter(p => p.status === PROCESS_STATUS.ADMISSION_COMPLETE).length,
                [PROCESS_STATUS.VISA_PENDING]: processes.filter(p => p.status === PROCESS_STATUS.VISA_PENDING).length,
                [PROCESS_STATUS.VISA_PROCESSING]: processes.filter(p => p.status === PROCESS_STATUS.VISA_PROCESSING).length,
                [PROCESS_STATUS.VISA_COMPLETE]: processes.filter(p => p.status === PROCESS_STATUS.VISA_COMPLETE).length,
                [PROCESS_STATUS.SUBMITTED]: processes.filter(p => p.status === PROCESS_STATUS.SUBMITTED).length,
                [PROCESS_STATUS.DONE]: processes.filter(p => p.status === PROCESS_STATUS.DONE).length,
                [PROCESS_STATUS.REJECTED]: processes.filter(p => p.status === PROCESS_STATUS.REJECTED).length,
                [PROCESS_STATUS.CANCELLED]: processes.filter(p => p.status === PROCESS_STATUS.CANCELLED).length,
            },
            totalTasks: tasks.length,
            tasksByStatus: {
                [TASK_STATUS.PENDING]: tasks.filter(t => t.status === TASK_STATUS.PENDING).length,
                [TASK_STATUS.IN_PROGRESS]: tasks.filter(t => t.status === TASK_STATUS.IN_PROGRESS).length,
                [TASK_STATUS.COMPLETED]: tasks.filter(t => t.status === TASK_STATUS.COMPLETED).length,
                [TASK_STATUS.CANCELLED]: tasks.filter(t => t.status === TASK_STATUS.CANCELLED).length,
                [TASK_STATUS.DECLINED]: tasks.filter(t => t.status === TASK_STATUS.DECLINED).length,
            },
            totalDocuments: documents.length,
            processes: processes,
            tasks: tasks,
            documents: documents
        };

        return metrics;
    } catch (error) {
        throw error;
    }
};

// ============================================
// STAFF METRICS - AGENT
// ============================================

/**
 * Get agent performance metrics
 * Returns: assigned processes and tasks
 */
const getAgentMetrics = async (agentId) => {
    try {
        const processes = await Process.find({ agentId });
        const tasks = await Task.find({
            processId: { $in: processes.map(p => p._id) }
        });

        const metrics = {
            role: STAFF_ROLE.AGENT,
            totalProcesses: processes.length,
            processesByStatus: {
                [PROCESS_STATUS.ADMISSION_PENDING]: processes.filter(p => p.status === PROCESS_STATUS.ADMISSION_PENDING).length,
                [PROCESS_STATUS.ADMISSION_PROCESSING]: processes.filter(p => p.status === PROCESS_STATUS.ADMISSION_PROCESSING).length,
                [PROCESS_STATUS.ADMISSION_COMPLETE]: processes.filter(p => p.status === PROCESS_STATUS.ADMISSION_COMPLETE).length,
                [PROCESS_STATUS.VISA_PENDING]: processes.filter(p => p.status === PROCESS_STATUS.VISA_PENDING).length,
                [PROCESS_STATUS.VISA_PROCESSING]: processes.filter(p => p.status === PROCESS_STATUS.VISA_PROCESSING).length,
                [PROCESS_STATUS.VISA_COMPLETE]: processes.filter(p => p.status === PROCESS_STATUS.VISA_COMPLETE).length,
                [PROCESS_STATUS.SUBMITTED]: processes.filter(p => p.status === PROCESS_STATUS.SUBMITTED).length,
                [PROCESS_STATUS.DONE]: processes.filter(p => p.status === PROCESS_STATUS.DONE).length,
                [PROCESS_STATUS.REJECTED]: processes.filter(p => p.status === PROCESS_STATUS.REJECTED).length,
                [PROCESS_STATUS.CANCELLED]: processes.filter(p => p.status === PROCESS_STATUS.CANCELLED).length,
            },
            totalTasks: tasks.length,
            tasksByStatus: {
                [TASK_STATUS.PENDING]: tasks.filter(t => t.status === TASK_STATUS.PENDING).length,
                [TASK_STATUS.IN_PROGRESS]: tasks.filter(t => t.status === TASK_STATUS.IN_PROGRESS).length,
                [TASK_STATUS.COMPLETED]: tasks.filter(t => t.status === TASK_STATUS.COMPLETED).length,
                [TASK_STATUS.CANCELLED]: tasks.filter(t => t.status === TASK_STATUS.CANCELLED).length,
                [TASK_STATUS.DECLINED]: tasks.filter(t => t.status === TASK_STATUS.DECLINED).length,
            },
            processes: processes,
            tasks: tasks
        };

        return metrics;
    } catch (error) {
        throw error;
    }
};

// ============================================
// STAFF METRICS - MANAGER
// ============================================

/**
 * Get manager overview metrics
 */
const getManagerMetrics = async (managerId) => {
    try {
        const processes = await Process.find({});

        const metrics = {
            role: STAFF_ROLE.MANAGER,
            totalProcesses: processes.length,
            processesByStatus: {
                [PROCESS_STATUS.GATHERING_INFO]: processes.filter(p => p.status === PROCESS_STATUS.GATHERING_INFO).length,
                [PROCESS_STATUS.INFO_COMPLETE]: processes.filter(p => p.status === PROCESS_STATUS.INFO_COMPLETE).length,
                [PROCESS_STATUS.INVOICE_PENDING]: processes.filter(p => p.status === PROCESS_STATUS.INVOICE_PENDING).length,
                [PROCESS_STATUS.INVOICE_COMPLETE]: processes.filter(p => p.status === PROCESS_STATUS.INVOICE_COMPLETE).length,
                [PROCESS_STATUS.DOCUMENTS_PENDING]: processes.filter(p => p.status === PROCESS_STATUS.DOCUMENTS_PENDING).length,
                [PROCESS_STATUS.DOCUMENTS_COMPLETE]: processes.filter(p => p.status === PROCESS_STATUS.DOCUMENTS_COMPLETE).length,
                [PROCESS_STATUS.ADMISSION_PENDING]: processes.filter(p => p.status === PROCESS_STATUS.ADMISSION_PENDING).length,
                [PROCESS_STATUS.ADMISSION_COMPLETE]: processes.filter(p => p.status === PROCESS_STATUS.ADMISSION_COMPLETE).length,
                [PROCESS_STATUS.VISA_PENDING]: processes.filter(p => p.status === PROCESS_STATUS.VISA_PENDING).length,
                [PROCESS_STATUS.VISA_COMPLETE]: processes.filter(p => p.status === PROCESS_STATUS.VISA_COMPLETE).length,
                [PROCESS_STATUS.SUBMITTED]: processes.filter(p => p.status === PROCESS_STATUS.SUBMITTED).length,
                [PROCESS_STATUS.DONE]: processes.filter(p => p.status === PROCESS_STATUS.DONE).length,
                [PROCESS_STATUS.REJECTED]: processes.filter(p => p.status === PROCESS_STATUS.REJECTED).length,
                [PROCESS_STATUS.CANCELLED]: processes.filter(p => p.status === PROCESS_STATUS.CANCELLED).length,
            },
            processes: processes
        };

        return metrics;
    } catch (error) {
        throw error;
    }
};

// ============================================
// ROUTES: STAFF METRICS
// ============================================

/**
 * GET /admin/metrics/staff?role=ACCOUNTANT
 * Get metrics for all staff, optionally filtered by role
 */
router.get('/metrics/staff', requireAdmin, async (req, res) => {
    try {
        const { role } = req.query;

        let staffQuery = {};
        if (role) {
            if (!Object.values(STAFF_ROLE).includes(role.toUpperCase())) {
                return sendResponse(res, false, null, {
                    status: 400,
                    message: `Invalid staff role: ${role}`,
                    code: 'INVALID_ROLE'
                });
            }
            staffQuery.staffRole = role.toUpperCase();
        }

        const staff = await StaffProfile.find(staffQuery)
            .populate('userId', 'email firstName lastName phone status')
            .lean();

        const metricsPromises = staff.map(async (s) => {
            const staffRole = s.staffRole;

            if (staffRole === STAFF_ROLE.ACCOUNTANT) {
                return getAccountantMetrics(s._id);
            } else if (staffRole === STAFF_ROLE.CONSULTANT) {
                return getConsultantMetrics(s._id);
            } else if (staffRole === STAFF_ROLE.AGENT) {
                return getAgentMetrics(s._id);
            } else if (staffRole === STAFF_ROLE.MANAGER) {
                return getManagerMetrics(s._id);
            }
        });

        const metrics = await Promise.all(metricsPromises);

        const result = staff.map((s, idx) => ({
            staffId: s._id,
            userId: s.userId._id,
            staffRole: s.staffRole,
            email: s.userId.email,
            firstName: s.userId.firstName,
            lastName: s.userId.lastName,
            verificationStatus: s.verificationStatus,
            createdAt: s.createdAt,
            metrics: metrics[idx]
        }));

        return sendResponse(res, true, result);
    } catch (error) {
        console.error('Error fetching staff metrics:', error);
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch staff metrics', code: 'METRICS_ERROR' });
    }
});

/**
 * GET /admin/metrics/staff/:staffId
 * Get detailed metrics for a specific staff member
 */
router.get('/metrics/staff/:staffId', requireAdmin, async (req, res) => {
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

        let metrics;
        switch (staff.staffRole) {
            case STAFF_ROLE.ACCOUNTANT:
                metrics = await getAccountantMetrics(staffId);
                break;
            case STAFF_ROLE.CONSULTANT:
                metrics = await getConsultantMetrics(staffId);
                break;
            case STAFF_ROLE.AGENT:
                metrics = await getAgentMetrics(staffId);
                break;
            case STAFF_ROLE.MANAGER:
                metrics = await getManagerMetrics(staffId);
                break;
            default:
                metrics = {};
        }

        const result = {
            staffId: staff._id,
            userId: staff.userId._id,
            staffRole: staff.staffRole,
            email: staff.userId.email,
            firstName: staff.userId.firstName,
            lastName: staff.userId.lastName,
            verificationStatus: staff.verificationStatus,
            createdAt: staff.createdAt,
            metrics
        };

        return sendResponse(res, true, result);
    } catch (error) {
        console.error('Error fetching staff metrics:', error);
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch staff metrics', code: 'METRICS_ERROR' });
    }
});

/**
 * GET /admin/metrics/staff/role/:role
 * Get metrics for all staff of a specific role
 */
router.get('/metrics/staff/role/:role', requireAdmin, async (req, res) => {
    try {
        const { role } = req.params;

        if (!Object.values(STAFF_ROLE).includes(role.toUpperCase())) {
            return sendResponse(res, false, null, {
                status: 400,
                message: `Invalid staff role: ${role}`,
                code: 'INVALID_ROLE'
            });
        }

        const staff = await StaffProfile.find({ staffRole: role.toUpperCase() })
            .populate('userId', 'email firstName lastName phone status')
            .lean();

        const metricsPromises = staff.map(async (s) => {
            const staffRole = s.staffRole;

            if (staffRole === STAFF_ROLE.ACCOUNTANT) {
                return getAccountantMetrics(s._id);
            } else if (staffRole === STAFF_ROLE.CONSULTANT) {
                return getConsultantMetrics(s._id);
            } else if (staffRole === STAFF_ROLE.AGENT) {
                return getAgentMetrics(s._id);
            } else if (staffRole === STAFF_ROLE.MANAGER) {
                return getManagerMetrics(s._id);
            }
        });

        const metrics = await Promise.all(metricsPromises);

        const result = staff.map((s, idx) => ({
            staffId: s._id,
            userId: s.userId._id,
            staffRole: s.staffRole,
            email: s.userId.email,
            firstName: s.userId.firstName,
            lastName: s.userId.lastName,
            verificationStatus: s.verificationStatus,
            createdAt: s.createdAt,
            metrics: metrics[idx]
        }));

        return sendResponse(res, true, result);
    } catch (error) {
        console.error('Error fetching staff metrics by role:', error);
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch staff metrics', code: 'METRICS_ERROR' });
    }
});

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
 * Change process status (with admin privileges)
 */
router.patch('/processes/:processId/status', requireAdmin, async (req, res) => {
    try {
        const { processId } = req.params;
        const { status, notes } = req.body;

        const process = await Process.findById(processId);
        if (!process) {
            return sendResponse(res, false, null, {
                status: 404,
                message: 'Process not found',
                code: 'NOT_FOUND'
            });
        }

        const fakeUser = { _id: req.user._id, role: STAFF_ROLE.ADMIN };
        await process.updateStatus(status, fakeUser, notes);

        return sendResponse(res, true, process);
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

export default router;
