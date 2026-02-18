const Product = require('../models/Product');

// @desc    Fetch all products
// @route   GET /api/products?keyword=satin&pageNumber=1
// @access  Public
const getProducts = async (req, res) => {
  try {
    const pageSize = 10;
    const page = Number(req.query.pageNumber) || 1;

    // Search functionality: checks if 'keyword' is in name or description
    const keyword = req.query.keyword
      ? {
          name: {
            $regex: req.query.keyword,
            $options: 'i', // case insensitive
          },
        }
      : {};

    const count = await Product.countDocuments({ ...keyword });
    
    // Fetch products with search query, limit for pagination, and skip for pages
    const products = await Product.find({ ...keyword })
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .sort({ createdAt: -1 }); // Sort by newest first

    res.json({ 
      products, 
      page, 
      pages: Math.ceil(count / pageSize),
      total: count 
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ 
      message: 'Error fetching products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Fetch single product by ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    // Handle "CastError" (invalid ObjectId format) specifically
    if (error.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Product not found' });
    }
    console.error('Get product by ID error:', error);
    res.status(500).json({ 
      message: 'Error fetching product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Create a product (Admin only)
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
  try {
    const {
      name,
      price,
      description,
      image,
      additionalImages = [],
      brand,
      category,
      countInStock,
      sizes
    } = req.body;

    // Validate required fields
    const requiredFields = ['name', 'price', 'description', 'image', 'brand', 'category', 'sizes'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: `Please provide all required fields: ${missingFields.join(', ')}` 
      });
    }

    // Validate price is positive
    if (parseFloat(price) <= 0) {
      return res.status(400).json({ 
        message: 'Price must be greater than 0' 
      });
    }

    // Validate stock is non-negative
    if (parseInt(countInStock) < 0) {
      return res.status(400).json({ 
        message: 'Stock count cannot be negative' 
      });
    }

    // Validate image structure
    if (!image.original || !image.thumbnail || !image.public_id) {
      return res.status(400).json({ 
        message: 'Invalid image structure. Please upload images properly.' 
      });
    }

    // Validate additionalImages structure if provided
    if (additionalImages.length > 0) {
      const invalidAdditionalImages = additionalImages.filter(
        img => !img.original || !img.thumbnail || !img.public_id
      );
      
      if (invalidAdditionalImages.length > 0) {
        return res.status(400).json({ 
          message: 'Invalid additional images structure' 
        });
      }
    }

    const product = new Product({
      name: name.trim(),
      price: parseFloat(price),
      description: description.trim(),
      image,
      additionalImages,
      brand: brand.trim(),
      category,
      countInStock: parseInt(countInStock) || 0,
      numReviews: 0,
      rating: 0,
      sizes: Array.isArray(sizes) ? sizes : [sizes],
      user: req.user._id
    });

    const createdProduct = await product.save();
    
    // Populate user info if needed
    await createdProduct.populate('user', 'name email');
    
    res.status(201).json(createdProduct);
  } catch (error) {
    console.error('Create product error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation error',
        errors: messages 
      });
    }
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Product with this name already exists' 
      });
    }
    
    res.status(500).json({ 
      message: 'Server error creating product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update a product (Admin only)
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
  try {
    const {
      name,
      price,
      description,
      image,
      additionalImages,
      brand,
      category,
      countInStock,
      sizes
    } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if user is authorized (owner or admin)
    if (product.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ 
        message: 'Not authorized to update this product' 
      });
    }

    // Update fields only if provided
    if (name !== undefined) {
      product.name = name.trim();
    }
    
    if (price !== undefined) {
      const priceValue = parseFloat(price);
      if (priceValue <= 0) {
        return res.status(400).json({ 
          message: 'Price must be greater than 0' 
        });
      }
      product.price = priceValue;
    }
    
    if (description !== undefined) {
      product.description = description.trim();
    }
    
    if (brand !== undefined) {
      product.brand = brand.trim();
    }
    
    if (category !== undefined) {
      product.category = category;
    }
    
    if (countInStock !== undefined) {
      const stockValue = parseInt(countInStock);
      if (stockValue < 0) {
        return res.status(400).json({ 
          message: 'Stock count cannot be negative' 
        });
      }
      product.countInStock = stockValue;
    }
    
    // Update main image if provided
    if (image && typeof image === 'object') {
      // Validate image structure
      if (!image.original || !image.thumbnail || !image.public_id) {
        return res.status(400).json({ 
          message: 'Invalid image structure' 
        });
      }
      product.image = image;
    }
    
    // Update additional images if provided
    if (additionalImages !== undefined) {
      // Validate additionalImages structure
      if (Array.isArray(additionalImages)) {
        const invalidImages = additionalImages.filter(
          img => !img || !img.original || !img.thumbnail || !img.public_id
        );
        
        if (invalidImages.length > 0) {
          return res.status(400).json({ 
            message: 'Invalid additional images structure' 
          });
        }
        
        product.additionalImages = additionalImages;
      } else if (additionalImages !== null) {
        return res.status(400).json({ 
          message: 'additionalImages must be an array or null' 
        });
      }
    }
    
    // Update sizes if provided
    if (sizes !== undefined) {
      if (!Array.isArray(sizes) || sizes.length === 0) {
        return res.status(400).json({ 
          message: 'Sizes must be a non-empty array' 
        });
      }
      product.sizes = sizes;
    }

    const updatedProduct = await product.save();
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Update product error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation error',
        errors: messages 
      });
    }
    
    res.status(500).json({ 
      message: 'Server error updating product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Delete a product (Admin only)
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if user is authorized (owner or admin)
    if (product.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ 
        message: 'Not authorized to delete this product' 
      });
    }

    // Optional: Delete images from Cloudinary before deleting product
    // This would require calling Cloudinary API to delete images
    
    await product.deleteOne();
    
    res.json({ 
      success: true,
      message: 'Product removed successfully' 
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ 
      message: 'Server error deleting product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get top rated products
// @route   GET /api/products/top
// @access  Public
const getTopProducts = async (req, res) => {
  try {
    const products = await Product.find({})
      .sort({ rating: -1 })
      .limit(5);

    res.json(products);
  } catch (error) {
    console.error('Get top products error:', error);
    res.status(500).json({ 
      message: 'Error fetching top products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get products by category
// @route   GET /api/products/category/:category
// @access  Public
const getProductsByCategory = async (req, res) => {
  try {
    const category = req.params.category;
    const pageSize = 10;
    const page = Number(req.query.pageNumber) || 1;

    const count = await Product.countDocuments({ category });
    
    const products = await Product.find({ category })
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .sort({ createdAt: -1 });

    res.json({ 
      products, 
      page, 
      pages: Math.ceil(count / pageSize),
      total: count 
    });
  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({ 
      message: 'Error fetching products by category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Create product review
// @route   POST /api/products/:id/reviews
// @access  Private
const createProductReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if user already reviewed this product
    const alreadyReviewed = product.reviews.find(
      review => review.user.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      return res.status(400).json({ message: 'Product already reviewed' });
    }

    // Create review
    const review = {
      user: req.user._id,
      name: req.user.name,
      rating: Number(rating),
      comment
    };

    // Add review to product
    product.reviews.push(review);
    product.numReviews = product.reviews.length;

    // Calculate new rating
    product.rating = 
      product.reviews.reduce((acc, item) => item.rating + acc, 0) / 
      product.reviews.length;

    await product.save();
    
    res.status(201).json({ 
      success: true,
      message: 'Review added successfully' 
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ 
      message: 'Error creating review',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getTopProducts,
  getProductsByCategory,
  createProductReview
};