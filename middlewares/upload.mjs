// middlewares/upload.mjs
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// CONFIGURATION
// ============================================

const UPLOAD_DIR = path.join(__dirname, '../uploads');
const DELETED_DIR = path.join(__dirname, '../uploads/deleted');

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
    image: 5 * 1024 * 1024,      // 5MB for images
    document: 10 * 1024 * 1024,  // 10MB for documents
    default: 10 * 1024 * 1024    // 10MB default
};

// Allowed file types
const ALLOWED_MIME_TYPES = {
    image: ['image/jpeg', 'image/jpg', 'image/png'],
    document: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
};

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'];

// ============================================
// ENSURE DIRECTORIES EXIST
// ============================================

async function ensureDirectoriesExist() {
    try {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        await fs.mkdir(DELETED_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating upload directories:', error);
    }
}

// Create directories on module load
await ensureDirectoriesExist();

// ============================================
// STORAGE CONFIGURATION
// ============================================

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        await ensureDirectoriesExist();
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Format: originalname_timestamp_userid.ext
        const timestamp = Date.now();
        const userId = req.user ? req.user._id : 'anonymous';
        const ext = path.extname(file.originalname).toLowerCase();
        const nameWithoutExt = path.basename(file.originalname, ext);
        const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');

        const filename = `${sanitizedName}_${timestamp}_${userId}${ext}`;
        cb(null, filename);
    }
});

// ============================================
// FILE FILTER
// ============================================

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    // Check extension
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
    }

    // Check mime type
    const allAllowedMimeTypes = [
        ...ALLOWED_MIME_TYPES.image,
        ...ALLOWED_MIME_TYPES.document
    ];

    if (!allAllowedMimeTypes.includes(file.mimetype)) {
        return cb(new Error('Invalid file mime type'), false);
    }

    cb(null, true);
};

// ============================================
// MULTER INSTANCE
// ============================================

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: FILE_SIZE_LIMITS.default
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Delete a file by moving it to deleted folder
 * @param {string} filePath - Path to the file (relative to uploads/)
 * @returns {Promise<Object>} Result object
 */
export async function deleteFile(filePath) {
    try {
        if (!filePath) {
            throw new Error('File path is required');
        }

        // Remove leading slash if present
        const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

        // Remove 'uploads/' prefix if present
        const fileName = cleanPath.replace(/^uploads\//, '');

        const fullPath = path.join(UPLOAD_DIR, fileName);
        const deletedPath = path.join(DELETED_DIR, `deleted_${Date.now()}_${fileName}`);

        // Check if file exists
        try {
            await fs.access(fullPath);
        } catch {
            return {
                success: false,
                message: 'File not found'
            };
        }

        // Move file to deleted folder
        await fs.rename(fullPath, deletedPath);

        return {
            success: true,
            message: 'File deleted successfully',
            deletedPath: `uploads/deleted/${path.basename(deletedPath)}`
        };

    } catch (error) {
        console.error('Delete file error:', error);
        return {
            success: false,
            message: error.message || 'Failed to delete file'
        };
    }
}

/**
 * Replace a file (delete old, keep new)
 * @param {string} oldFilePath - Path to old file
 * @param {string} newFilePath - Path to new file
 * @returns {Promise<Object>} Result object
 */
export async function replaceFile(oldFilePath, newFilePath) {
    try {
        if (!newFilePath) {
            throw new Error('New file path is required');
        }

        // Delete old file if it exists
        if (oldFilePath) {
            await deleteFile(oldFilePath);
        }

        return {
            success: true,
            message: 'File replaced successfully',
            newFilePath
        };

    } catch (error) {
        console.error('Replace file error:', error);
        return {
            success: false,
            message: error.message || 'Failed to replace file'
        };
    }
}

/**
 * Get file info
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object>} File info
 */
export async function getFileInfo(filePath) {
    try {
        if (!filePath) {
            throw new Error('File path is required');
        }

        const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
        const fileName = cleanPath.replace(/^uploads\//, '');
        const fullPath = path.join(UPLOAD_DIR, fileName);

        const stats = await fs.stat(fullPath);
        const ext = path.extname(fileName).toLowerCase();

        return {
            success: true,
            data: {
                path: `uploads/${fileName}`,
                name: path.basename(fileName),
                size: stats.size,
                extension: ext,
                created: stats.birthtime,
                modified: stats.mtime
            }
        };

    } catch (error) {
        return {
            success: false,
            message: error.message || 'Failed to get file info'
        };
    }
}

/**
 * Validate file size based on type
 * @param {number} fileSize - File size in bytes
 * @param {string} fileType - Type of file (image/document)
 * @returns {boolean} Is valid
 */
export function validateFileSize(fileSize, fileType = 'default') {
    const limit = FILE_SIZE_LIMITS[fileType] || FILE_SIZE_LIMITS.default;
    return fileSize <= limit;
}

// ============================================
// MIDDLEWARE EXPORTS
// ============================================

/**
 * Single file upload middleware
 * @param {string} fieldName - Name of the form field
 */
export const uploadSingle = (fieldName = 'file') => {
    return (req, res, next) => {
        const uploadHandler = upload.single(fieldName);

        uploadHandler(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        message: 'File too large. Maximum size is 10MB.'
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            } else if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            }

            // Add file info to request
            if (req.file) {
                req.fileInfo = {
                    path: `uploads/${req.file.filename}`,
                    name: req.file.originalname,
                    size: req.file.size,
                    mimeType: req.file.mimetype,
                    extension: path.extname(req.file.originalname).toLowerCase()
                };
            }

            next();
        });
    };
};

/**
 * Multiple files upload middleware
 * @param {string} fieldName - Name of the form field
 * @param {number} maxCount - Maximum number of files
 */
export const uploadMultiple = (fieldName = 'files', maxCount = 5) => {
    return (req, res, next) => {
        const uploadHandler = upload.array(fieldName, maxCount);

        uploadHandler(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        message: 'File too large. Maximum size is 10MB per file.'
                    });
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({
                        success: false,
                        message: `Too many files. Maximum is ${maxCount} files.`
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            } else if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            }

            // Add files info to request
            if (req.files && req.files.length > 0) {
                req.filesInfo = req.files.map(file => ({
                    path: `uploads/${file.filename}`,
                    name: file.originalname,
                    size: file.size,
                    mimeType: file.mimetype,
                    extension: path.extname(file.originalname).toLowerCase()
                }));
            }

            next();
        });
    };
};

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
    uploadSingle,
    uploadMultiple,
    deleteFile,
    replaceFile,
    getFileInfo,
    validateFileSize
};