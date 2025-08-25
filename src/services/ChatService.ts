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

      // Buscar TODOS os chats da Z-API usando paginação
      const chatsFromAPI = await this.zapiService.getAllChats(50); // 50 chats por página (mais estável)

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

      // 📦 Processar em lotes para evitar timeout
      const batchSize = 25; // Salvar 25 chats por vez
      
      for (let i = 0; i < chatsFromAPI.length; i += batchSize) {
        const batch = chatsFromAPI.slice(i, i + batchSize);
        logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}: chats ${i + 1} to ${Math.min(i + batchSize, chatsFromAPI.length)}`);
        
        // Processar cada chat do lote
        for (const chatData of batch) {
          try {
            await this.saveChatToDatabase(chatData);
            syncedCount++;
            
            // Log progresso a cada 50 chats
            if (syncedCount % 50 === 0) {
              logger.info(`✅ Progress: ${syncedCount}/${chatsFromAPI.length} chats synchronized`);
            }
          } catch (error) {
            logger.error(`Error saving chat ${chatData.phone}:`, error);
            errorCount++;
          }
        }
        
        // ⏱️ Pequeno delay entre lotes para não sobrecarregar
        if (i + batchSize < chatsFromAPI.length) {
          logger.info(`Waiting 500ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, 500));
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
   * Sincronizar páginas específicas de chats
   */
  public async syncChatsByPages(startPage: number, endPage: number, pageSize: number): Promise<{ success: boolean; synced: number; errors: number; message: string }> {
    try {
      logger.info(`Starting partial chat sync: pages ${startPage} to ${endPage} with pageSize ${pageSize}`);

      let allChats: ZAPIChatData[] = [];
      let syncedCount = 0;
      let errorCount = 0;

      // Buscar páginas específicas
      for (let page = startPage; page <= endPage; page++) {
        logger.info(`Fetching page ${page}...`);
        
        const chatsFromPage = await this.zapiService.getChats(page, pageSize);
        
        if (chatsFromPage.length === 0) {
          logger.info(`Page ${page} has no chats. Skipping.`);
          continue;
        }

        allChats.push(...chatsFromPage);
        logger.info(`Page ${page}: ${chatsFromPage.length} chats`);

        // ⏱️ Delay entre páginas
        if (page < endPage) {
          logger.info(`Waiting 1 second before next page...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (allChats.length === 0) {
        return {
          success: false,
          synced: 0,
          errors: 0,
          message: `No chats found in pages ${startPage}-${endPage}`
        };
      }

      // Processar em lotes
      const batchSize = 25;
      
      for (let i = 0; i < allChats.length; i += batchSize) {
        const batch = allChats.slice(i, i + batchSize);
        logger.info(`Processing batch: chats ${i + 1} to ${Math.min(i + batchSize, allChats.length)}`);
        
        for (const chatData of batch) {
          try {
            await this.saveChatToDatabase(chatData);
            syncedCount++;
          } catch (error) {
            logger.error(`Error saving chat ${chatData.phone}:`, error);
            errorCount++;
          }
        }
        
        // Delay entre lotes
        if (i + batchSize < allChats.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      const message = `Synchronized ${syncedCount} chats from pages ${startPage}-${endPage}, ${errorCount} errors`;
      logger.info(message);

      return {
        success: true,
        synced: syncedCount,
        errors: errorCount,
        message
      };

    } catch (error) {
      logger.error('Error during partial chat synchronization:', error);
      return {
        success: false,
        synced: 0,
        errors: 1,
        message: `Failed to synchronize pages ${startPage}-${endPage}`
      };
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
