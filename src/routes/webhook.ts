import { Router } from 'express';
import { WebhookController } from '@/controllers/WebhookController';
import { logger } from '@/utils/logger';

const router = Router();
const webhookController = WebhookController.getInstance();

/**
 * Z-API Webhook endpoint
 * POST /webhook/zapi/receive
 */
router.post('/zapi/receive', async (req, res) => {
  try {
    await webhookController.handleZAPIWebhook(req, res);
  } catch (error) {
    logger.error('Error in webhook route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * Health check endpoint
 * GET /webhook/health
 */
router.get('/health', async (req, res) => {
  try {
    await webhookController.healthCheck(req, res);
  } catch (error) {
    logger.error('Error in health check route:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
    });
  }
});

/**
 * Get conversation status (admin/testing)
 * GET /webhook/conversation/:phoneNumber
 */
router.get('/conversation/:phoneNumber', async (req, res) => {
  try {
    await webhookController.getConversationStatus(req, res);
  } catch (error) {
    logger.error('Error in conversation status route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * Reset conversation (admin/testing)
 * POST /webhook/conversation/:phoneNumber/reset
 */
router.post('/conversation/:phoneNumber/reset', async (req, res) => {
  try {
    await webhookController.resetConversation(req, res);
  } catch (error) {
    logger.error('Error in reset conversation route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * Get system stats
 * GET /webhook/stats
 */
router.get('/stats', async (req, res) => {
  try {
    await webhookController.getStats(req, res);
  } catch (error) {
    logger.error('Error in stats route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
