// routes/student/student.mjs
import express from 'express';
import User from '../../models/Users/_UsersMain.mjs';
import StudentProfile from '../../models/Users/Student.mjs';
import Initial from '../../models/initial/Initial.mjs';
import Application, { PROCESS_STATUS } from '../../models/Process/Process.mjs';
import Invoice from '../../models/Invoice/Invoice.mjs';
import Task from '../../models/Task/Tasks.mjs';
import Document from '../../models/Docx/Document.mjs';
import Country from '../../models/Country/CountryModel.mjs';
import University from '../../models/University/UniModel.mjs';
import StaffProfile from '../../models/Users/StaffProfile.mjs';
import { attachUser, requireRole, requireOnboardingComplete } from '../../middlewares/Auth.mjs';
import { USER_ROLE } from '../../models/Users/_UsersMain.mjs';
import { INITIAL_SOURCE, INITIAL_STATUS, INITIAL_TYPE } from '../../models/initial/Initial.mjs';
import mongoose from 'mongoose';

const router = express.Router();

// All routes require student role and completed onboarding
const requireStudent = [
    attachUser,
    requireRole(USER_ROLE.STUDENT),
    requireOnboardingComplete
];

// /api/student/profile
router.get('/profile', requireStudent, async (req, res) => {
    try {
        const user = req.user;

        // Get student profile if exists
        const studentProfile = await StudentProfile.findOne({ userId: user._id }).select('-deletedAt -createdAt -updatedAt -isPassportExpired -isPassportExpiringSoon -hasCompleteAddress -isDeleted -id');

        return res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phoneNumber: user?.phone?.number || null,
                    dateOfBirth: user?.dob || null,
                    gender: user.gender,
                    nationality: studentProfile?.nationality || null,
                    passportNumber: studentProfile?.passportNumber || null,
                    passportExpiry: studentProfile?.passportExpiry || null,
                    address: studentProfile?.address || null,
                    educationLevel: studentProfile?.educationLevel || null,
                    currentInstitution: studentProfile?.currentInstitution || null,
                    graduationYear: studentProfile?.graduationYear || null,
                    lastGpa: studentProfile?.lastGpa || null,
                    englishProficiency: studentProfile?.englishProficiency || null
                },
            }
        });

    } catch (error) {
        console.error('Get profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch profile',
            error: error.message
        });
    }
});

// /api/student/profile
router.put('/profile', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const {
            // User fields
            firstName,
            lastName,
            dateOfBirth,
            gender,
            // Student profile fields
            nationality,
            passportNumber,
            passportExpiry,
            address,
            educationLevel,
            currentInstitution,
            graduationYear,
            lastGpa,
            englishProficiency
        } = req.body;

        // Update user basic info
        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (dateOfBirth !== undefined) user.dob = dateOfBirth;
        if (gender !== undefined) user.gender = gender;
        await user.save();

        // Update or create student profile
        let studentProfile = await StudentProfile.findOne({ userId: user._id });

        if (!studentProfile) {
            studentProfile = new StudentProfile({ userId: user._id });
        }

        if (nationality !== undefined) studentProfile.nationality = nationality;
        if (passportNumber !== undefined) studentProfile.passportNumber = passportNumber;
        if (passportExpiry !== undefined) studentProfile.passportExpiry = passportExpiry;
        if (address !== undefined) studentProfile.address = address;
        if (educationLevel !== undefined) studentProfile.educationLevel = educationLevel;
        if (currentInstitution !== undefined) studentProfile.currentInstitution = currentInstitution;
        if (graduationYear !== undefined) studentProfile.graduationYear = graduationYear;
        if (lastGpa !== undefined) studentProfile.lastGpa = lastGpa;
        if (englishProficiency !== undefined) studentProfile.englishProficiency = englishProficiency;

        await studentProfile.save();

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phoneNumber: user?.phone?.number || null,
                    dateOfBirth: user?.dob || null,
                    gender: user.gender
                },
                profile: studentProfile
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ')
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message
        });
    }
});


// /api/student/initials
router.get('/initials', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const studentProfile = await StudentProfile.findOne({ userId: user._id });

        if (!studentProfile) {
            return res.status(200).json({
                success: true,
                data: { count: 0, initials: [] }
            });
        }

        const initials = await Initial.find({
            studentId: studentProfile._id,
            status: { $ne: INITIAL_STATUS.REFUSED }
        })
            .select('status type preferredCountry otherCountry preferredUniversity otherUniversity notes reviewedAt rejectionReason markedAt createdAt')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: initials.length,
                initials: initials.map(initial => ({
                    id: initial._id,
                    status: initial.status,
                    type: initial.type,
                    preferredCountry: initial.preferredCountry,
                    otherCountry: initial.otherCountry,
                    preferredUniversity: initial.preferredUniversity,
                    otherUniversity: initial.otherUniversity,
                    notes: initial.notes,
                    reviewedAt: initial.reviewedAt,
                    rejectionReason: initial.rejectionReason,
                    markedAt: initial.markedAt,
                    createdAt: initial.createdAt
                }))
            }
        });

    } catch (error) {
        console.error('Get initials error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch initials',
            error: error.message
        });
    }
});


// /api/student/initials
router.post('/initials', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const {
            type = INITIAL_TYPE.STUDY,
            notes,
            preferredCountry,
            otherCountry,
            preferredUniversity,
            otherUniversity
        } = req.body;

        // Validation: Check user's onboarding status
        const isEmailVerified = await user.isEmailVerifiedAsync();
        const hasPassword = await user.hasPasswordAsync();
        const isPhoneVerified = await user.isPhoneVerifiedAsync();

        if (!isEmailVerified || !hasPassword || !isPhoneVerified) {
            return res.status(400).json({
                success: false,
                message: 'Please complete your profile verification (email, password, phone) before creating an initial application.'
            });
        }

        const studentProfile = await StudentProfile.findOne({ userId: user._id });
        if (!studentProfile) {
            return res.status(400).json({
                success: false,
                message: "Student profile not found. Please complete your profile first."
            });
        }

        // Validation: Check for existing application
        const existingInitial = await Initial.findOne({
            studentId: studentProfile._id,
            status: { $in: [INITIAL_STATUS.PENDING, INITIAL_STATUS.REJECTED, INITIAL_STATUS.APPROVED] }
        });

        if (existingInitial) {
            return res.status(400).json({
                success: false,
                message: `You already have an application with '${existingInitial.status}' status. Please delete it first before creating a new one.`
            });
        }

        // Prepare initial data
        const initialData = {
            studentId: studentProfile._id,
            type,
            notes,
            preferredCountry,
            otherCountry,
            preferredUniversity,
            otherUniversity,
            source: INITIAL_SOURCE.ONLINE,
            status: INITIAL_STATUS.PENDING // Default to pending
        };

        // Auto-approve logic
        let newStatus = INITIAL_STATUS.PENDING;
        let consultantId = null;

        if (type === INITIAL_TYPE.VISIT) {
            if (preferredCountry && preferredCountry !== 'OTHER') {
                const country = await Country.findById(preferredCountry);
                if (country && country.consultantId) {
                    const consultant = await StaffProfile.findById(country.consultantId);
                    if (consultant && consultant.isVerified) {
                        newStatus = INITIAL_STATUS.APPROVED;
                        consultantId = consultant._id;
                    }
                }
            }
        } else if (type === INITIAL_TYPE.STUDY) {
            if (preferredCountry && preferredCountry !== 'OTHER') {
                newStatus = INITIAL_STATUS.APPROVED;
                // Find a consultant for the country
                const country = await Country.findById(preferredCountry);
                if (country && country.consultantId) {
                    const consultant = await StaffProfile.findById(country.consultantId);
                    if (consultant && consultant.isVerified) {
                        consultantId = consultant._id;
                    } else {
                        newStatus = INITIAL_STATUS.PENDING; // Downgrade if consultant not verified
                    }
                } else {
                    newStatus = INITIAL_STATUS.PENDING; // No consultant for country
                }
            }
        }

        initialData.status = newStatus;
        initialData.assignedConsultantId = consultantId;

        const newInitial = new Initial(initialData);
        await newInitial.save();

        return res.status(201).json({
            success: true,
            message: 'Initial application created successfully',
            data: { initial: newInitial }
        });

    } catch (error) {
        console.error('Create initial error:', error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ')
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to create initial application',
            error: error.message
        });
    }
});

// DELETE /api/student/initials/:initialId
router.delete('/initials/:initialId', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const { initialId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(initialId)) {
            return res.status(400).json({ success: false, message: 'Invalid Initial ID' });
        }

        const studentProfile = await StudentProfile.findOne({ userId: user._id });
        if (!studentProfile) {
            // If no student profile, they can't have any initials to delete.
            return res.status(404).json({
                success: false,
                message: 'Initial application not found'
            });
        }

        const initial = await Initial.findOne({
            _id: initialId,
            studentId: studentProfile._id
        });

        if (!initial) {
            return res.status(404).json({
                success: false,
                message: 'Initial application not found'
            });
        }

        // Check if deletable
        const deletableStatuses = [INITIAL_STATUS.PENDING, INITIAL_STATUS.APPROVED, INITIAL_STATUS.REJECTED];
        if (!deletableStatuses.includes(initial.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete an application with status '${initial.status}'. Only applications in PENDING, APPROVED, or REJECTED state can be deleted.`
            });
        }

        initial.status = INITIAL_STATUS.REFUSED;
        await initial.save();

        return res.status(200).json({
            success: true,
            message: 'Initial application has been successfully refused.'
        });

    } catch (error) {
        console.error('Delete initial error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete initial application',
            error: error.message
        });
    }
});

// /api/student/applications
router.get('/applications', requireStudent, async (req, res) => {
    try {
        const user = req.user;

        const applications = await Application.find({
            studentId: user._id,
            deletedAt: null
        })
            .populate('consultantId', 'email firstName lastName phoneNumber')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: applications.length,
                applications: applications.map(app => ({
                    id: app._id,
                    targetCountry: app.targetCountry,
                    targetUniversity: app.targetUniversity,
                    targetCourse: app.targetCourse,
                    intakePreference: app.intakePreference,
                    status: app.status,
                    consultant: app.consultantId ? {
                        name: `${app.consultantId.firstName} ${app.consultantId.lastName}`,
                        email: app.consultantId.email,
                        phone: app.consultantId.phoneNumber
                    } : null,
                    createdAt: app.createdAt,
                    updatedAt: app.updatedAt
                }))
            }
        });

    } catch (error) {
        console.error('Get applications error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch applications',
            error: error.message
        });
    }
});

// /api/student/applications/:applicationId
router.get('/applications/:applicationId', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const { applicationId } = req.params;

        const application = await Application.findOne({
            _id: applicationId,
            studentId: user._id,
            deletedAt: null
        })
            .populate('consultantId', 'email firstName lastName phoneNumber')
            .populate('initial');

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // Include related invoices for the application
        const invoices = await Invoice.find({ applicationId: application._id, deletedAt: null }).sort({ issuedAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                application: {
                    id: application._id,
                    targetCountry: application.targetCountry,
                    targetUniversity: application.targetUniversity,
                    targetCourse: application.targetCourse,
                    intakePreference: application.intakePreference,
                    budget: application.budget,
                    status: application.status,
                    statusHistory: application.statusHistory,
                    consultant: application.consultantId ? {
                        name: `${application.consultantId.firstName} ${application.consultantId.lastName}`,
                        email: application.consultantId.email,
                        phone: application.consultantId.phoneNumber
                    } : null,
                    initial: application.initial || null,
                    invoices: invoices.map(inv => ({
                        id: inv._id,
                        invoiceNumber: inv.invoiceNumber,
                        amount: inv.amount,
                        currency: inv.currency,
                        paymentType: inv.paymentType,
                        status: inv.status,
                        breakdown: inv.breakdown,
                        dueDate: inv.dueDate,
                        issuedAt: inv.issuedAt,
                        approvedAt: inv.approvedAt
                    })),
                    createdAt: application.createdAt,
                    updatedAt: application.updatedAt
                }
            }
        });

    } catch (error) {
        console.error('Get application error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch application',
            error: error.message
        });
    }
});

// /api/student/applications/:applicationId/invoices
router.get('/applications/:applicationId/invoices', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const { applicationId } = req.params;

        // Verify application belongs to student
        const application = await Application.findOne({
            _id: applicationId,
            studentId: user._id,
            deletedAt: null
        });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        const invoices = await Invoice.find({
            applicationId,
            deletedAt: null
        }).sort({ issuedAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: invoices.length,
                invoices: invoices.map(inv => ({
                    id: inv._id,
                    invoiceNumber: inv.invoiceNumber,
                    amount: inv.amount,
                    currency: inv.currency,
                    paymentType: inv.paymentType,
                    status: inv.status,
                    breakdown: inv.breakdown,
                    dueDate: inv.dueDate,
                    issuedAt: inv.issuedAt,
                    approvedAt: inv.approvedAt
                }))
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

// /api/student/applications/:applicationId/tasks
router.get('/applications/:applicationId/tasks', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const { applicationId } = req.params;

        // Verify application belongs to student
        const application = await Application.findOne({
            _id: applicationId,
            studentId: user._id,
            deletedAt: null
        });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        const tasks = await Task.find({
            applicationId,
            visibleToStudent: true,
            deletedAt: null
        })
            .populate('createdBy', 'firstName lastName')
            .sort({ dueDate: 1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: tasks.length,
                tasks: tasks.map(task => ({
                    id: task._id,
                    title: task.title,
                    description: task.description,
                    status: task.status,
                    priority: task.priority,
                    dueDate: task.dueDate,
                    completedAt: task.completedAt,
                    createdBy: task.createdBy ? `${task.createdBy.firstName} ${task.createdBy.lastName}` : null,
                    createdAt: task.createdAt
                }))
            }
        });

    } catch (error) {
        console.error('Get tasks error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch tasks',
            error: error.message
        });
    }
});

// /api/student/applications/:applicationId/documents
router.get('/applications/:applicationId/documents', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const { applicationId } = req.params;

        // Verify application belongs to student
        const application = await Application.findOne({
            _id: applicationId,
            studentId: user._id,
            deletedAt: null
        });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        const documents = await Document.find({
            applicationId,
            visibleToStudent: true,
            deletedAt: null
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: documents.length,
                documents: documents.map(doc => ({
                    id: doc._id,
                    documentType: doc.documentType,
                    name: doc.name,
                    description: doc.description,
                    status: doc.status,
                    filePath: doc.filePath,
                    fileName: doc.fileName,
                    rejectionReason: doc.rejectionReason,
                    expiryDate: doc.expiryDate,
                    uploadedAt: doc.uploadedAt,
                    verifiedAt: doc.verifiedAt
                }))
            }
        });

    } catch (error) {
        console.error('Get documents error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch documents',
            error: error.message
        });
    }
});

// POST /api/student/applications/:applicationId/documents/:documentId/upload
router.post('/applications/:applicationId/documents/:documentId/upload', requireStudent, async (req, res) => {
    try {
        const user = req.user;
        const { applicationId, documentId } = req.params;

        // Verify application belongs to student
        const application = await Application.findOne({
            _id: applicationId,
            studentId: user._id,
            deletedAt: null
        });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // Find document
        const document = await Document.findOne({
            _id: documentId,
            applicationId,
            visibleToStudent: true,
            deletedAt: null
        });

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        if (!req.fileInfo) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        await document.upload(user._id, {
            filePath: req.fileInfo.path,
            fileName: req.fileInfo.name,
            fileSize: req.fileInfo.size,
            mimeType: req.fileInfo.mimeType
        });

        return res.status(200).json({
            success: true,
            message: 'Document uploaded successfully',
            data: { document }
        });

    } catch (error) {
        console.error('Upload document error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to upload document',
            error: error.message
        });
    }
});

// Application-specific actions merged from legacy "processes" routes
router.patch('/applications/:applicationId/cancel', requireStudent, async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { reason } = req.body;
        const studentProfile = await StudentProfile.findOne({ userId: req.user._id });
        const application = await Application.findOne({ _id: applicationId, studentId: studentProfile._id });
        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found.' });
        }
        await application.updateStatus(PROCESS_STATUS.CANCELLED, req.user, reason);
        res.status(200).json({ success: true, message: 'Application cancelled successfully.' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Invoice payment endpoint (ownership check uses application reference)
router.post('/invoices/:invoiceId/pay', requireStudent, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const studentProfile = await StudentProfile.findOne({ userId: req.user._id });
        const invoice = await Invoice.findOne({ _id: invoiceId }).populate('applicationId');

        if (!invoice || !invoice.applicationId || invoice.applicationId.studentId.toString() !== studentProfile._id.toString()) {
            return res.status(404).json({ success: false, message: 'Invoice not found.' });
        }

        await invoice.recordPayment(req.user, req.body);
        res.status(200).json({ success: true, message: 'Payment submitted for review.', data: invoice });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});


export default router;