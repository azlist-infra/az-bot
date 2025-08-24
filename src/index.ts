// Module alias setup for production
import 'module-alias/register';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from '@/config/environment';
import { DatabaseConnection } from '@/config/database';
import { logger } from '@/utils/logger';

// Routes
import apiRoutes from '@/routes';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Request compression
app.use(compression());

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'AZ-WhatsApp API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api', apiRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  
  res.status(500).json({
    success: false,
    message: config.env === 'production' ? 'Internal server error' : error.message,
    ...(config.env !== 'production' && { stack: error.stack }),
  });
});

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to database
    const database = DatabaseConnection.getInstance();
    await database.connect();

    // Start HTTP server
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.env} mode`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`Database connected: ${database.getConnectionStatus()}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  const database = DatabaseConnection.getInstance();
  await database.disconnect();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  const database = DatabaseConnection.getInstance();
  await database.disconnect();
  
  process.exit(0);
});

// Start the application
startServer().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

