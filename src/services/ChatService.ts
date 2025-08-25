import { Chat, IChat } from '@/models/Chat';
import { ZAPIService, ZAPIChatData } from '@/services/ZAPIService';
import { logger } from '@/utils/logger';

export class ChatService {
  private static instance: ChatService;
  private zapiService: ZAPIService;

  private constructor() {
    this.zapiService = ZAPIService.getInstance();
  }

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  /**
   * Sincronizar chats da Z-API com o banco de dados
   */
  public async syncChats(): Promise<{ success: boolean; synced: number; errors: number; message: string }> {
    try {
      logger.info('Starting chat synchronization from Z-API');

      // Buscar chats da Z-API
      const chatsFromAPI = await this.zapiService.getChats();

      if (chatsFromAPI.length === 0) {
        return {
          success: false,
          synced: 0,
          errors: 0,
          message: 'No chats found in Z-API or API error'
        };
      }

      let syncedCount = 0;
      let errorCount = 0;

      // Processar cada chat
      for (const chatData of chatsFromAPI) {
        try {
          await this.saveChatToDatabase(chatData);
          syncedCount++;
        } catch (error) {
          logger.error(`Error saving chat ${chatData.phone}:`, error);
          errorCount++;
        }
      }

      const message = `Synchronized ${syncedCount} chats successfully, ${errorCount} errors`;
      logger.info(message);

      return {
        success: true,
        synced: syncedCount,
        errors: errorCount,
        message
      };

    } catch (error) {
      logger.error('Error during chat synchronization:', error);
      return {
        success: false,
        synced: 0,
        errors: 1,
        message: 'Failed to synchronize chats'
      };
    }
  }

  /**
   * Salvar ou atualizar chat no banco de dados
   */
  private async saveChatToDatabase(chatData: ZAPIChatData): Promise<IChat> {
    try {
      // Converter dados da Z-API para formato do banco
      const chatDoc = {
        phone: chatData.phone,
        name: chatData.name,
        archived: chatData.archived === 'true',
        pinned: chatData.pinned === 'true',
        messagesUnread: chatData.messagesUnread || 0,
        unread: chatData.unread || '0',
        lastMessageTime: chatData.lastMessageTime,
        isMuted: chatData.isMuted || '0',
        isMarkedSpam: chatData.isMarkedSpam === 'true',
        muteEndTime: chatData.muteEndTime,
        sentMessage: true // Campo adicional conforme solicitado
      };

      // Usar upsert para criar ou atualizar
      const chat = await Chat.findOneAndUpdate(
        { phone: chatData.phone },
        chatDoc,
        { 
          upsert: true, 
          new: true,
          runValidators: true
        }
      );

      logger.debug(`Chat saved/updated: ${chat.phone} - ${chat.name}`);
      return chat;

    } catch (error) {
      logger.error(`Error saving chat to database for ${chatData.phone}:`, error);
      throw error;
    }
  }

  /**
   * Buscar todos os chats do banco de dados
   */
  public async getAllChats(): Promise<IChat[]> {
    try {
      const chats = await Chat.find()
        .sort({ lastMessageTime: -1 })
        .exec();

      logger.info(`Retrieved ${chats.length} chats from database`);
      return chats;

    } catch (error) {
      logger.error('Error retrieving chats from database:', error);
      return [];
    }
  }

  /**
   * Buscar chat por telefone
   */
  public async getChatByPhone(phone: string): Promise<IChat | null> {
    try {
      const chat = await Chat.findOne({ phone }).exec();
      return chat;

    } catch (error) {
      logger.error(`Error finding chat by phone ${phone}:`, error);
      return null;
    }
  }

  /**
   * Marcar chat como tendo mensagem enviada
   */
  public async markChatAsSent(phone: string): Promise<boolean> {
    try {
      const result = await Chat.updateOne(
        { phone },
        { sentMessage: true, updatedAt: new Date() }
      );

      return result.modifiedCount > 0;

    } catch (error) {
      logger.error(`Error marking chat as sent for ${phone}:`, error);
      return false;
    }
  }

  /**
   * Obter estatísticas dos chats
   */
  public async getChatStats(): Promise<{
    total: number;
    withSentMessages: number;
    muted: number;
    pinned: number;
    archived: number;
  }> {
    try {
      const [
        total,
        withSentMessages,
        muted,
        pinned,
        archived
      ] = await Promise.all([
        Chat.countDocuments(),
        Chat.countDocuments({ sentMessage: true }),
        Chat.countDocuments({ isMuted: { $ne: '0' } }),
        Chat.countDocuments({ pinned: true }),
        Chat.countDocuments({ archived: true })
      ]);

      return {
        total,
        withSentMessages,
        muted,
        pinned,
        archived
      };

    } catch (error) {
      logger.error('Error getting chat statistics:', error);
      return {
        total: 0,
        withSentMessages: 0,
        muted: 0,
        pinned: 0,
        archived: 0
      };
    }
  }
}
