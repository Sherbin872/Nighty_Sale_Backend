const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  rating: { type: Number, required: true },
  comment: { type: String, required: true }
}, { timestamps: true });

// Image Schema for reusability
const imageSchema = new mongoose.Schema({
  public_id: { 
    type: String, 
    required: [true, 'Public ID is required'] 
  },
  original: { 
    type: String, 
    required: [true, 'Original image URL is required'] 
  },
  thumbnail: { 
    type: String, 
    required: [true, 'Thumbnail URL is required'] 
  },
  medium: { 
    type: String, 
    required: [true, 'Medium image URL is required'] 
  },
  large: { 
    type: String, 
    required: [true, 'Large image URL is required'] 
  },
  placeholder: { 
    type: String, 
    required: [true, 'Placeholder URL is required'],
    default: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  }
});

const productSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Please add a product name'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  image: {
    type: imageSchema,
    required: [true, 'Please add a main product image']
  },
  additionalImages: [imageSchema], // Array of image objects
  brand: {
    type: String,
    required: [true, 'Please add a brand'],
    trim: true
  },
 category: {
    type: String,
    required: [true, 'Please add a category'],
    index: true // Keep this! It makes your new Search Page very fast
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  reviews: [reviewSchema],
  rating: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Rating must be at least 0'],
    max: [5, 'Rating cannot exceed 5']
  },
  numReviews: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Number of reviews cannot be negative']
  },
  price: {
    type: Number,
    required: [true, 'Please add a price'],
    default: 0,
    min: [0, 'Price cannot be negative']
  },
  countInStock: {
    type: Number,
    required: [true, 'Please add stock count'],
    default: 0,
    min: [0, 'Stock count cannot be negative']
  },
 sizes: [{
    type: String,
    required: [true, 'Please add at least one size']
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create indexes for search functionality
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ createdAt: -1 });

// Virtual for checking if product is in stock
productSchema.virtual('inStock').get(function() {
  return this.countInStock > 0;
});

// Virtual for checking if product has multiple images
productSchema.virtual('hasMultipleImages').get(function() {
  return this.additionalImages && this.additionalImages.length > 0;
});

module.exports = mongoose.model('Product', productSchema);