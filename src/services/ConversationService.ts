import { Message } from '@/models/Message';
import { AZListService } from './AZListService';
import { ZAPIService } from './ZAPIService';
import { QRCodeService } from './QRCodeService';
import { isValidCpf, extractCpfFromMessage } from '@/utils/cpf';
import { MESSAGES } from '@/config/messages';
import { logger } from '@/utils/logger';

export interface MessageProcessingResult {
  success: boolean;
  action: 'initial_prompt' | 'cpf_found' | 'cpf_not_found' | 'error';
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
   * Process incoming message - FLUXO SIMPLIFICADO
   */
  public async processMessage(phoneNumber: string, messageText: string): Promise<MessageProcessingResult> {
    try {
      // Save incoming message
      await this.saveMessage(phoneNumber, messageText, 'in', 'text');
      
      logger.info(`Processing message from ${phoneNumber}: "${messageText}"`);

      // Verificar se é um CPF
      const cpf = extractCpfFromMessage(messageText);
      
      if (cpf && isValidCpf(cpf)) {
        // É um CPF válido, processar
        return await this.processCPF(phoneNumber, cpf);
      } else {
        // Qualquer outra mensagem = pedir CPF
        return await this.sendInitialPrompt(phoneNumber);
      }
    } catch (error) {
      logger.error('Error processing message:', error);
      return {
        success: false,
        action: 'error',
        messagesSent: 0,
        error: 'Error processing message',
      };
    }
  }

  /**
   * Enviar prompt inicial pedindo CPF
   */
  private async sendInitialPrompt(phoneNumber: string): Promise<MessageProcessingResult> {
    try {
      await this.zapiService.sendTextMessage(phoneNumber, MESSAGES.INITIAL_PROMPT);
      await this.saveMessage(phoneNumber, MESSAGES.INITIAL_PROMPT, 'out', 'text');
      
      return {
        success: true,
        action: 'initial_prompt',
        messagesSent: 1,
      };
    } catch (error) {
      logger.error('Error sending initial prompt:', error);
      return {
        success: false,
        action: 'error',
        messagesSent: 0,
        error: 'Error sending initial prompt',
      };
    }
  }

  /**
   * Processar CPF
   */
  private async processCPF(phoneNumber: string, cpf: string): Promise<MessageProcessingResult> {
    try {
      // Validar CPF na AZ List
      const validation = await this.azListService.validateCPF(cpf);
      
      if (validation.found && validation.userData) {
        // CPF encontrado - gerar QR Code
        const qrData = JSON.stringify({ SearchKey: validation.userData.searchKey });
        const qrCodeResult = await this.qrCodeService.generateQRCode(qrData);
        
        // Enviar QR Code
        await this.zapiService.sendImageMessage(phoneNumber, qrCodeResult.base64, MESSAGES.FOUND_CAPTION);
        
        // Salvar mensagens
        await this.saveMessage(phoneNumber, MESSAGES.FOUND_CAPTION, 'out', 'image');
        
        return {
          success: true,
          action: 'cpf_found',
          messagesSent: 1,
        };
      } else {
        // CPF não encontrado
        await this.zapiService.sendTextMessage(phoneNumber, MESSAGES.NOT_FOUND);
        await this.saveMessage(phoneNumber, MESSAGES.NOT_FOUND, 'out', 'text');
        
        return {
          success: true,
          action: 'cpf_not_found',
          messagesSent: 1,
        };
      }
    } catch (error) {
      logger.error('Error processing CPF:', error);
      
      // Enviar mensagem de erro
      const errorMessage = 'Desculpe, ocorreu um erro interno. Tente novamente em alguns minutos.';
      await this.zapiService.sendTextMessage(phoneNumber, errorMessage);
      await this.saveMessage(phoneNumber, errorMessage, 'out', 'text');
      
      return {
        success: false,
        action: 'error',
        messagesSent: 1,
        error: 'Error processing CPF',
      };
    }
  }

  /**
   * Salvar mensagem no banco
   */
  private async saveMessage(phoneNumber: string, messageText: string, direction: 'in' | 'out', kind: 'text' | 'image'): Promise<void> {
    try {
      await Message.create({
        from: phoneNumber,
        message: messageText,
        deliveredAt: new Date(),
        status: 'sent',
        direction,
        kind,
      });
    } catch (error) {
      logger.error('Error saving message:', error);
    }
  }
}