// Common types and interfaces

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'image' | 'document' | 'audio' | 'video';
}

export interface CPFValidationRequest {
  cpf: string;
}

export interface CPFValidationResponse {
  valid: boolean;
  user?: {
    name: string;
    email?: string;
    phone?: string;
    additionalData?: Record<string, any>;
  };
}

export interface QRCodeData {
  userId: string;
  cpf: string;
  generatedAt: Date;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

export interface ZApiWebhookPayload {
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

export interface ConversationState {
  phoneNumber: string;
  stage: 'initial' | 'waiting_cpf' | 'cpf_received' | 'completed';
  cpf?: string;
  lastMessage?: Date;
  attempts: number;
}

export interface QRCodeResponse {
  qrCodeUrl: string;
  qrCodeBase64: string;
  userData: {
    name: string;
    cpf: string;
  };
  expiresAt: Date;
}

