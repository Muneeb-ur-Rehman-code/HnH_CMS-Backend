// routes/Accountant/Accountant.mjs
import express from 'express';
import { STAFF_ROLE } from '../../models/Users/StaffProfile.mjs';
import Invoice, { INVOICE_STATUS, PAYMENT_METHOD } from '../../models/Invoice/Invoice.mjs';
import Process from '../../models/Process/Process.mjs';
import { PROCESS_STATUS } from '../../config/enums.mjs';

const router = express.Router();

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
router.get('/invoices/unassigned', async (req, res) => {
    try {
        const invoices = await Invoice.find({ accountantId: null, status: INVOICE_STATUS.PENDING });
        return sendResponse(res, true, invoices);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch unassigned invoices', code: 'FETCH_ERROR' });
    }
});

// Assign an invoice to the current accountant
router.patch('/invoices/:invoiceId/assign', async (req, res) => {
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
router.get('/invoices', async (req, res) => {
    try {
        const invoices = await Invoice.find({ accountantId: req.user.staffProfile._id });
        return sendResponse(res, true, invoices);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch assigned invoices', code: 'FETCH_ERROR' });
    }
});

// Get a specific invoice
router.get('/invoices/:invoiceId', async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const invoice = await Invoice.findById(invoiceId);
        // Ensure invoice exists and is assigned to the requesting accountant
        if (!invoice || !invoice.accountantId || invoice.accountantId.toString() !== req.user.staffProfile._id.toString()) {
            return sendResponse(res, false, null, { status: 404, message: 'Invoice not found or not assigned to you.', code: 'NOT_FOUND' });
        }
        return sendResponse(res, true, invoice);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to fetch invoice', code: 'FETCH_ERROR' });
    }
});

// Update an invoice
router.put('/invoices/:invoiceId', async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const invoice = await Invoice.findById(invoiceId);

        if (!invoice || invoice.accountantId.toString() !== req.user.staffProfile._id.toString()) {
            return sendResponse(res, false, null, { status: 404, message: 'Invoice not found or not assigned to you.', code: 'NOT_FOUND' });
        }
        if (invoice.status === INVOICE_STATUS.APPROVED || invoice.status === INVOICE_STATUS.CANCELLED) {
            return sendResponse(res, false, null, { status: 400, message: `Cannot update an invoice with status '${invoice.status}'.`, code: 'INVALID_STATUS' });
        }

        // Only allow accountant-editable fields
        const { paymentType, amount, currency, breakdown } = req.body;
        if (paymentType !== undefined) invoice.paymentType = paymentType;
        if (amount !== undefined) invoice.amount = amount;
        if (currency !== undefined) invoice.currency = currency;
        if (breakdown !== undefined) invoice.breakdown = breakdown;

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
router.patch('/invoices/:invoiceId/status', async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { status, reason } = req.body;
        const invoice = await Invoice.findById(invoiceId);

        if (!invoice || invoice.accountantId.toString() !== req.user.staffProfile._id.toString()) {
            return sendResponse(res, false, null, { status: 404, message: 'Invoice not found or not assigned to you.', code: 'NOT_FOUND' });
        }

        // Terminal statuses cannot be changed
        const terminalStatuses = [INVOICE_STATUS.CANCELLED, INVOICE_STATUS.WITHDRAWN];
        if (terminalStatuses.includes(invoice.status)) {
            return sendResponse(res, false, null, { status: 400, message: `Cannot change status from terminal status '${invoice.status}'.`, code: 'INVALID_STATUS' });
        }

        // Allowed transitions
        const allowedTransitions = {
            [INVOICE_STATUS.PENDING]: [INVOICE_STATUS.STUDENT_CONTACTED, INVOICE_STATUS.PAYMENT_RECEIVED, INVOICE_STATUS.APPROVED, INVOICE_STATUS.REJECTED],
            [INVOICE_STATUS.STUDENT_CONTACTED]: [INVOICE_STATUS.PAYMENT_RECEIVED, INVOICE_STATUS.APPROVED, INVOICE_STATUS.REJECTED],
            [INVOICE_STATUS.PAYMENT_RECEIVED]: [INVOICE_STATUS.APPROVED, INVOICE_STATUS.REJECTED, INVOICE_STATUS.STUDENT_CONTACTED],
            [INVOICE_STATUS.APPROVED]: [INVOICE_STATUS.STUDENT_CONTACTED],
            [INVOICE_STATUS.REJECTED]: [INVOICE_STATUS.STUDENT_CONTACTED]
        };

        const possible = allowedTransitions[invoice.status] || [];
        if (!possible.includes(status)) {
            return sendResponse(res, false, null, { status: 400, message: `Invalid status transition from '${invoice.status}' to '${status}'.`, code: 'INVALID_TRANSITION' });
        }

        await invoice.updateStatus(status, req.user, reason);
        return sendResponse(res, true, invoice);
    } catch (error) {
        return sendResponse(res, false, null, { status: 400, message: error.message, code: 'STATUS_UPDATE_ERROR' });
    }
});

// NOTE: Dedicated invoice reject route removed. Use status update with allowed transitions instead.

// Unassign an invoice (only if status is PENDING and assigned to requesting accountant)
router.patch('/invoices/:invoiceId/unassign', async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const invoice = await Invoice.findById(invoiceId);

        if (!invoice || !invoice.accountantId || invoice.accountantId.toString() !== req.user.staffProfile._id.toString()) {
            return sendResponse(res, false, null, { status: 404, message: 'Invoice not found or not assigned to you.', code: 'NOT_FOUND' });
        }

        if (invoice.status !== INVOICE_STATUS.PENDING) {
            return sendResponse(res, false, null, { status: 400, message: 'Can only unassign invoices that are in PENDING status.', code: 'INVALID_STATUS' });
        }

        invoice.accountantId = null;
        await invoice.save();
        return sendResponse(res, true, invoice);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to unassign invoice', code: 'UNASSIGN_ERROR' });
    }
});

// Update payment tracking record status (PENDING → APPROVED or REJECTED)
router.patch('/invoices/:invoiceId/payment-tracking/:trackingId/status', async (req, res) => {
    try {
        const { invoiceId, trackingId } = req.params;
        const { status, reviewReason } = req.body;
        const invoice = await Invoice.findById(invoiceId);

        if (!invoice || invoice.accountantId?.toString() !== req.user.staffProfile._id.toString()) {
            return sendResponse(res, false, null, { status: 404, message: 'Invoice not found or not assigned to you', code: 'NOT_FOUND' });
        }

        // Find the payment tracking record
        const tracking = invoice.paymentTracking?.id(trackingId);
        if (!tracking) {
            return sendResponse(res, false, null, { status: 404, message: 'Payment tracking record not found', code: 'NOT_FOUND' });
        }

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return sendResponse(res, false, null, { status: 400, message: 'Status must be APPROVED or REJECTED', code: 'INVALID_STATUS' });
        }

        if (status === 'REJECTED' && !reviewReason) {
            return sendResponse(res, false, null, { status: 400, message: 'Review reason is required for rejection', code: 'REASON_REQUIRED' });
        }

        tracking.status = status;
        tracking.reviewedBy = req.user.staffProfile._id;
        tracking.reviewedAt = new Date();
        if (reviewReason) {
            tracking.reviewReason = reviewReason;
        }

        await invoice.save();
        return sendResponse(res, true, invoice);
    } catch (error) {
        return sendResponse(res, false, null, { status: 500, message: 'Failed to update payment tracking', code: 'UPDATE_ERROR' });
    }
});

// Reject a process (set process status to REJECTED with reason)
router.patch('/processes/:processId/reject', async (req, res) => {
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

        // For process rejection: ensure all invoices on this process are in REJECTED state
        const invoices = await Invoice.find({ processId: process._id });
        if (!invoices || invoices.length === 0) {
            return sendResponse(res, false, null, { status: 400, message: 'No invoices found for this process.', code: 'NO_INVOICES' });
        }

        const nonRejected = invoices.find(inv => inv.status !== INVOICE_STATUS.REJECTED);
        if (nonRejected) {
            return sendResponse(res, false, null, { status: 400, message: 'Cannot reject process until all invoices are rejected.', code: 'INVOICES_NOT_ALL_REJECTED' });
        }

        // Create a pseudo-user for the update
        const fakeUser = { _id: req.user._id, role: 'ACCOUNTANT' };
        // Set process to CANCELLED when all invoices are rejected
        await process.updateStatus(PROCESS_STATUS.CANCELLED, fakeUser, notes.trim());
        return sendResponse(res, true, process);
    } catch (error) {
        return sendResponse(res, false, null, { status: 400, message: error.message, code: 'REJECTION_ERROR' });
    }
});

export default router;
