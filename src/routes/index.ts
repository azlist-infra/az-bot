import { Router } from 'express';
import webhookRoutes from './webhook';
import { chatRoutes } from './chats';

const router = Router();

// Mount webhook routes
router.use('/webhook', webhookRoutes);

// Mount chat routes
router.use('/chats', chatRoutes);

// Health check for the entire API
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'AZ-WhatsApp API is healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

export default router;
