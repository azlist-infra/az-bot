import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';

export interface SendTextRequest {
  phone: string;
  message: string;
}

export interface SendImageRequest {
  phone: string;
  image: string; // base64 with data:image/png;base64, prefix
  caption?: string;
}

export interface ZAPIResponse {
  success: boolean;
  message?: string;
  messageId?: string;
  error?: string;
}

export interface WebhookMessage {
  instanceId: string;
  message: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    messageTimestamp: number;
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text: string;
      };
    };
  };
}

export class ZAPIService {
  private static instance: ZAPIService;
  private axiosInstance: AxiosInstance;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: config.zApi.baseUrl,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add client token to headers if provided
    if (config.zApi.clientToken) {
      this.axiosInstance.defaults.headers['Client-Token'] = config.zApi.clientToken;
    }

    // Request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.info(`Z-API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Z-API Request Error:', error);
        return Promise.reject(error);
      },
    );

    // Response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.info(`Z-API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error(`Z-API Response Error: ${error.response?.status} ${error.config?.url}`, {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        return Promise.reject(error);
      },
    );
  }

  public static getInstance(): ZAPIService {
    if (!ZAPIService.instance) {
      ZAPIService.instance = new ZAPIService();
    }
    return ZAPIService.instance;
  }

  /**
   * Send text message via Z-API
   * POST /send-text
   */
  public async sendTextMessage(phone: string, message: string): Promise<ZAPIResponse> {
    try {
      const cleanPhone = this.cleanPhoneNumber(phone);
      
      logger.info(`Sending text message to ${cleanPhone}`);

      const payload: SendTextRequest = {
        phone: cleanPhone,
        message: message,
      };

      const response: AxiosResponse = await this.axiosInstance.post('/send-text', payload);

      if (response.data && response.status === 200) {
        logger.info(`Text message sent successfully to ${cleanPhone}`);
        
        return {
          success: true,
          messageId: response.data.messageId || response.data.key?.id,
          message: 'Message sent successfully',
        };
      } else {
        logger.error(`Failed to send text message to ${cleanPhone}:`, response.data);
        
        return {
          success: false,
          error: response.data?.message || 'Failed to send message',
        };
      }

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        
        logger.error(`Z-API send text error for ${phone}:`, {
          status,
          message,
          data: error.response?.data,
        });

        return {
          success: false,
          error: `Z-API error: ${message}`,
        };
      }

      logger.error(`Unexpected error sending text to ${phone}:`, error);
      
      return {
        success: false,
        error: 'Internal server error during message sending',
      };
    }
  }

  /**
   * Send image with caption via Z-API
   * POST /send-image
   */
  public async sendImageMessage(phone: string, base64Image: string, caption?: string): Promise<ZAPIResponse> {
    try {
      const cleanPhone = this.cleanPhoneNumber(phone);
      
      logger.info(`Sending image message to ${cleanPhone} with caption: ${caption ? 'yes' : 'no'}`);

      // Ensure base64 has proper prefix
      const imageData = base64Image.startsWith('data:image/') 
        ? base64Image 
        : `data:image/png;base64,${base64Image}`;

      const payload: SendImageRequest = {
        phone: cleanPhone,
        image: imageData,
        ...(caption && { caption }),
      };

      const response: AxiosResponse = await this.axiosInstance.post('/send-image', payload);

      if (response.data && response.status === 200) {
        logger.info(`Image message sent successfully to ${cleanPhone}`);
        
        return {
          success: true,
          messageId: response.data.messageId || response.data.key?.id,
          message: 'Image sent successfully',
        };
      } else {
        logger.error(`Failed to send image message to ${cleanPhone}:`, response.data);
        
        return {
          success: false,
          error: response.data?.message || 'Failed to send image',
        };
      }

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        
        logger.error(`Z-API send image error for ${phone}:`, {
          status,
          message,
          data: error.response?.data,
        });

        return {
          success: false,
          error: `Z-API error: ${message}`,
        };
      }

      logger.error(`Unexpected error sending image to ${phone}:`, error);
      
      return {
        success: false,
        error: 'Internal server error during image sending',
      };
    }
  }

  /**
   * Extract text from webhook message
   */
  public extractMessageText(webhookData: WebhookMessage): string | null {
    try {
      const message = webhookData.message?.message;
      
      if (message?.conversation) {
        return message.conversation.trim();
      }
      
      if (message?.extendedTextMessage?.text) {
        return message.extendedTextMessage.text.trim();
      }
      
      return null;
    } catch (error) {
      logger.error('Error extracting message text from webhook:', error);
      return null;
    }
  }

  /**
   * Extract phone number from webhook message
   */
  public extractPhoneNumber(webhookData: WebhookMessage): string | null {
    try {
      const remoteJid = webhookData.message?.key?.remoteJid;
      
      if (remoteJid) {
        // Remove @s.whatsapp.net suffix and clean
        return this.cleanPhoneNumber(remoteJid.replace('@s.whatsapp.net', ''));
      }
      
      return null;
    } catch (error) {
      logger.error('Error extracting phone number from webhook:', error);
      return null;
    }
  }

  /**
   * Check if message is from user (not from bot)
   */
  public isIncomingMessage(webhookData: WebhookMessage): boolean {
    return !webhookData.message?.key?.fromMe;
  }

  /**
   * Clean and format phone number
   */
  private cleanPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 0, remove it (for international format)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // If doesn't start with country code 55 (Brazil), add it
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Validate webhook data structure
   */
  public validateWebhookData(data: any): data is WebhookMessage {
    try {
      // Formato Z-API real (baseado no log capturado)
      const isZAPIFormat = (
        data &&
        typeof data === 'object' &&
        data.phone &&
        data.text &&
        data.text.message &&
        typeof data.fromMe === 'boolean'
      );

      // Formato original esperado (manter compatibilidade)
      const isOriginalFormat = (
        data &&
        typeof data === 'object' &&
        data.instanceId &&
        data.message &&
        data.message.key &&
        data.message.key.remoteJid &&
        typeof data.message.key.fromMe === 'boolean'
      );

      return isZAPIFormat || isOriginalFormat;
    } catch (error) {
      logger.error('Error validating webhook data:', error);
      return false;
    }
  }

  /**
   * Health check for Z-API
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Check instance status
      const response = await this.axiosInstance.get('/status', {
        timeout: 5000,
      });
      
      return response.status === 200 && response.data?.connected;
    } catch (error) {
      logger.error('Z-API health check failed:', error);
      return false;
    }
  }

  /**
   * Get instance connection status
   */
  public async getInstanceStatus(): Promise<{ connected: boolean; qrCode?: string }> {
    try {
      const response = await this.axiosInstance.get('/status');
      
      return {
        connected: response.data?.connected || false,
        qrCode: response.data?.qrCode,
      };
    } catch (error) {
      logger.error('Error getting instance status:', error);
      return { connected: false };
    }
  }
}
