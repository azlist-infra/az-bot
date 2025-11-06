import { Message } from '@/models/Message';
import { AZListService } from './AZListService';
import { ZAPIService } from './ZAPIService';
import { ZapsterService } from './ZapsterService';
import { QRCodeService } from './QRCodeService';
import { isValidCpf, extractCpfFromMessage } from '@/utils/cpf';
import { MESSAGES, getInitialPrompt, getInvalidFormatMessage } from '@/config/messages';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';

export interface MessageProcessingResult {
  success: boolean;
  action: 'initial_prompt' | 'cpf_found' | 'cpf_not_found' | 'email_found' | 'email_not_found' | 'error';
  messagesSent: number;
  error?: string;
}

export class ConversationService {
  private static instance: ConversationService;
  private azListService: AZListService;
  private zapiService: ZAPIService;
  private zapsterService: ZapsterService;
  private qrCodeService: QRCodeService;
  
  private constructor() {
    this.azListService = AZListService.getInstance();
    this.zapiService = ZAPIService.getInstance();
    this.zapsterService = ZapsterService.getInstance();
    this.qrCodeService = QRCodeService.getInstance();
  }

  public static getInstance(): ConversationService {
    if (!ConversationService.instance) {
      ConversationService.instance = new ConversationService();
    }
    return ConversationService.instance;
  }

  /**
   * Get the active messaging service based on configuration
   */
  private getMessagingService() {
    if (config.zapster.enabled) {
      logger.info('Using Zapster service for messaging');
      return {
        service: this.zapsterService,
        type: 'zapster' as const
      };
    } else {
      logger.info('Using Z-API service for messaging');
      return {
        service: this.zapiService,
        type: 'zapi' as const
      };
    }
  }

  /**
   * Process incoming message - FLUXO SIMPLIFICADO
   */
  public async processMessage(phoneNumber: string, messageText: string): Promise<MessageProcessingResult> {
    try {
      // Save incoming message
      await this.saveMessage(phoneNumber, messageText, 'in', 'text');
      
      logger.info(`Processing message from ${phoneNumber}: "${messageText}"`);
      logger.info(`Bot flow type: ${config.bot.flowType}`);

      // Processar baseado no tipo de fluxo configurado
      if (config.bot.flowType === 'email') {
        return await this.processEmailFlow(phoneNumber, messageText);
      } else {
        return await this.processCPFFlow(phoneNumber, messageText);
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
   * Process message for CPF flow
   */
  private async processCPFFlow(phoneNumber: string, messageText: string): Promise<MessageProcessingResult> {
    // Extrair números da mensagem
    const numbersOnly = messageText.replace(/\D/g, '');
    
    logger.info(`CPF Flow - Message analysis from "${messageText}":`, {
      numbersOnly,
      numbersLength: numbersOnly.length,
      originalLength: messageText.length
    });
    
    // Determinar o tipo de mensagem baseado no conteúdo
    if (numbersOnly.length === 0) {
      // Mensagem sem números = prompt inicial (apenas textos puros)
      logger.info(`No numbers found, sending initial prompt`);
      return await this.sendInitialPrompt(phoneNumber);
    } else if (numbersOnly.length === 11) {
      // Exatamente 11 dígitos = candidato a CPF válido
      logger.info(`Processing 11-digit CPF candidate: ${numbersOnly}`);
      return await this.processCPF(phoneNumber, numbersOnly);
    } else if (numbersOnly.length === 10) {
      // 10 dígitos = CPF sem zero inicial (adicionar zero)
      const cpfWithZero = '0' + numbersOnly;
      logger.info(`Processing 10-digit CPF candidate (adding zero): ${cpfWithZero}`);
      return await this.processCPF(phoneNumber, cpfWithZero);
    } else {
      // Qualquer outra quantidade de números = CPF inválido
      logger.info(`Invalid CPF format: ${numbersOnly.length} digits, sending invalid CPF message`);
      return await this.sendInvalidMessage(phoneNumber);
    }
  }

  /**
   * Process message for Email flow
   */
  private async processEmailFlow(phoneNumber: string, messageText: string): Promise<MessageProcessingResult> {
    const trimmedMessage = messageText.trim();
    
    logger.info(`Email Flow - Message analysis from "${trimmedMessage}"`);
    
    // Verificar se parece com email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (emailRegex.test(trimmedMessage)) {
      // Parece ser um email válido
      logger.info(`Processing email candidate: ${trimmedMessage}`);
      return await this.processEmail(phoneNumber, trimmedMessage);
    } else {
      // Verificar se tem @ mas formato inválido
      if (trimmedMessage.includes('@')) {
        logger.info(`Invalid email format, sending invalid email message`);
        return await this.sendInvalidMessage(phoneNumber);
      } else {
        // Mensagem sem @ = prompt inicial
        logger.info(`No email pattern found, sending initial prompt`);
        return await this.sendInitialPrompt(phoneNumber);
      }
    }
  }

  /**
   * Enviar mensagem de formato inválido (CPF ou Email)
   */
  private async sendInvalidMessage(phoneNumber: string): Promise<MessageProcessingResult> {
    try {
      const { service } = this.getMessagingService();
      const invalidMessage = getInvalidFormatMessage(config.bot.flowType);
      await service.sendTextMessage(phoneNumber, invalidMessage);
      await this.saveMessage(phoneNumber, invalidMessage, 'out', 'text');
      
      return {
        success: true,
        action: config.bot.flowType === 'email' ? 'email_not_found' : 'cpf_not_found',
        messagesSent: 1,
      };
    } catch (error) {
      logger.error('Error sending invalid format message:', error);
      return {
        success: false,
        action: 'error',
        messagesSent: 0,
        error: 'Error sending invalid format message',
      };
    }
  }

  /**
   * Enviar mensagem de CPF inválido (mantido para compatibilidade)
   */
  private async sendInvalidCpfMessage(phoneNumber: string): Promise<MessageProcessingResult> {
    try {
      const { service } = this.getMessagingService();
      await service.sendTextMessage(phoneNumber, MESSAGES.INVALID_CPF);
      await this.saveMessage(phoneNumber, MESSAGES.INVALID_CPF, 'out', 'text');
      
      return {
        success: true,
        action: 'cpf_not_found', // usar a mesma action que CPF não encontrado
        messagesSent: 1,
      };
    } catch (error) {
      logger.error('Error sending invalid CPF message:', error);
      return {
        success: false,
        action: 'error',
        messagesSent: 0,
        error: 'Error sending invalid CPF message',
      };
    }
  }

  /**
   * Enviar prompt inicial (CPF ou Email baseado na configuração)
   */
  private async sendInitialPrompt(phoneNumber: string): Promise<MessageProcessingResult> {
    try {
      const { service } = this.getMessagingService();
      const initialMessage = getInitialPrompt(config.bot.flowType);
      await service.sendTextMessage(phoneNumber, initialMessage);
      await this.saveMessage(phoneNumber, initialMessage, 'out', 'text');
      
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
   * Processar Email
   */
  private async processEmail(phoneNumber: string, email: string): Promise<MessageProcessingResult> {
    try {
      // Validar email na AZ List
      logger.info(`Validating Email ${email} with AZ List API...`);
      const validation = await this.azListService.validateEmail(email);
      
      logger.info(`AZ List validation result for Email ${email}:`, {
        found: validation.found,
        error: validation.error,
        hasUserData: !!validation.userData
      });
      
      if (validation.found && validation.userData) {
        // Email encontrado - gerar QR Code
        const searchKey = validation.userData.searchKey || email;
        const qrCodeAZKey = `{"SearchKey": "${searchKey}"}`;
        const qrCodeBase64 = Buffer.from(qrCodeAZKey).toString('base64');
        
        logger.info(`Generating QR Code for Email ${email}:`, {
          searchKey,
          qrCodeData: qrCodeAZKey,
          btoa: qrCodeBase64
        });
        
        // Gerar QR Code
        const QRCode = require('qrcode');
        const qrCodeDataUrl = await QRCode.toDataURL(qrCodeBase64, {
          width: 512,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'M',
        });
        
        // Extrair apenas o base64 da imagem
        const qrCodeImageBase64 = qrCodeDataUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
        
        const qrCodeResult = {
          base64: qrCodeImageBase64,
          dataUrl: qrCodeDataUrl
        };
        
        // Enviar QR Code como imagem
        const { service } = this.getMessagingService();
        await service.sendImageMessage(phoneNumber, qrCodeResult.base64, MESSAGES.FOUND_CAPTION);
        
        // Salvar mensagem de QR Code
        await this.saveMessage(phoneNumber, MESSAGES.FOUND_CAPTION, 'out', 'image', true);
        
        return {
          success: true,
          action: 'email_found',
          messagesSent: 1,
        };
      } else {
        // Email não encontrado
        logger.info(`Email ${email} not found, sending NOT_FOUND message`);
        const { service } = this.getMessagingService();
        await service.sendTextMessage(phoneNumber, MESSAGES.NOT_FOUND);
        await this.saveMessage(phoneNumber, MESSAGES.NOT_FOUND, 'out', 'text');
        
        return {
          success: true,
          action: 'email_not_found',
          messagesSent: 1,
        };
      }
    } catch (error) {
      logger.error('Error processing Email:', error);
      
      // Enviar mensagem de erro
      const errorMessage = 'Desculpe, ocorreu um erro interno. Tente novamente em alguns minutos.';
      const { service } = this.getMessagingService();
      await service.sendTextMessage(phoneNumber, errorMessage);
      await this.saveMessage(phoneNumber, errorMessage, 'out', 'text');
      
      return {
        success: false,
        action: 'error',
        messagesSent: 1,
        error: 'Error processing Email',
      };
    }
  }

  /**
   * Processar CPF
   */
  private async processCPF(phoneNumber: string, cpf: string): Promise<MessageProcessingResult> {
    try {
      // Primeiro verificar se CPF tem formato básico válido
      if (cpf.length !== 11 || !/^\d{11}$/.test(cpf)) {
        logger.info(`CPF ${cpf} has invalid basic format, sending INVALID_CPF message`);
        return await this.sendInvalidCpfMessage(phoneNumber);
      }
      
      // Verificar se CPF não é uma sequência de números iguais (ex: 11111111111)
      if (/^(\d)\1{10}$/.test(cpf)) {
        logger.info(`CPF ${cpf} has all same digits, sending INVALID_CPF message`);
        return await this.sendInvalidCpfMessage(phoneNumber);
      }
      
      // Validar dígitos verificadores do CPF
      if (!isValidCpf(cpf)) {
        logger.info(`CPF ${cpf} has invalid check digits, sending INVALID_CPF message`);
        return await this.sendInvalidCpfMessage(phoneNumber);
      }
      
      // Validar CPF na AZ List
      logger.info(`Validating CPF ${cpf} with AZ List API...`);
      const validation = await this.azListService.validateCPF(cpf);
      
      logger.info(`AZ List validation result for CPF ${cpf}:`, {
        found: validation.found,
        error: validation.error,
        hasUserData: !!validation.userData
      });
      
      if (validation.found && validation.userData) {
        // CPF encontrado - gerar QR Code com formato correto (igual ao seu exemplo)
        const searchKey = validation.userData.searchKey || cpf; // usar SearchKey da API ou CPF como fallback
        const qrCodeAZKey = `{"SearchKey": "${searchKey}"}`;
        const qrCodeBase64 = Buffer.from(qrCodeAZKey).toString('base64'); // btoa equivalent
        
        logger.info(`Generating QR Code for CPF ${cpf}:`, {
          searchKey,
          qrCodeData: qrCodeAZKey,
          btoa: qrCodeBase64
        });
        
        // Gerar QR Code diretamente (sem usar QRCodeService que faz double encoding)
        const QRCode = require('qrcode');
        const qrCodeDataUrl = await QRCode.toDataURL(qrCodeBase64, {
          width: 512,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'M',
        });
        
        // Extrair apenas o base64 da imagem (igual ao seu exemplo)
        const qrCodeImageBase64 = qrCodeDataUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
        
        const qrCodeResult = {
          base64: qrCodeImageBase64,
          dataUrl: qrCodeDataUrl
        };
        
        // Enviar QR Code como imagem
        const { service } = this.getMessagingService();
        await service.sendImageMessage(phoneNumber, qrCodeResult.base64, MESSAGES.FOUND_CAPTION);
        
        // Salvar mensagem de QR Code (marcar como qrcodeMessage: true)
        await this.saveMessage(phoneNumber, MESSAGES.FOUND_CAPTION, 'out', 'image', true);
        
        return {
          success: true,
          action: 'cpf_found',
          messagesSent: 1,
        };
      } else {
        // CPF não encontrado
        logger.info(`CPF ${cpf} not found, sending NOT_FOUND message`);
        const { service } = this.getMessagingService();
        await service.sendTextMessage(phoneNumber, MESSAGES.NOT_FOUND);
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
      const { service } = this.getMessagingService();
      await service.sendTextMessage(phoneNumber, errorMessage);
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
  private async saveMessage(phoneNumber: string, messageText: string, direction: 'in' | 'out', kind: 'text' | 'image', qrcodeMessage: boolean = false): Promise<void> {
    try {
      await Message.create({
        from: phoneNumber,
        message: messageText,
        deliveredAt: new Date(),
        status: 'sent',
        direction,
        kind,
        qrcodeMessage, // 🎯 Marcar se é mensagem de QR Code
      });
    } catch (error) {
      logger.error('Error saving message:', error);
    }
  }
}