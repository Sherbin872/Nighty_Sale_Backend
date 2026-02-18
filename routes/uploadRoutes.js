const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { 
  uploadImage, 
  uploadImages,
  deleteImage,
  updateImage 
} = require('../controllers/uploadController');
const { protect, admin } = require('../middleware/authMiddleware');

// Configure Multer (Temporary Storage)
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename(req, file, cb) {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

// File Validation
const checkFileType = (file, cb) => {
  const filetypes = /jpg|jpeg|png|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Images only! (jpg, jpeg, png, webp)'));
  }
};

const upload = multer({
  storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10 // Max 10 files
  },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

// Routes
router.post('/', protect, admin, upload.single('image'), uploadImage);
router.post('/multiple', protect, admin, upload.array('images', 10), uploadImages);
router.delete('/:publicId', protect, admin, deleteImage);
router.put('/:publicId', protect, admin, upload.single('image'), updateImage);

module.exports = router;