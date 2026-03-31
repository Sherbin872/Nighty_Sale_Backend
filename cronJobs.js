// cronJobs.js
const cron = require('node-cron');
const Order = require('./models/Order'); // Adjust path to your Order model if needed

const startCronJobs = () => {
  // This runs every 30 minutes ('*/30 * * * *')
  cron.schedule('*/30 * * * *', async () => {
    console.log('🧹 Running automated sweep for abandoned orders...');

    try {
      // Calculate the time 30 minutes ago
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

      // Find and delete all unpaid orders older than 30 minutes
      const result = await Order.deleteMany({
        isPaid: false,
        createdAt: { $lt: thirtyMinsAgo }
      });

      if (result.deletedCount > 0) {
        console.log(`✅ Automated Sweep cleared ${result.deletedCount} abandoned ghost orders.`);
        // Note: If you subtract inventory when the order is CREATED (instead of when PAID), 
        // you would need to loop through the orders and add the stock back here before deleting them.
      }
    } catch (error) {
      console.error('❌ Error sweeping abandoned orders:', error);
    }
  });
};

module.exports = startCronJobs;