// routes/accountant/accountant.mjs
import express from 'express';
import Invoice from '../../models/Inoice/Invoice.mjs';
import Application from '../../models/Process/Process.mjs';
import User from '../../models/Users/_UsersMain.mjs';
import { attachUser, requireRole, requireVerifiedStaff } from '../../middlewares/Auth.mjs';
import { USER_ROLE } from '../../models/Users/_UsersMain.mjs';
import { INVOICE_STATUS, PAYMENT_METHOD } from '../../models/Inoice/Invoice.mjs';
import { uploadSingle, deleteFile, replaceFile } from '../../middlewares/upload.mjs';

const router = express.Router();

// All routes require accountant role and verified staff
const requireAccountant = [
    attachUser,
    requireRole(USER_ROLE.ACCOUNTANT, USER_ROLE.MANAGER, USER_ROLE.ADMIN),
    requireVerifiedStaff
];

// ============================================
// GET INVOICES
// ============================================

/**
 * GET /api/accountant/invoices
 * Get all invoices assigned to the accountant
 */
router.get('/invoices', requireAccountant, async (req, res) => {
    try {
        const { status, paymentType } = req.query;
        const accountantId = req.user._id;

        // Build query
        const query = { accountantId };
        if (status) query.status = status;
        if (paymentType) query.paymentType = paymentType;

        const invoices = await Invoice.find(query)
            .populate('applicationId', 'targetCountry targetUniversity studentId')
            .populate({
                path: 'applicationId',
                populate: {
                    path: 'studentId',
                    select: 'email firstName lastName phoneNumber'
                }
            })
            .sort({ issuedAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: invoices.length,
                invoices
            }
        });

    } catch (error) {
        console.error('Get invoices error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch invoices',
            error: error.message
        });
    }
});

/**
 * GET /api/accountant/invoices/pending
 * Get pending invoices assigned to accountant
 */
router.get('/invoices/pending', requireAccountant, async (req, res) => {
    try {
        const accountantId = req.user._id;

        const invoices = await Invoice.find({
            accountantId,
            status: { $in: [INVOICE_STATUS.PENDING, INVOICE_STATUS.STUDENT_CONTACTED] }
        })
            .populate('applicationId', 'targetCountry targetUniversity studentId')
            .populate({
                path: 'applicationId',
                populate: {
                    path: 'studentId',
                    select: 'email firstName lastName phoneNumber'
                }
            })
            .sort({ issuedAt: 1 });

        return res.status(200).json({
            success: true,
            data: {
                count: invoices.length,
                invoices
            }
        });

    } catch (error) {
        console.error('Get pending invoices error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch pending invoices',
            error: error.message
        });
    }
});

/**
 * GET /api/accountant/invoices/:invoiceId
 * Get specific invoice details
 */
router.get('/invoices/:invoiceId', requireAccountant, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const accountantId = req.user._id;

        const invoice = await Invoice.findOne({
            _id: invoiceId,
            accountantId
        })
            .populate('applicationId')
            .populate({
                path: 'applicationId',
                populate: {
                    path: 'studentId',
                    select: 'email firstName lastName phoneNumber dateOfBirth gender'
                }
            })
            .populate('studentContactedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email')
            .populate('cancelledBy', 'firstName lastName email');

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found or not assigned to you'
            });
        }

        return res.status(200).json({
            success: true,
            data: { invoice }
        });

    } catch (error) {
        console.error('Get invoice error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch invoice',
            error: error.message
        });
    }
});

// ============================================
// UPDATE INVOICE STATUS
// ============================================

/**
 * POST /api/accountant/invoices/:invoiceId/contact-student
 * Mark student as contacted
 */
router.post('/invoices/:invoiceId/contact-student', requireAccountant, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { notes } = req.body;
        const accountantId = req.user._id;

        const invoice = await Invoice.findOne({
            _id: invoiceId,
            accountantId
        });

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found or not assigned to you'
            });
        }

        await invoice.markStudentContacted(accountantId, notes);

        return res.status(200).json({
            success: true,
            message: 'Student marked as contacted',
            data: { invoice }
        });

    } catch (error) {
        console.error('Contact student error:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to mark student as contacted'
        });
    }
});

/**
 * POST /api/accountant/invoices/:invoiceId/record-payment
 * Record payment information
 */
router.post('/invoices/:invoiceId/record-payment', requireAccountant, uploadSingle('receipt'), async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { paymentMethod, transactionId, notes } = req.body;
        const accountantId = req.user._id;

        const invoice = await Invoice.findOne({
            _id: invoiceId,
            accountantId
        });

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found or not assigned to you'
            });
        }

        // Prepare payment info
        const paymentInfo = {
            paymentMethod,
            transactionId: transactionId || null,
            notes: notes || null
        };

        // Add file info if uploaded
        if (req.fileInfo) {
            paymentInfo.filePath = req.fileInfo.path;
            paymentInfo.fileName = req.fileInfo.name;
        }

        await invoice.recordPayment(accountantId, paymentInfo);

        return res.status(200).json({
            success: true,
            message: 'Payment recorded successfully',
            data: { invoice }
        });

    } catch (error) {
        console.error('Record payment error:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to record payment'
        });
    }
});

/**
 * POST /api/accountant/invoices/:invoiceId/approve
 * Approve invoice
 */
router.post('/invoices/:invoiceId/approve', requireAccountant, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const accountantId = req.user._id;

        const invoice = await Invoice.findOne({
            _id: invoiceId,
            accountantId
        });

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found or not assigned to you'
            });
        }

        await invoice.approve(accountantId);

        return res.status(200).json({
            success: true,
            message: 'Invoice approved successfully',
            data: { invoice }
        });

    } catch (error) {
        console.error('Approve invoice error:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to approve invoice'
        });
    }
});

/**
 * POST /api/accountant/invoices/:invoiceId/cancel
 * Cancel invoice
 */
router.post('/invoices/:invoiceId/cancel', requireAccountant, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { reason } = req.body;
        const accountantId = req.user._id;

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Cancellation reason is required'
            });
        }

        const invoice = await Invoice.findOne({
            _id: invoiceId,
            accountantId
        });

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found or not assigned to you'
            });
        }

        await invoice.cancel(accountantId, reason);

        return res.status(200).json({
            success: true,
            message: 'Invoice cancelled successfully',
            data: { invoice }
        });

    } catch (error) {
        console.error('Cancel invoice error:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to cancel invoice'
        });
    }
});

// ============================================
// FILE MANAGEMENT
// ============================================

/**
 * POST /api/accountant/invoices/:invoiceId/upload-receipt
 * Upload payment receipt/screenshot
 */
router.post('/invoices/:invoiceId/upload-receipt', requireAccountant, uploadSingle('receipt'), async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const accountantId = req.user._id;

        if (!req.fileInfo) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const invoice = await Invoice.findOne({
            _id: invoiceId,
            accountantId
        });

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found or not assigned to you'
            });
        }

        // Replace old file if exists
        if (invoice.paymentTracking?.filePath) {
            await replaceFile(invoice.paymentTracking.filePath, req.fileInfo.path);
        }

        // Update invoice with new file
        if (!invoice.paymentTracking) {
            invoice.paymentTracking = {};
        }
        invoice.paymentTracking.filePath = req.fileInfo.path;
        invoice.paymentTracking.fileName = req.fileInfo.name;
        await invoice.save();

        return res.status(200).json({
            success: true,
            message: 'Receipt uploaded successfully',
            data: {
                file: req.fileInfo,
                invoice
            }
        });

    } catch (error) {
        console.error('Upload receipt error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to upload receipt',
            error: error.message
        });
    }
});

/**
 * DELETE /api/accountant/invoices/:invoiceId/delete-receipt
 * Delete payment receipt
 */
router.delete('/invoices/:invoiceId/delete-receipt', requireAccountant, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const accountantId = req.user._id;

        const invoice = await Invoice.findOne({
            _id: invoiceId,
            accountantId
        });

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found or not assigned to you'
            });
        }

        if (!invoice.paymentTracking?.filePath) {
            return res.status(400).json({
                success: false,
                message: 'No receipt file to delete'
            });
        }

        // Delete file
        const deleteResult = await deleteFile(invoice.paymentTracking.filePath);

        // Update invoice
        invoice.paymentTracking.filePath = null;
        invoice.paymentTracking.fileName = null;
        await invoice.save();

        return res.status(200).json({
            success: true,
            message: 'Receipt deleted successfully',
            data: {
                deleteResult,
                invoice
            }
        });

    } catch (error) {
        console.error('Delete receipt error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete receipt',
            error: error.message
        });
    }
});

// ============================================
// STATISTICS
// ============================================

/**
 * GET /api/accountant/stats
 * Get accountant's invoice statistics
 */
router.get('/stats', requireAccountant, async (req, res) => {
    try {
        const accountantId = req.user._id;

        const stats = await Invoice.aggregate([
            { $match: { accountantId, deletedAt: null } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);

        const summary = {
            total: 0,
            pending: 0,
            studentContacted: 0,
            paymentReceived: 0,
            approved: 0,
            cancelled: 0,
            totalRevenue: 0
        };

        stats.forEach(stat => {
            summary.total += stat.count;

            switch (stat._id) {
                case INVOICE_STATUS.PENDING:
                    summary.pending = stat.count;
                    break;
                case INVOICE_STATUS.STUDENT_CONTACTED:
                    summary.studentContacted = stat.count;
                    break;
                case INVOICE_STATUS.PAYMENT_RECEIVED:
                    summary.paymentReceived = stat.count;
                    break;
                case INVOICE_STATUS.APPROVED:
                    summary.approved = stat.count;
                    summary.totalRevenue += stat.totalAmount;
                    break;
                case INVOICE_STATUS.CANCELLED:
                    summary.cancelled = stat.count;
                    break;
            }
        });

        return res.status(200).json({
            success: true,
            data: { summary, details: stats }
        });

    } catch (error) {
        console.error('Get stats error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
});

export default router;