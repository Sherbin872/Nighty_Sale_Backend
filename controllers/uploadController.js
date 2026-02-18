const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to generate optimized URLs
const generateOptimizedImage = (publicId) => {
  const generateUrl = (options) => {
    return cloudinary.url(publicId, {
      secure: true,
      format: 'webp',
      ...options
    });
  };

  return {
    public_id: publicId,
    original: generateUrl({}),
    thumbnail: generateUrl({ width: 350, crop: 'scale' }),
    medium: generateUrl({ width: 800, crop: 'scale' }),
    large: generateUrl({ width: 1200, crop: 'scale' }),
    placeholder: generateUrl({ 
      width: 20, 
      crop: 'scale', 
      effect: 'blur:1000',
      quality: 1 
    })
  };
};

// @desc    Upload single image & Generate optimized variants
// @route   POST /api/upload
// @access  Private/Admin
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'nighty-store',
      format: 'webp',
      quality: 'auto:good',
    });

    // Delete local file
    fs.unlinkSync(req.file.path);

    // Generate optimized URLs
    const imagePayload = generateOptimizedImage(result.public_id);

    res.json(imagePayload);

  } catch (error) {
    console.error('Single image upload error:', error);
    // Cleanup if upload fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ 
      message: 'Image upload failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Upload multiple images & Generate optimized variants
// @route   POST /api/upload/multiple
// @access  Private/Admin
const uploadImages = async (req, res) => {
  console.log('================ UPLOAD MULTIPLE IMAGES =================');

  try {
    /* ----------------------------------------------------
       1. RAW REQUEST INSPECTION
    ---------------------------------------------------- */
    console.log('REQ HEADERS content-type:', req.headers['content-type']);
    console.log('REQ BODY keys:', Object.keys(req.body || {}));
    console.log('REQ FILES exists:', !!req.files);

    if (!req.files) {
      console.error('❌ req.files is UNDEFINED');
      return res.status(400).json({
        message: 'Multer did not attach files to request',
      });
    }

    console.log('REQ FILES COUNT:', req.files.length);

    if (req.files.length === 0) {
      console.error('❌ req.files is EMPTY ARRAY');
      return res.status(400).json({ message: 'No files uploaded' });
    }

    console.log(
      'REQ FILES META:',
      req.files.map(f => ({
        field: f.fieldname,
        name: f.originalname,
        size: f.size,
        mimetype: f.mimetype,
        path: f.path,
      }))
    );

    /* ----------------------------------------------------
       2. FILESYSTEM VALIDATION
    ---------------------------------------------------- */
    req.files.forEach((file, index) => {
      const exists = fs.existsSync(file.path);
      console.log(
        `FILE[${index}] FS CHECK:`,
        exists ? '✅ exists' : '❌ missing',
        file.path
      );
    });

    const uploadedImages = [];
    const errors = [];

    /* ----------------------------------------------------
       3. CLOUDINARY UPLOAD LOOP
    ---------------------------------------------------- */
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];

      try {
        console.log(`⬆️  [${i + 1}/${req.files.length}] Uploading to Cloudinary`);
        console.log('→ path:', file.path);

        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'nighty-store/products',
          format: 'webp',
          quality: 'auto:good',
          transformation: [{ width: 1200, crop: 'limit' }],
        });

        console.log('✅ Cloudinary response:', {
          public_id: result.public_id,
          bytes: result.bytes,
          format: result.format,
        });

        const imageData = generateOptimizedImage(result.public_id);
        uploadedImages.push(imageData);

        fs.unlinkSync(file.path);
        console.log('🗑️ Local file deleted:', file.path);

      } catch (fileError) {
        console.error('❌ Cloudinary upload failed:', {
          file: file.originalname,
          message: fileError.message,
          stack: fileError.stack,
        });

        errors.push({
          filename: file.originalname,
          error: fileError.message,
        });

        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
          console.log('🗑️ Local file deleted after failure:', file.path);
        }
      }
    }

    /* ----------------------------------------------------
       4. FINAL RESPONSE
    ---------------------------------------------------- */
    if (uploadedImages.length === 0) {
      console.error('❌ ALL uploads failed');
      return res.status(500).json({
        message: 'All image uploads failed',
        errors,
      });
    }

    console.log('✅ UPLOAD COMPLETE');
    console.log('SUCCESS COUNT:', uploadedImages.length);
    console.log('FAILED COUNT:', errors.length);

    return res.json({
      success: true,
      images: uploadedImages,
      failed: errors.length ? errors : undefined,
    });

  } catch (error) {
    console.error('🔥 FATAL UPLOAD ERROR:', {
      message: error.message,
      stack: error.stack,
    });

    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
          console.log('🗑️ Cleanup file:', file.path);
        }
      });
    }

    return res.status(500).json({
      message: 'Image upload failed',
      error: error.message,
    });
  }
};


// @desc    Delete image from Cloudinary
// @route   DELETE /api/upload/:publicId
// @access  Private/Admin
const deleteImage = async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({ message: 'Public ID is required' });
    }

    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === 'ok') {
      res.json({ 
        success: true, 
        message: 'Image deleted successfully',
        result 
      });
    } else {
      res.status(404).json({ 
        success: false, 
        message: 'Image not found or already deleted',
        result 
      });
    }

  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ 
      message: 'Failed to delete image',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update image (replace with new one)
// @route   PUT /api/upload/:publicId
// @access  Private/Admin
const updateImage = async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // First delete the old image
    await cloudinary.uploader.destroy(publicId);

    // Upload new image
    const result = await cloudinary.uploader.upload(req.file.path, {
      public_id: publicId, // Use same public_id to replace
      folder: 'nighty-store',
      format: 'webp',
      quality: 'auto:good',
    });

    // Delete local file
    fs.unlinkSync(req.file.path);

    // Generate optimized URLs
    const imagePayload = generateOptimizedImage(result.public_id);

    res.json({
      success: true,
      message: 'Image updated successfully',
      ...imagePayload
    });

  } catch (error) {
    console.error('Update image error:', error);
    // Cleanup if upload fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ 
      message: 'Failed to update image',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = { 
  uploadImage, 
  uploadImages,
  deleteImage,
  updateImage 
};