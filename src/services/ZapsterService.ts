import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';

export interface ZapsterSendTextRequest {
  recipient: string;
  text: string;
  instance_id: string;
}

export interface ZapsterSendImageRequest {
  recipient: string;
  text?: string;
  media: {
    url?: string;
    file?: string; // base64 encoded image
  };
  instance_id: string;
}

export interface ZapsterResponse {
  success: boolean;
  message?: string;
  messageId?: string;
  error?: string;
}

/**
 * Zapster webhook message structure based on documentation
 * Formato: message.received event
 */
export interface ZapsterWebhookMessage {
  created_at: string;
  data: {
    content: {
      text?: string;
      media?: {
        url: string;
        metadata?: {
          animated?: boolean;
        };
      };
      location?: {
        address: string;
        latitude: number;
        longitude: number;
        mode: string;
        name: string;
      };
      view_once?: boolean;
    };
    id: string;
    recipient: {
      name: string;
      id: string;
      profile_picture?: string;
      type: 'chat' | 'group';
    };
    sender: {
      name: string;
      id: string;
      profile_picture?: string;
    };
    sent_at: string;
    type: 'text' | 'image' | 'audio' | 'location' | 'sticker' | 'document' | 'video';
  };
  id: string;
  type: 'message.received' | 'message.sent' | 'message.delivered' | 'message.read' | 'instance.connected' | 'instance.disconnected';
}

export class ZapsterService {
  private static instance: ZapsterService;
  private axiosInstance: AxiosInstance;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: config.zapster.baseUrl,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add authorization token to headers if provided
    if (config.zapster.token) {
      this.axiosInstance.defaults.headers['Authorization'] = `Bearer ${config.zapster.token}`;
    }

    // Request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.info(`Zapster Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Zapster Request Error:', error);
        return Promise.reject(error);
      },
    );

    // Response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.info(`Zapster Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error(`Zapster Response Error: ${error.response?.status} ${error.config?.url}`, {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        return Promise.reject(error);
      },
    );
  }

  public static getInstance(): ZapsterService {
    if (!ZapsterService.instance) {
      ZapsterService.instance = new ZapsterService();
    }
    return ZapsterService.instance;
  }

  /**
   * Send text message via Zapster API
   * POST /wa/messages
   */
  public async sendTextMessage(phone: string, message: string): Promise<ZapsterResponse> {
    try {
      const cleanPhone = this.cleanPhoneNumber(phone);
      
      if (!config.zapster.instanceId) {
        throw new Error('Zapster instance ID not configured');
      }
      
      logger.info(`Sending text message via Zapster to ${cleanPhone}`);

      const payload: ZapsterSendTextRequest = {
        recipient: cleanPhone,
        text: message,
        instance_id: config.zapster.instanceId,
      };

      const response: AxiosResponse = await this.axiosInstance.post('/wa/messages', payload);

      if (response.data && response.status === 200) {
        logger.info(`Text message sent successfully via Zapster to ${cleanPhone}`);
        
        return {
          success: true,
          messageId: response.data.messageId || response.data.id,
          message: 'Message sent successfully',
        };
      } else {
        logger.error(`Failed to send text message via Zapster to ${cleanPhone}:`, response.data);
        
        return {
          success: false,
          error: response.data?.message || 'Failed to send message',
        };
      }

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        
        logger.error(`Zapster send text error for ${phone}:`, {
          status,
          message,
          data: error.response?.data,
        });

        return {
          success: false,
          error: `Zapster error: ${message}`,
        };
      }

      logger.error(`Unexpected error sending text via Zapster to ${phone}:`, error);
      
      return {
        success: false,
        error: 'Internal server error during message sending',
      };
    }
  }

  /**
   * Send image with caption via Zapster API
   * POST /wa/messages
   */
  public async sendImageMessage(phone: string, base64Image: string, caption?: string): Promise<ZapsterResponse> {
    try {
      const cleanPhone = this.cleanPhoneNumber(phone);
      
      if (!config.zapster.instanceId) {
        throw new Error('Zapster instance ID not configured');
      }
      
      logger.info(`Sending image message via Zapster to ${cleanPhone} with caption: ${caption ? 'yes' : 'no'}`);

      // For Zapster, we can send base64 directly in the file field
      // Remove data:image prefix if present
      const imageData = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

      const payload: ZapsterSendImageRequest = {
        recipient: cleanPhone,
        instance_id: config.zapster.instanceId,
        media: {
          file: imageData,
        },
        ...(caption && { text: caption }),
      };

      const response: AxiosResponse = await this.axiosInstance.post('/wa/messages', payload);

      if (response.data && response.status === 200) {
        logger.info(`Image message sent successfully via Zapster to ${cleanPhone}`);
        
        return {
          success: true,
          messageId: response.data.messageId || response.data.id,
          message: 'Image sent successfully',
        };
      } else {
        logger.error(`Failed to send image message via Zapster to ${cleanPhone}:`, response.data);
        
        return {
          success: false,
          error: response.data?.message || 'Failed to send image',
        };
      }

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        
        logger.error(`Zapster send image error for ${phone}:`, {
          status,
          message,
          data: error.response?.data,
        });

        return {
          success: false,
          error: `Zapster error: ${message}`,
        };
      }

      logger.error(`Unexpected error sending image via Zapster to ${phone}:`, error);
      
      return {
        success: false,
        error: 'Internal server error during image sending',
      };
    }
  }

  /**
   * Extract text from Zapster webhook message
   */
  public extractMessageText(webhookData: ZapsterWebhookMessage): string | null {
    try {
      // For Zapster, the text is in data.content.text
      if (webhookData.data?.content?.text) {
        return webhookData.data.content.text.trim();
      }
      
      return null;
    } catch (error) {
      logger.error('Error extracting message text from Zapster webhook:', error);
      return null;
    }
  }

  /**
   * Extract phone number from Zapster webhook message
   */
  public extractPhoneNumber(webhookData: ZapsterWebhookMessage): string | null {
    try {
      // For Zapster, the sender phone is in data.sender.id
      if (webhookData.data?.sender?.id) {
        return this.cleanPhoneNumber(webhookData.data.sender.id);
      }
      
      return null;
    } catch (error) {
      logger.error('Error extracting phone number from Zapster webhook:', error);
      return null;
    }
  }

  /**
   * Check if message is incoming (Zapster only sends message.received for incoming messages)
   */
  public isIncomingMessage(webhookData: ZapsterWebhookMessage): boolean {
    // For Zapster, if the event type is 'message.received', it's always incoming
    return webhookData.type === 'message.received';
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
   * Validate Zapster webhook data structure
   */
  public validateWebhookData(data: any): data is ZapsterWebhookMessage {
    try {
      const isValidZapsterFormat = (
        data &&
        typeof data === 'object' &&
        data.type &&
        data.data &&
        data.data.sender &&
        data.data.sender.id &&
        data.created_at &&
        data.id
      );

      return isValidZapsterFormat;
    } catch (error) {
      logger.error('Error validating Zapster webhook data:', error);
      return false;
    }
  }

  /**
   * Health check for Zapster API
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!config.zapster.instanceId) {
        return false;
      }
      
      // Check instance status - endpoint may vary, adjust based on actual API
      const response = await this.axiosInstance.get(`/wa/instances/${config.zapster.instanceId}`, {
        timeout: 5000,
      });
      
      return response.status === 200;
    } catch (error) {
      logger.error('Zapster health check failed:', error);
      return false;
    }
  }

  /**
   * Get instance connection status
   */
  public async getInstanceStatus(): Promise<{ connected: boolean; qrCode?: string }> {
    try {
      if (!config.zapster.instanceId) {
        return { connected: false };
      }
      
      const response = await this.axiosInstance.get(`/wa/instances/${config.zapster.instanceId}`);
      
      return {
        connected: response.data?.status === 'connected' || false,
        qrCode: response.data?.qrCode,
      };
    } catch (error) {
      logger.error('Error getting Zapster instance status:', error);
      return { connected: false };
    }
  }
}
