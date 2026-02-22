const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getSearchSuggestions,
} = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');

// Route for getting all products and creating a product
router.route('/')
  .get(getProducts)
  .post(protect, admin, createProduct);

// Route for single product operations
router.route('/:id')
  .get(getProductById)
  .put(protect, admin, updateProduct)
  .delete(protect, admin, deleteProduct);

router.get('/search/suggestions', getSearchSuggestions);

module.exports = router;