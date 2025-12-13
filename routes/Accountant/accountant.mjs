// routes/Accountant/Accountant.mjs
import express from 'express';
import { attachUser, requireRole } from '../../middlewares/Auth.mjs';
import { STAFF_ROLE } from '../../models/Users/StaffProfile.mjs';
import Invoice, { INVOICE_STATUS, PAYMENT_METHOD } from '../../models/Invoice/Invoice.mjs';

const router = express.Router();

const requireAccountant = [
    attachUser,
    requireRole(STAFF_ROLE.ACCOUNTANT),
];

// Get all unassigned invoices
router.get('/invoices/unassigned', requireAccountant, async (req, res) => {
    try {
        const invoices = await Invoice.find({ accountantId: null, status: INVOICE_STATUS.PENDING });
        res.status(200).json({ success: true, data: invoices });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch unassigned invoices', error: error.message });
    }
});

// Assign an invoice to the current accountant
router.patch('/invoices/:invoiceId/assign', requireAccountant, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found.' });
        }
        if (invoice.accountantId) {
            return res.status(400).json({ success: false, message: 'Invoice is already assigned.' });
        }
        invoice.accountantId = req.user.staffProfile._id;
        await invoice.save();
        res.status(200).json({ success: true, message: 'Invoice assigned successfully.', data: invoice });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to assign invoice', error: error.message });
    }
});

// Get all invoices assigned to the current accountant
router.get('/invoices', requireAccountant, async (req, res) => {
    try {
        const invoices = await Invoice.find({ accountantId: req.user.staffProfile._id });
        res.status(200).json({ success: true, data: invoices });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch assigned invoices', error: error.message });
    }
});

// Update an invoice
router.put('/invoices/:invoiceId', requireAccountant, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const invoice = await Invoice.findById(invoiceId);

        if (!invoice || invoice.accountantId.toString() !== req.user.staffProfile._id.toString()) {
            return res.status(404).json({ success: false, message: 'Invoice not found or not assigned to you.' });
        }
        if (invoice.status === INVOICE_STATUS.APPROVED || invoice.status === INVOICE_STATUS.CANCELLED) {
            return res.status(400).json({ success: false, message: `Cannot update an invoice with status '${invoice.status}'.` });
        }

        Object.assign(invoice, req.body);
        await invoice.save();
        res.status(200).json({ success: true, message: 'Invoice updated successfully', data: invoice });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to update invoice', error: error.message });
    }
});

// Update invoice status
router.patch('/invoices/:invoiceId/status', requireAccountant, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { status, reason } = req.body;
        const invoice = await Invoice.findById(invoiceId);

        if (!invoice || invoice.accountantId.toString() !== req.user.staffProfile._id.toString()) {
            return res.status(404).json({ success: false, message: 'Invoice not found or not assigned to you.' });
        }

        await invoice.updateStatus(status, req.user, reason);
        res.status(200).json({ success: true, message: `Invoice status updated to ${status}` });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

export default router;
