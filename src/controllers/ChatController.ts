import { Request, Response } from 'express';
import { ChatService } from '@/services/ChatService';
import { logger } from '@/utils/logger';

export class ChatController {
  private static instance: ChatController;
  private chatService: ChatService;

  private constructor() {
    this.chatService = ChatService.getInstance();
  }

  public static getInstance(): ChatController {
    if (!ChatController.instance) {
      ChatController.instance = new ChatController();
    }
    return ChatController.instance;
  }

  /**
   * Sincronizar chats da Z-API
   * POST /api/chats/sync
   */
  public async syncChats(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Chat sync requested');

      const result = await this.chatService.syncChats();

      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          data: {
            synced: result.synced,
            errors: result.errors
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          data: {
            synced: result.synced,
            errors: result.errors
          }
        });
      }

    } catch (error) {
      logger.error('Error in chat sync endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during chat synchronization',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Listar todos os chats
   * GET /api/chats
   */
  public async getAllChats(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Get all chats requested');

      const chats = await this.chatService.getAllChats();

      res.status(200).json({
        success: true,
        message: `Retrieved ${chats.length} chats`,
        data: chats
      });

    } catch (error) {
      logger.error('Error in get all chats endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error retrieving chats',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Buscar chat por telefone
   * GET /api/chats/:phone
   */
  public async getChatByPhone(req: Request, res: Response): Promise<void> {
    try {
      const { phone } = req.params;
      
      if (!phone) {
        res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
        return;
      }

      logger.info(`Get chat by phone requested: ${phone}`);

      const chat = await this.chatService.getChatByPhone(phone);

      if (chat) {
        res.status(200).json({
          success: true,
          message: 'Chat found',
          data: chat
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Chat not found'
        });
      }

    } catch (error) {
      logger.error('Error in get chat by phone endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error retrieving chat',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Obter estatísticas dos chats
   * GET /api/chats/stats
   */
  public async getChatStats(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Get chat stats requested');

      const stats = await this.chatService.getChatStats();

      res.status(200).json({
        success: true,
        message: 'Chat statistics retrieved',
        data: stats
      });

    } catch (error) {
      logger.error('Error in get chat stats endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error retrieving chat statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Marcar chat como tendo mensagem enviada
   * PATCH /api/chats/:phone/mark-sent
   */
  public async markChatAsSent(req: Request, res: Response): Promise<void> {
    try {
      const { phone } = req.params;
      
      if (!phone) {
        res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
        return;
      }

      logger.info(`Mark chat as sent requested: ${phone}`);

      const success = await this.chatService.markChatAsSent(phone);

      if (success) {
        res.status(200).json({
          success: true,
          message: 'Chat marked as sent successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Chat not found or already marked as sent'
        });
      }

    } catch (error) {
      logger.error('Error in mark chat as sent endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error marking chat as sent',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
