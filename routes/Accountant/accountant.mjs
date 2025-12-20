// routes/Accountant/Accountant.mjs
import express from 'express';
import { attachUser, requireRole } from '../../middlewares/Auth.mjs';
import { STAFF_ROLE } from '../../models/Users/StaffProfile.mjs';
import Invoice, { INVOICE_STATUS, PAYMENT_METHOD } from '../../models/Invoice/Invoice.mjs';
import Process from '../../models/Process/Process.mjs';
import { PROCESS_STATUS } from '../../config/enums.mjs';

const router = express.Router();

const requireAccountant = [
    attachUser,
    requireRole(STAFF_ROLE.ACCOUNTANT),
];

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

// Get all unassigned invoices
router.get('/invoices/unassigned', requireAccountant, async (req, res) => {
    try {
        const invoices = await Invoice.find({ accountantId: null, status: INVOICE_STATUS.PENDING });
        return sendResponse(res, true, invoices);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch unassigned invoices', code: 'FETCH_ERROR' });
    }
});

// Assign an invoice to the current accountant
router.patch('/invoices/:invoiceId/assign', requireAccountant, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return sendResponse(res, false, null, { status: 404, message: 'Invoice not found.', code: 'NOT_FOUND' });
        }
        if (invoice.accountantId) {
            return sendResponse(res, false, null, { status: 400, message: 'Invoice is already assigned.', code: 'ALREADY_ASSIGNED' });
        }
        invoice.accountantId = req.user.staffProfile._id;
        await invoice.save();
        return sendResponse(res, true, invoice);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to assign invoice', code: 'ASSIGN_ERROR' });
    }
});

// Get all invoices assigned to the current accountant
router.get('/invoices', requireAccountant, async (req, res) => {
    try {
        const invoices = await Invoice.find({ accountantId: req.user.staffProfile._id });
        return sendResponse(res, true, invoices);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch assigned invoices', code: 'FETCH_ERROR' });
    }
});

// Get a specific invoice
router.get('/invoices/:invoiceId', requireAccountant, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return sendResponse(res, false, null, { status: 404, message: 'Invoice not found.', code: 'NOT_FOUND' });
        }
        return sendResponse(res, true, invoice);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch invoice', code: 'FETCH_ERROR' });
    }
});

// Update an invoice
router.put('/invoices/:invoiceId', requireAccountant, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const invoice = await Invoice.findById(invoiceId);

        if (!invoice || invoice.accountantId.toString() !== req.user.staffProfile._id.toString()) {
            return sendResponse(res, false, null, { status: 404, message: 'Invoice not found or not assigned to you.', code: 'NOT_FOUND' });
        }
        if (invoice.status === INVOICE_STATUS.APPROVED || invoice.status === INVOICE_STATUS.CANCELLED) {
            return sendResponse(res, false, null, { status: 400, message: `Cannot update an invoice with status '${invoice.status}'.`, code: 'INVALID_STATUS' });
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

// Update invoice status
router.patch('/invoices/:invoiceId/status', requireAccountant, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { status, reason } = req.body;
        const invoice = await Invoice.findById(invoiceId);

        if (!invoice || invoice.accountantId.toString() !== req.user.staffProfile._id.toString()) {
            return sendResponse(res, false, null, { status: 404, message: 'Invoice not found or not assigned to you.', code: 'NOT_FOUND' });
        }

        await invoice.updateStatus(status, req.user, reason);
        return sendResponse(res, true, invoice);
    } catch (error) {
        return sendResponse(res, false, null, { status: 400, message: error.message, code: 'STATUS_UPDATE_ERROR' });
    }
});

// Reject a payment (set invoice status to REJECTED with reason)
router.patch('/invoices/:invoiceId/reject', requireAccountant, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { reason } = req.body;

        if (!reason || reason.trim().length === 0) {
            return sendResponse(res, false, null, { status: 400, message: 'Rejection reason is required.', code: 'REASON_REQUIRED' });
        }

        const invoice = await Invoice.findById(invoiceId);

        if (!invoice || invoice.accountantId.toString() !== req.user.staffProfile._id.toString()) {
            return sendResponse(res, false, null, { status: 404, message: 'Invoice not found or not assigned to you.', code: 'NOT_FOUND' });
        }

        // Can only reject if in editable statuses
        const editableStatuses = [INVOICE_STATUS.PENDING, INVOICE_STATUS.STUDENT_CONTACTED, INVOICE_STATUS.PAYMENT_RECEIVED, INVOICE_STATUS.REJECTED];
        if (!editableStatuses.includes(invoice.status)) {
            return sendResponse(res, false, null, { status: 400, message: `Cannot reject an invoice with status '${invoice.status}'.`, code: 'INVALID_STATUS' });
        }

        await invoice.updateStatus(INVOICE_STATUS.REJECTED, req.user, reason.trim());
        return sendResponse(res, true, invoice);
    } catch (error) {
        return sendResponse(res, false, null, { status: 400, message: error.message, code: 'REJECTION_ERROR' });
    }
});

// Reject a process (set process status to REJECTED with reason)
router.patch('/processes/:processId/reject', requireAccountant, async (req, res) => {
    try {
        const { processId } = req.params;
        const { notes } = req.body;

        if (!notes || notes.trim().length === 0) {
            return sendResponse(res, false, null, { status: 400, message: 'Rejection reason/notes are required.', code: 'REASON_REQUIRED' });
        }

        const process = await Process.findById(processId);

        if (!process) {
            return sendResponse(res, false, null, { status: 404, message: 'Process not found.', code: 'NOT_FOUND' });
        }

        // Can reject processes in certain states (non-terminal)
        const terminalStates = [PROCESS_STATUS.DONE, PROCESS_STATUS.CANCELLED, PROCESS_STATUS.REFUND_COMPLETED, PROCESS_STATUS.REFUND_REJECTED, PROCESS_STATUS.DECLINED];
        if (terminalStates.includes(process.status)) {
            return sendResponse(res, false, null, { status: 400, message: `Cannot reject a process with status '${process.status}'.`, code: 'INVALID_STATUS' });
        }

        // Create a pseudo-user for the update
        const fakeUser = { _id: req.user._id, role: 'ACCOUNTANT' };
        await process.updateStatus(PROCESS_STATUS.REJECTED, fakeUser, notes.trim());
        return sendResponse(res, true, process);
    } catch (error) {
        return sendResponse(res, false, null, { status: 400, message: error.message, code: 'REJECTION_ERROR' });
    }
});

export default router;
