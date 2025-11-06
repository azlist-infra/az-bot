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
  
  // Zapster Configuration
  ZAPSTER_BASE_URL: joi.string().uri().default('https://api.zapsterapi.com/v1'),
  ZAPSTER_TOKEN: joi.string().when('USE_ZAPSTER', {
    is: joi.boolean().truthy(),
    then: joi.required(),
    otherwise: joi.optional()
  }),
  ZAPSTER_INSTANCE_ID: joi.string().when('USE_ZAPSTER', {
    is: joi.boolean().truthy(),
    then: joi.required(),
    otherwise: joi.optional()
  }),
  USE_ZAPSTER: joi.boolean().default(false),
  
  // AZ List Configuration
  AZLIST_BASE_URL: joi.string().uri().required(),
  AZLIST_TOKEN: joi.string().required(),
  AZLIST_EVENT_ID: joi.string().required(),
  
  // Bot Flow Configuration
  BOT_FLOW_TYPE: joi.string().valid('cpf', 'email').default('cpf'),
  
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
  
  // CORS
  CORS_ORIGIN: joi.string().default('*'),
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
  zapster: {
    baseUrl: string;
    token?: string;
    instanceId?: string;
    enabled: boolean;
  };
  azList: {
    baseUrl: string;
    token: string;
    eventId: string;
  };
  bot: {
    flowType: 'cpf' | 'email';
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
  cors: {
    origin: string;
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
  zapster: {
    baseUrl: envVars.ZAPSTER_BASE_URL as string,
    token: envVars.ZAPSTER_TOKEN as string,
    instanceId: envVars.ZAPSTER_INSTANCE_ID as string,
    enabled: envVars.USE_ZAPSTER as boolean,
  },
  azList: {
    baseUrl: envVars.AZLIST_BASE_URL as string,
    token: envVars.AZLIST_TOKEN as string,
    eventId: envVars.AZLIST_EVENT_ID as string,
  },
  bot: {
    flowType: envVars.BOT_FLOW_TYPE as 'cpf' | 'email',
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
  cors: {
    origin: envVars.CORS_ORIGIN as string,
  },
};

