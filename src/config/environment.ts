import dotenv from 'dotenv';
import joi from 'joi';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = joi.object({
  NODE_ENV: joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: joi.number().default(3000),
  MONGO_URI: joi.string().required(),
  
  // Z-API Configuration
  ZAPI_INSTANCE_ID: joi.string().required(),
  ZAPI_TOKEN: joi.string().required(),
  ZAPI_CLIENT_TOKEN: joi.string().optional(),
  
  // AZ List Configuration
  AZLIST_BASE_URL: joi.string().uri().required(),
  AZLIST_TOKEN: joi.string().required(),
  AZLIST_EVENT_ID: joi.string().required(),
  
  // QR Code Configuration
  QR_SIGN_SECRET: joi.string().optional(),
  QR_WIDTH: joi.number().default(512),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: joi.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: joi.number().default(100),
  
  // Logging
  LOG_LEVEL: joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
  LOG_FILE: joi.string().default('logs/app.log'),
}).unknown();

// Validate environment variables
const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export interface EnvironmentConfig {
  env: string;
  port: number;
  mongodb: {
    uri: string;
  };
  zApi: {
    instanceId: string;
    token: string;
    clientToken?: string;
    baseUrl: string;
  };
  azList: {
    baseUrl: string;
    token: string;
    eventId: string;
  };
  qrCode: {
    signSecret?: string;
    width: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  logging: {
    level: string;
    file: string;
  };
}

export const config: EnvironmentConfig = {
  env: envVars.NODE_ENV as string,
  port: envVars.PORT as number,
  mongodb: {
    uri: envVars.MONGO_URI as string,
  },
  zApi: {
    instanceId: envVars.ZAPI_INSTANCE_ID as string,
    token: envVars.ZAPI_TOKEN as string,
    clientToken: envVars.ZAPI_CLIENT_TOKEN as string,
    baseUrl: `https://api.z-api.io/instances/${envVars.ZAPI_INSTANCE_ID as string}/token/${envVars.ZAPI_TOKEN as string}`,
  },
  azList: {
    baseUrl: envVars.AZLIST_BASE_URL as string,
    token: envVars.AZLIST_TOKEN as string,
    eventId: envVars.AZLIST_EVENT_ID as string,
  },
  qrCode: {
    signSecret: envVars.QR_SIGN_SECRET as string,
    width: envVars.QR_WIDTH as number,
  },
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS as number,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS as number,
  },
  logging: {
    level: envVars.LOG_LEVEL as string,
    file: envVars.LOG_FILE as string,
  },
};

