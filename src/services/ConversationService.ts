import { Conversation, IConversation, ConversationState } from '@/models/Conversation';
import { Message, IMessage } from '@/models/Message';
import { AZListService, CPFValidationResult } from './AZListService';
import { ZAPIService } from './ZAPIService';
import { QRCodeService } from './QRCodeService';
import { isValidCpf, extractCpfFromMessage, formatCpf } from '@/utils/cpf';
import { MESSAGES, getCpfValidationMessage } from '@/config/messages';
import { logger } from '@/utils/logger';

export interface MessageProcessingResult {
  success: boolean;
  action: 'initial_prompt' | 'cpf_validation' | 'cpf_found' | 'cpf_not_found' | 'error';
  messagesSent: number;
  error?: string;
}

export class ConversationService {
  private static instance: ConversationService;
  private azListService: AZListService;
  private zapiService: ZAPIService;
  private qrCodeService: QRCodeService;
  
  private constructor() {
    this.azListService = AZListService.getInstance();
    this.zapiService = ZAPIService.getInstance();
    this.qrCodeService = QRCodeService.getInstance();
  }

  public static getInstance(): ConversationService {
    if (!ConversationService.instance) {
      ConversationService.instance = new ConversationService();
    }
    return ConversationService.instance;
  }

  /**
   * Process incoming message and manage conversation flow
   */
  public async processMessage(phoneNumber: string, messageText: string): Promise<MessageProcessingResult> {
    try {
      // Save incoming message
      await this.saveMessage(phoneNumber, messageText, 'in', 'text');
      
      // Get or create conversation
      let conversation = await this.getOrCreateConversation(phoneNumber);
      
      logger.info(`Processing message from ${phoneNumber}, current state: ${conversation.state}`);

      // Process based on current conversation state
      switch (conversation.state) {
        case 'initial':
          return await this.handleInitialMessage(conversation, messageText);
          
        case 'awaiting_cpf':
          return await this.handleCpfMessage(conversation, messageText);
          
        case 'resolved_found':
        case 'resolved_not_found':
          return await this.handleResolvedState(conversation, messageText);
          
        default:
          logger.error(`Unknown conversation state: ${conversation.state}`);
          return await this.handleError(conversation, 'Unknown conversation state');
      }

    } catch (error) {
      logger.error(`Error processing message from ${phoneNumber}:`, error);
      
      try {
        const conversation = await this.getOrCreateConversation(phoneNumber);
        return await this.handleError(conversation, 'Internal server error');
      } catch (nestedError) {
        logger.error('Error in error handler:', nestedError);
        return {
          success: false,
          action: 'error',
          messagesSent: 0,
          error: 'Critical error in message processing',
        };
      }
    }
  }

  /**
   * Handle initial message - send CPF prompt
   */
  private async handleInitialMessage(conversation: IConversation, messageText: string): Promise<MessageProcessingResult> {
    try {
      // Check if message already contains a valid CPF
      const extractedCpf = extractCpfFromMessage(messageText);
      
      if (extractedCpf && isValidCpf(extractedCpf)) {
        // Process CPF immediately
        conversation.cpf = extractedCpf;
        conversation.updateState('awaiting_cpf');
        await conversation.save();
        
        return await this.validateAndProcessCpf(conversation, extractedCpf);
      }

      // Send initial prompt
      const response = await this.zapiService.sendTextMessage(
        conversation.phoneNumber,
        MESSAGES.INITIAL_PROMPT
      );

      if (response.success) {
        await this.saveMessage(conversation.phoneNumber, MESSAGES.INITIAL_PROMPT, 'out', 'text');
        
        conversation.updateState('awaiting_cpf');
        await conversation.save();

        return {
          success: true,
          action: 'initial_prompt',
          messagesSent: 1,
        };
      } else {
        throw new Error(`Failed to send initial prompt: ${response.error}`);
      }

    } catch (error) {
      logger.error('Error in handleInitialMessage:', error);
      return await this.handleError(conversation, 'Failed to send initial prompt');
    }
  }

  /**
   * Handle CPF message - validate and process
   */
  private async handleCpfMessage(conversation: IConversation, messageText: string): Promise<MessageProcessingResult> {
    try {
      const extractedCpf = extractCpfFromMessage(messageText);
      
      if (!extractedCpf || !isValidCpf(extractedCpf)) {
        // Invalid CPF format
        const attempts = conversation.incrementAttempts();
        
        // Limit attempts to prevent spam
        if (attempts >= 3) {
          conversation.updateState('resolved_not_found');
          await conversation.save();
          
          const response = await this.zapiService.sendTextMessage(
            conversation.phoneNumber,
            MESSAGES.SYSTEM.ERROR
          );

          if (response.success) {
            await this.saveMessage(conversation.phoneNumber, MESSAGES.SYSTEM.ERROR, 'out', 'text');
          }

          return {
            success: true,
            action: 'error',
            messagesSent: 1,
            error: 'Too many invalid CPF attempts',
          };
        }

        // Send validation error message
        const errorMessage = extractedCpf ? 
          getCpfValidationMessage(extractedCpf) : 
          MESSAGES.INVALID_CPF;

        const response = await this.zapiService.sendTextMessage(
          conversation.phoneNumber,
          errorMessage
        );

        if (response.success) {
          await this.saveMessage(conversation.phoneNumber, errorMessage, 'out', 'text');
        }

        await conversation.save();

        return {
          success: true,
          action: 'cpf_validation',
          messagesSent: 1,
        };
      }

      // Valid CPF format - validate with AZ List
      conversation.cpf = extractedCpf;
      await conversation.save();
      
      return await this.validateAndProcessCpf(conversation, extractedCpf);

    } catch (error) {
      logger.error('Error in handleCpfMessage:', error);
      return await this.handleError(conversation, 'Failed to process CPF');
    }
  }

  /**
   * Handle resolved state - conversation already completed
   */
  private async handleResolvedState(conversation: IConversation, messageText: string): Promise<MessageProcessingResult> {
    try {
      // Check if user is starting over with a new CPF
      const extractedCpf = extractCpfFromMessage(messageText);
      
      if (extractedCpf && isValidCpf(extractedCpf) && extractedCpf !== conversation.cpf) {
        // Reset conversation for new CPF
        conversation.reset();
        conversation.cpf = extractedCpf;
        conversation.updateState('awaiting_cpf');
        await conversation.save();
        
        return await this.validateAndProcessCpf(conversation, extractedCpf);
      }

      // Send appropriate message based on previous resolution
      let responseMessage: string;
      
      if (conversation.state === 'resolved_found') {
        responseMessage = 'Você já consultou seu QR Code. Se precisar de uma nova consulta, envie outro CPF.';
      } else {
        responseMessage = MESSAGES.NOT_FOUND;
      }

      const response = await this.zapiService.sendTextMessage(
        conversation.phoneNumber,
        responseMessage
      );

      if (response.success) {
        await this.saveMessage(conversation.phoneNumber, responseMessage, 'out', 'text');
      }

      return {
        success: true,
        action: conversation.state === 'resolved_found' ? 'cpf_found' : 'cpf_not_found',
        messagesSent: 1,
      };

    } catch (error) {
      logger.error('Error in handleResolvedState:', error);
      return await this.handleError(conversation, 'Error in resolved state');
    }
  }

  /**
   * Validate CPF with AZ List and send appropriate response
   */
  private async validateAndProcessCpf(conversation: IConversation, cpf: string): Promise<MessageProcessingResult> {
    try {
      logger.info(`Validating CPF ${cpf} with AZ List`);
      
      const validationResult: CPFValidationResult = await this.azListService.validateCPF(cpf);

      if (validationResult.found && validationResult.userData) {
        // CPF found - generate and send QR code
        return await this.handleCpfFound(conversation, validationResult);
      } else {
        // CPF not found - send not found message
        return await this.handleCpfNotFound(conversation);
      }

    } catch (error) {
      logger.error(`Error validating CPF ${cpf}:`, error);
      return await this.handleError(conversation, 'Error during CPF validation');
    }
  }

  /**
   * Handle CPF found - generate QR and send
   */
  private async handleCpfFound(conversation: IConversation, validationResult: CPFValidationResult): Promise<MessageProcessingResult> {
    try {
      const userData = validationResult.userData!;
      const searchKey = userData.searchKey;

      logger.info(`CPF found for ${conversation.phoneNumber}: ${userData.name}`);

      // Generate QR Code
      const qrResult = await this.qrCodeService.generateQRCode(searchKey);

      // Send confirmation message first
      const confirmationResponse = await this.zapiService.sendTextMessage(
        conversation.phoneNumber,
        MESSAGES.FOUND_MESSAGE
      );

      if (confirmationResponse.success) {
        await this.saveMessage(conversation.phoneNumber, MESSAGES.FOUND_MESSAGE, 'out', 'text');
      }

      // Send QR Code image with caption
      const imageResponse = await this.zapiService.sendImageMessage(
        conversation.phoneNumber,
        qrResult.base64,
        MESSAGES.FOUND_CAPTION
      );

      if (imageResponse.success) {
        await this.saveMessage(
          conversation.phoneNumber, 
          'QR Code Image', 
          'out', 
          'image',
          MESSAGES.FOUND_CAPTION
        );
      }

      // Update conversation state
      conversation.updateState('resolved_found');
      conversation.userData = {
        name: userData.name,
        searchKey: searchKey,
      };
      await conversation.save();

      return {
        success: true,
        action: 'cpf_found',
        messagesSent: 2, // confirmation + image
      };

    } catch (error) {
      logger.error('Error in handleCpfFound:', error);
      return await this.handleError(conversation, 'Error generating QR code');
    }
  }

  /**
   * Handle CPF not found
   */
  private async handleCpfNotFound(conversation: IConversation): Promise<MessageProcessingResult> {
    try {
      logger.info(`CPF not found for ${conversation.phoneNumber}`);

      const response = await this.zapiService.sendTextMessage(
        conversation.phoneNumber,
        MESSAGES.NOT_FOUND
      );

      if (response.success) {
        await this.saveMessage(conversation.phoneNumber, MESSAGES.NOT_FOUND, 'out', 'text');
      }

      conversation.updateState('resolved_not_found');
      await conversation.save();

      return {
        success: true,
        action: 'cpf_not_found',
        messagesSent: 1,
      };

    } catch (error) {
      logger.error('Error in handleCpfNotFound:', error);
      return await this.handleError(conversation, 'Error handling CPF not found');
    }
  }

  /**
   * Handle errors in conversation flow
   */
  private async handleError(conversation: IConversation, errorMessage: string): Promise<MessageProcessingResult> {
    try {
      logger.error(`Handling error for ${conversation.phoneNumber}: ${errorMessage}`);

      const response = await this.zapiService.sendTextMessage(
        conversation.phoneNumber,
        MESSAGES.SYSTEM.ERROR
      );

      if (response.success) {
        await this.saveMessage(conversation.phoneNumber, MESSAGES.SYSTEM.ERROR, 'out', 'text');
      }

      return {
        success: false,
        action: 'error',
        messagesSent: response.success ? 1 : 0,
        error: errorMessage,
      };

    } catch (error) {
      logger.error('Error in error handler:', error);
      return {
        success: false,
        action: 'error',
        messagesSent: 0,
        error: 'Critical error in error handling',
      };
    }
  }

  /**
   * Get or create conversation for phone number
   */
  private async getOrCreateConversation(phoneNumber: string): Promise<IConversation> {
    try {
      let conversation = await Conversation.findOne({ phoneNumber });
      
      if (!conversation) {
        conversation = new Conversation({
          phoneNumber,
          state: 'initial',
          lastMessageAt: new Date(),
          attempts: 0,
        });
        await conversation.save();
        logger.info(`Created new conversation for ${phoneNumber}`);
      }
      
      return conversation;
    } catch (error) {
      logger.error(`Error getting/creating conversation for ${phoneNumber}:`, error);
      throw error;
    }
  }

  /**
   * Save message to database
   */
  private async saveMessage(
    phoneNumber: string, 
    messageText: string, 
    direction: 'in' | 'out', 
    kind: 'text' | 'image' | 'system',
    caption?: string
  ): Promise<IMessage> {
    try {
      const message = new Message({
        from: phoneNumber,
        message: messageText,
        caption,
        deliveredAt: new Date(),
        status: 'sent',
        direction,
        kind,
      });
      
      await message.save();
      return message;
    } catch (error) {
      logger.error(`Error saving message for ${phoneNumber}:`, error);
      throw error;
    }
  }

  /**
   * Get conversation history for a phone number
   */
  public async getConversationHistory(phoneNumber: string, limit: number = 50): Promise<IMessage[]> {
    try {
      return await Message.find({ from: phoneNumber })
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec();
    } catch (error) {
      logger.error(`Error getting conversation history for ${phoneNumber}:`, error);
      throw error;
    }
  }

  /**
   * Reset conversation state (for admin/testing purposes)
   */
  public async resetConversation(phoneNumber: string): Promise<boolean> {
    try {
      const conversation = await Conversation.findOne({ phoneNumber });
      
      if (conversation) {
        conversation.reset();
        await conversation.save();
        logger.info(`Reset conversation for ${phoneNumber}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error resetting conversation for ${phoneNumber}:`, error);
      return false;
    }
  }
}
