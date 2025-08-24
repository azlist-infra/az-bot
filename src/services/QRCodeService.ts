import QRCode from 'qrcode';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';

export interface QRCodeData {
  SearchKey: string;
}

export interface QRCodeGenerationResult {
  base64: string;
  dataUrl: string;
  width: number;
  height: number;
}

export class QRCodeService {
  private static instance: QRCodeService;

  private constructor() {}

  public static getInstance(): QRCodeService {
    if (!QRCodeService.instance) {
      QRCodeService.instance = new QRCodeService();
    }
    return QRCodeService.instance;
  }

  /**
   * Generates QR Code from search key
   * Creates base64 encoded JSON: {"SearchKey": "value"}
   */
  public async generateQRCode(searchKey: string): Promise<QRCodeGenerationResult> {
    try {
      // Create the data object as specified in briefing
      const qrData: QRCodeData = {
        SearchKey: searchKey,
      };

      // Convert to JSON string then to base64
      const jsonString = JSON.stringify(qrData);
      const base64Data = Buffer.from(jsonString).toString('base64');

      logger.info(`Generating QR code for SearchKey: ${searchKey}`);

      // Generate QR code with the base64 data
      const qrCodeDataUrl = await QRCode.toDataURL(base64Data, {
        width: config.qrCode.width,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
      });

      // Extract base64 from data URL (remove "data:image/png;base64," prefix)
      const base64Image = qrCodeDataUrl.split(',')[1];
      
      if (!base64Image) {
        throw new Error('Failed to extract base64 from QR code data URL');
      }

      const result: QRCodeGenerationResult = {
        base64: base64Image,
        dataUrl: qrCodeDataUrl,
        width: config.qrCode.width,
        height: config.qrCode.width, // QR codes are square
      };

      logger.info(`QR code generated successfully for SearchKey: ${searchKey}`);
      return result;

    } catch (error) {
      logger.error(`Error generating QR code for SearchKey: ${searchKey}`, error);
      throw new Error(`Failed to generate QR code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generates QR Code buffer for file operations
   */
  public async generateQRCodeBuffer(searchKey: string): Promise<Buffer> {
    try {
      const qrData: QRCodeData = {
        SearchKey: searchKey,
      };

      const jsonString = JSON.stringify(qrData);
      const base64Data = Buffer.from(jsonString).toString('base64');

      const buffer = await QRCode.toBuffer(base64Data, {
        width: config.qrCode.width,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
      });

      logger.info(`QR code buffer generated for SearchKey: ${searchKey}`);
      return buffer;

    } catch (error) {
      logger.error(`Error generating QR code buffer for SearchKey: ${searchKey}`, error);
      throw new Error(`Failed to generate QR code buffer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates if search key format is acceptable
   */
  public validateSearchKey(searchKey: string): boolean {
    if (!searchKey || typeof searchKey !== 'string') {
      return false;
    }

    // Trim whitespace
    const trimmed = searchKey.trim();
    
    // Must not be empty after trimming
    if (trimmed.length === 0) {
      return false;
    }

    // Basic validation - can be extended based on requirements
    if (trimmed.length > 1000) { // Reasonable limit
      return false;
    }

    return true;
  }

  /**
   * Decodes base64 data back to original object (for testing/verification)
   */
  public decodeQRData(base64Data: string): QRCodeData | null {
    try {
      const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
      const data = JSON.parse(jsonString) as QRCodeData;
      
      if (data && typeof data.SearchKey === 'string') {
        return data;
      }
      
      return null;
    } catch (error) {
      logger.error('Error decoding QR data:', error);
      return null;
    }
  }
}
