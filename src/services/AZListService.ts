import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';

export interface AZListPaxResponse {
  success: boolean;
  data?: {
    pax: {
      id: string;
      name: string;
      email?: string;
      cpf: string;
      phone?: string;
      searchKey: string;
      status: string;
    };
    lists?: Array<{
      id: string;
      name: string;
      eventId: string;
    }>;
  };
  message?: string;
  error?: string;
}

export interface CPFValidationResult {
  found: boolean;
  userData?: {
    id: string;
    name: string;
    email?: string;
    cpf: string;
    phone?: string;
    searchKey: string;
    status: string;
  };
  lists?: Array<{
    id: string;
    name: string;
    eventId: string;
  }>;
  error?: string;
}

export class AZListService {
  private static instance: AZListService;
  private axiosInstance: AxiosInstance;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: config.azList.baseUrl,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Authorization': `Basic ${config.azList.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.info(`AZList API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('AZList API Request Error:', error);
        return Promise.reject(error);
      },
    );

    // Response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.info(`AZList API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error(`AZList API Response Error: ${error.response?.status} ${error.config?.url}`, {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        return Promise.reject(error);
      },
    );
  }

  public static getInstance(): AZListService {
    if (!AZListService.instance) {
      AZListService.instance = new AZListService();
    }
    return AZListService.instance;
  }

  /**
   * Validates Email against AZ List API
   * GET /api/pax/email/{email}/event/{eventId}
   */
  public async validateEmail(email: string): Promise<CPFValidationResult> {
    try {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return {
          found: false,
          error: 'Invalid email format',
        };
      }

      logger.info(`Validating Email: ${email} against AZ List`);

      const endpoint = `/api/pax/email/${encodeURIComponent(email)}/event/${config.azList.eventId}`;
      
      const response = await this.axiosInstance.get(endpoint);

      // Verificar se há erro na resposta
      if (response.data.error) {
        logger.info(`Email ${email} not found in AZ List: ${response.data.error}`);
        
        return {
          found: false,
          error: response.data.error,
        };
      }

      // Se chegou aqui e tem dados, é porque encontrou
      if (response.data && response.data.id) {
        const pax = response.data;
        
        logger.info(`Email ${email} found in AZ List: ${pax.Name}`);
        
        return {
          found: true,
          userData: {
            id: pax.id.toString(),
            name: pax.Name,
            email: pax.Email,
            ...(pax.Cpf && { cpf: pax.Cpf }),
            ...(pax.Phone && { phone: pax.Phone }),
            searchKey: pax.SearchKey,
            status: 'active',
          },
          lists: [], // API não retorna lists neste formato
        };
      } else {
        logger.info(`Email ${email} not found - unexpected response format`);
        
        return {
          found: false,
          error: 'Unexpected API response format',
        };
      }

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        
        logger.error(`AZ List API error for Email ${email}:`, {
          status,
          message,
          data: error.response?.data,
        });

        // Handle specific HTTP status codes
        if (status === 404) {
          return {
            found: false,
            error: 'Email not found',
          };
        }

        if (status === 401 || status === 403) {
          return {
            found: false,
            error: 'Authentication error with AZ List API',
          };
        }

        if (status === 429) {
          return {
            found: false,
            error: 'Rate limit exceeded on AZ List API',
          };
        }

        return {
          found: false,
          error: `AZ List API error: ${message}`,
        };
      }

      logger.error(`Unexpected error validating Email ${email}:`, error);
      
      return {
        found: false,
        error: 'Internal server error during Email validation',
      };
    }
  }

  /**
   * Validates CPF against AZ List API
   * GET /api/pax/cpf/{cpf}/event/{eventId}
   */
  public async validateCPF(cpf: string): Promise<CPFValidationResult> {
    try {
      // Remove any formatting from CPF (keep only numbers)
      const cleanCpf = cpf.replace(/\D/g, '');
      
      if (cleanCpf.length !== 11) {
        return {
          found: false,
          error: 'Invalid CPF format',
        };
      }

      logger.info(`Validating CPF: ${cleanCpf} against AZ List`);

      const endpoint = `/api/pax/cpf/${cleanCpf}/event/${config.azList.eventId}`;
      
      const response = await this.axiosInstance.get(endpoint);

      // Verificar se há erro na resposta
      if (response.data.error) {
        logger.info(`CPF ${cleanCpf} not found in AZ List: ${response.data.error}`);
        
        return {
          found: false,
          error: response.data.error,
        };
      }

      // Se chegou aqui e tem dados, é porque encontrou
      if (response.data && response.data.id) {
        const pax = response.data;
        
        logger.info(`CPF ${cleanCpf} found in AZ List: ${pax.Name}`);
        
        return {
          found: true,
          userData: {
            id: pax.id.toString(),
            name: pax.Name,
            ...(pax.Email && { email: pax.Email }),
            cpf: pax.Cpf,
            ...(pax.Phone && { phone: pax.Phone }),
            searchKey: pax.SearchKey,
            status: 'active',
          },
          lists: [], // API não retorna lists neste formato
        };
      } else {
        logger.info(`CPF ${cleanCpf} not found - unexpected response format`);
        
        return {
          found: false,
          error: 'Unexpected API response format',
        };
      }

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        
        logger.error(`AZ List API error for CPF ${cpf}:`, {
          status,
          message,
          data: error.response?.data,
        });

        // Handle specific HTTP status codes
        if (status === 404) {
          return {
            found: false,
            error: 'CPF not found',
          };
        }

        if (status === 401 || status === 403) {
          return {
            found: false,
            error: 'Authentication error with AZ List API',
          };
        }

        if (status === 429) {
          return {
            found: false,
            error: 'Rate limit exceeded on AZ List API',
          };
        }

        return {
          found: false,
          error: `AZ List API error: ${message}`,
        };
      }

      logger.error(`Unexpected error validating CPF ${cpf}:`, error);
      
      return {
        found: false,
        error: 'Internal server error during CPF validation',
      };
    }
  }

  /**
   * Get user data by search key (for verification/testing)
   */
  public async getUserBySearchKey(searchKey: string): Promise<CPFValidationResult> {
    try {
      logger.info(`Looking up user by SearchKey: ${searchKey}`);

      // This endpoint might not exist in the API, but included for completeness
      // You might need to adjust based on actual API endpoints available
      const endpoint = `/api/pax/searchkey/${searchKey}/event/${config.azList.eventId}`;
      
      const response: AxiosResponse<AZListPaxResponse> = await this.axiosInstance.get(endpoint);

      if (response.data.success && response.data.data?.pax) {
        const pax = response.data.data.pax;
        
        return {
          found: true,
          userData: {
            id: pax.id,
            name: pax.name,
            ...(pax.email && { email: pax.email }),
            cpf: pax.cpf,
            ...(pax.phone && { phone: pax.phone }),
            searchKey: pax.searchKey,
            status: pax.status,
          },
          lists: response.data.data.lists || [],
        };
      }

      return {
        found: false,
        error: 'Search key not found',
      };

    } catch (error) {
      logger.error(`Error looking up SearchKey ${searchKey}:`, error);
      
      return {
        found: false,
        error: 'Error during search key lookup',
      };
    }
  }

  /**
   * Health check for AZ List API
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Try a simple request to check if API is accessible
      const response = await this.axiosInstance.get('/health', {
        timeout: 5000,
      });
      
      return response.status === 200;
    } catch (error) {
      logger.error('AZ List API health check failed:', error);
      return false;
    }
  }
}
