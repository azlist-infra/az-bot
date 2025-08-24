import { Router } from 'express';
import { WebhookController } from '../controllers/WebhookController';
import { logger } from '../utils/logger';

const router = Router();
const webhookController = WebhookController.getInstance();

/**
 * Z-API Webhook endpoint
 * POST/PUT /webhook/zapi/receive
 */
// Common handler for all HTTP methods
const handleWebhook = async (req: any, res: any) => {
  try {
    logger.info(`Webhook received via ${req.method}`, {
      method: req.method,
      url: req.url,
      body: req.body,
      query: req.query,
      headers: req.headers,
      ip: req.ip
    });
    await webhookController.handleZAPIWebhook(req, res);
  } catch (error) {
    logger.error('Error in webhook route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

router.post('/zapi/receive', handleWebhook);
router.put('/zapi/receive', handleWebhook);
router.get('/zapi/receive', handleWebhook);

/**
 * Z-API Webhook endpoint with instance ID (correct format)
 * POST/PUT /webhook/zapi/:instanceId/receive
 */
router.post('/zapi/:instanceId/receive', async (req, res) => {
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

router.put('/zapi/:instanceId/receive', async (req, res) => {
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
 * Health check endpoint - ALSO LOG ALL REQUESTS FOR DEBUG
 * GET /webhook/health
 */
router.get('/health', async (req, res) => {
  try {
    logger.info('HEALTH ENDPOINT ACCESSED', {
      method: req.method,
      url: req.url,
      body: req.body,
      query: req.query,
      headers: req.headers,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    await webhookController.healthCheck(req, res);
  } catch (error) {
    logger.error('Error in health check route:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
    });
  }
});

// CATCH-ALL route for debugging Z-API - SALVA NO MONGO (só para rotas não definidas)
router.all('/zapi/*', async (req, res) => {
  try {
    // Salvar no MongoDB para contornar limitação do Render Free
    const { Message } = await import('../models');
    
    await Message.create({
      from: 'DEBUG_ENDPOINT',
      message: `${req.method} ${req.originalUrl}`,
      caption: JSON.stringify({
        method: req.method,
        url: req.url,
        originalUrl: req.originalUrl,
        body: req.body,
        query: req.query,
        headers: req.headers,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date()
      }),
      deliveredAt: new Date(),
      status: 'sent',
      direction: 'in',
      kind: 'system',
      meta: {
        type: 'DEBUG_REQUEST',
        endpoint: req.originalUrl,
        method: req.method
      }
    });

    logger.info('CATCH-ALL: Request saved to MongoDB', {
      method: req.method,
      url: req.originalUrl
    });
  } catch (error) {
    logger.error('Error saving debug request:', error);
  }

  res.status(200).json({
    success: true,
    message: 'Request logged to database for debugging',
    method: req.method,
    url: req.url,
    timestamp: new Date()
  });
});

/**
 * Get debug logs from MongoDB (contorna limitação Render Free)
 * GET /webhook/debug-logs
 */
router.get('/debug-logs', async (req, res) => {
  try {
    const { Message } = await import('../models');
    
    const debugLogs = await Message.find({
      from: 'DEBUG_ENDPOINT'
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

    res.json({
      success: true,
      logs: debugLogs.map(log => ({
        id: log._id,
        endpoint: log.message,
        details: JSON.parse(log.caption || '{}'),
        timestamp: log.createdAt
      }))
    });
  } catch (error) {
    logger.error('Error getting debug logs:', error);
    res.status(500).json({
      success: false,
      error: 'Error getting debug logs'
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
