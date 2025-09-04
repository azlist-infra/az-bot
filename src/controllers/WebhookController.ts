import { Request, Response } from 'express';
import { ZAPIService, WebhookMessage } from '@/services/ZAPIService';
import { ZapsterService, ZapsterWebhookMessage } from '@/services/ZapsterService';
import { ConversationService } from '@/services/ConversationService';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';

export class WebhookController {
  private static instance: WebhookController;
  private zapiService: ZAPIService;
  private zapsterService: ZapsterService;
  private conversationService: ConversationService;

  private constructor() {
    this.zapiService = ZAPIService.getInstance();
    this.zapsterService = ZapsterService.getInstance();
    this.conversationService = ConversationService.getInstance();
  }

  public static getInstance(): WebhookController {
    if (!WebhookController.instance) {
      WebhookController.instance = new WebhookController();
    }
    return WebhookController.instance;
  }

  /**
   * Handle Z-API webhook for received messages
   */
  public async handleZAPIWebhook(req: Request, res: Response): Promise<void> {
    try {
      const startTime = Date.now();
      
      logger.info('Received Z-API webhook', {
        headers: req.headers,
        body: req.body,
        ip: req.ip,
      });

      // Validate webhook data structure
      if (!this.zapiService.validateWebhookData(req.body)) {
        logger.warn('Invalid webhook data structure', { body: req.body });
        
        // TEMPORÁRIO: Log detalhado para debug
        logger.info('Raw webhook data for debugging:', {
          body: JSON.stringify(req.body, null, 2),
          headers: req.headers,
          method: req.method,
          url: req.url
        });
        
        res.status(200).json({
          success: true,
          message: 'Data logged for debugging',
        });
        return;
      }

      const webhookData: WebhookMessage = req.body;

      // Check if this is an incoming message (not sent by us)
      if (!this.zapiService.isIncomingMessage(webhookData)) {
        logger.info('Ignoring outgoing message');
        res.status(200).json({
          success: true,
          message: 'Outgoing message ignored',
        });
        return;
      }

      // Extract phone number and message text
      const phoneNumber = this.zapiService.extractPhoneNumber(webhookData);
      const messageText = this.zapiService.extractMessageText(webhookData);

      if (!phoneNumber) {
        logger.warn('Could not extract phone number from webhook', { webhookData });
        res.status(400).json({
          success: false,
          error: 'Could not extract phone number',
        });
        return;
      }

      if (!messageText) {
        logger.info(`Received non-text message from ${phoneNumber}, ignoring`);
        res.status(200).json({
          success: true,
          message: 'Non-text message ignored',
        });
        return;
      }

      logger.info(`Processing message from ${phoneNumber}: "${messageText}"`);

      // Process the message through conversation service
      const result = await this.conversationService.processMessage(phoneNumber, messageText);

      const processingTime = Date.now() - startTime;

      logger.info(`Message processed in ${processingTime}ms`, {
        phoneNumber,
        result,
        processingTime,
      });

      // Return success response
      res.status(200).json({
        success: true,
        action: result.action,
        messagesSent: result.messagesSent,
        processingTime,
        ...(result.error && { error: result.error }),
      });

    } catch (error) {
      const processingTime = Date.now() - Date.now();
      
      logger.error('Error processing webhook:', error);

      res.status(500).json({
        success: false,
        error: 'Internal server error processing webhook',
        processingTime,
      });
    }
  }

  /**
   * Handle Zapster webhook for received messages
   */
  public async handleZapsterWebhook(req: Request, res: Response): Promise<void> {
    try {
      const startTime = Date.now();
      
      logger.info('Received Zapster webhook', {
        headers: req.headers,
        body: req.body,
        ip: req.ip,
      });

      // Validate webhook data structure
      if (!this.zapsterService.validateWebhookData(req.body)) {
        logger.warn('Invalid Zapster webhook data structure', { body: req.body });
        
        // Log detailed info for debugging
        logger.info('Raw Zapster webhook data for debugging:', {
          body: JSON.stringify(req.body, null, 2),
          headers: req.headers,
          method: req.method,
          url: req.url
        });
        
        res.status(200).json({
          success: true,
          message: 'Data logged for debugging',
        });
        return;
      }

      const webhookData: ZapsterWebhookMessage = req.body;

      // Only process message.received events
      if (webhookData.type !== 'message.received') {
        logger.info(`Ignoring Zapster event type: ${webhookData.type}`);
        res.status(200).json({
          success: true,
          message: `Event type ${webhookData.type} ignored`,
        });
        return;
      }

      // Only process text messages for now
      if (webhookData.data.type !== 'text') {
        logger.info(`Ignoring Zapster message type: ${webhookData.data.type}`);
        res.status(200).json({
          success: true,
          message: `Message type ${webhookData.data.type} ignored`,
        });
        return;
      }

      // Check if this is an incoming message (Zapster only sends message.received for incoming)
      if (!this.zapsterService.isIncomingMessage(webhookData)) {
        logger.info('Ignoring outgoing message');
        res.status(200).json({
          success: true,
          message: 'Outgoing message ignored',
        });
        return;
      }

      // Extract phone number and message text
      const phoneNumber = this.zapsterService.extractPhoneNumber(webhookData);
      const messageText = this.zapsterService.extractMessageText(webhookData);

      if (!phoneNumber) {
        logger.warn('Could not extract phone number from Zapster webhook', { webhookData });
        res.status(400).json({
          success: false,
          error: 'Could not extract phone number',
        });
        return;
      }

      if (!messageText) {
        logger.info(`Received non-text message from ${phoneNumber}, ignoring`);
        res.status(200).json({
          success: true,
          message: 'Non-text message ignored',
        });
        return;
      }

      logger.info(`Processing Zapster message from ${phoneNumber}: "${messageText}"`);

      // Process the message through conversation service
      const result = await this.conversationService.processMessage(phoneNumber, messageText);

      const processingTime = Date.now() - startTime;

      logger.info(`Zapster message processed in ${processingTime}ms`, {
        phoneNumber,
        result,
        processingTime,
      });

      // Return success response
      res.status(200).json({
        success: true,
        action: result.action,
        messagesSent: result.messagesSent,
        processingTime,
        ...(result.error && { error: result.error }),
      });

    } catch (error) {
      const processingTime = Date.now() - Date.now();
      
      logger.error('Error processing Zapster webhook:', error);

      res.status(500).json({
        success: false,
        error: 'Internal server error processing webhook',
        processingTime,
      });
    }
  }

  /**
   * Health check endpoint for webhook
   */
  public async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Check services based on configuration
      const services: any = {};
      
      if (config.zapster.enabled) {
        // Use Zapster
        const zapsterStatus = await this.zapsterService.healthCheck();
        services.zapster = zapsterStatus ? 'connected' : 'disconnected';
      } else {
        // Use Z-API
        const zapiStatus = await this.zapiService.healthCheck();
        services.zapi = zapiStatus ? 'connected' : 'disconnected';
      }
      
      res.status(200).json({
        success: true,
        status: 'healthy',
        services,
        activeService: config.zapster.enabled ? 'zapster' : 'zapi',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Health check error:', error);
      
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: 'Service health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get conversation status (for admin/testing)
   */
  public async getConversationStatus(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber } = req.params;

      if (!phoneNumber) {
        res.status(400).json({
          success: false,
          error: 'Phone number parameter required',
        });
        return;
      }

      // Get conversation history
      // Conversation service simplificado - sem histórico persistente

      res.status(200).json({
        success: true,
        phoneNumber,
        message: 'Conversation service simplified - stateless flow',
        flowType: 'simplified',
      });

    } catch (error) {
      logger.error('Error getting conversation status:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Reset conversation (for admin/testing)
   */
  public async resetConversation(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber } = req.params;

      if (!phoneNumber) {
        res.status(400).json({
          success: false,
          error: 'Phone number parameter required',
        });
        return;
      }

      // No reset needed in simplified flow
      const success = true;

      if (success) {
        res.status(200).json({
          success: true,
          message: `Conversation reset for ${phoneNumber}`,
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

    } catch (error) {
      logger.error('Error resetting conversation:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get system statistics
   */
  public async getStats(req: Request, res: Response): Promise<void> {
    try {
      // This could be expanded with more detailed stats
      res.status(200).json({
        success: true,
        stats: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error) {
      logger.error('Error getting stats:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}
