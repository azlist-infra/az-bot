import { Request, Response } from 'express';
import { PaxQueueService } from '@/services/PaxQueueService';
import { logger } from '@/utils/logger';

export class PaxQueueController {
  private static instance: PaxQueueController;
  private paxQueueService: PaxQueueService;

  private constructor() {
    this.paxQueueService = PaxQueueService.getInstance();
  }

  public static getInstance(): PaxQueueController {
    if (!PaxQueueController.instance) {
      PaxQueueController.instance = new PaxQueueController();
    }
    return PaxQueueController.instance;
  }

  /**
   * 🎯 GET /api/pax/queue-pax
   * Retornar próximo PAX da fila
   */
  public async getNextPax(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Get next pax in queue requested');

      const result = await this.paxQueueService.getNextPaxInQueue();

      if (result.success && result.pax) {
        res.status(200).json({
          success: true,
          message: result.message,
                      data: {
              pax: {
                id: result.pax._id,
                name: result.pax.name,
                cpf: result.pax.cpf,
                phoneNumber: result.pax.phoneNumber,
                email: result.pax.email,
                unavailable: result.pax.unavailable, // 🎯 Incluir campo unavailable
                sequenceId: result.pax.sequenceId,
                createdAt: result.pax.createdAt,
              },
              queueInfo: {
                position: result.queuePosition,
                totalInQueue: result.totalInQueue,
                unavailableCount: result.unavailableCount, // 🎯 Incluir contagem de unavailable
              },
            },
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.message,
        });
      }

    } catch (error) {
      logger.error('Error in get next pax endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error getting next pax',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 🎯 PATCH /api/pax/update-unavailable/:id
   * Marcar PAX como indisponível e mover para fim da fila
   */
  public async updatePaxAsUnavailable(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Pax ID is required',
        });
        return;
      }

      logger.info(`Update pax as unavailable requested for ID: ${id}`);

      const result = await this.paxQueueService.markPaxAsUnavailable(id);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          data: {
            id: result.pax?._id,
            name: result.pax?.name,
            phoneNumber: result.pax?.phoneNumber,
            unavailable: result.pax?.unavailable,
            sequenceId: result.pax?.sequenceId,
          },
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.message,
        });
      }

    } catch (error) {
      logger.error(`Error in update pax as unavailable endpoint for ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Internal server error updating pax as unavailable',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 🎯 PATCH /api/pax/update-sent/:id
   * Marcar PAX como enviado
   */
  public async updatePaxAsSent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Pax ID is required',
        });
        return;
      }

      logger.info(`Update pax as sent requested for ID: ${id}`);

      const result = await this.paxQueueService.markPaxAsSent(id);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          data: {
            id: result.pax?._id,
            name: result.pax?.name,
            phoneNumber: result.pax?.phoneNumber,
            sent: result.pax?.sent,
          },
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.message,
        });
      }

    } catch (error) {
      logger.error(`Error in update pax as sent endpoint for ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Internal server error updating pax as sent',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 🎯 POST /api/pax/import
   * Importar lista de PAX
   */
  public async importPaxList(req: Request, res: Response): Promise<void> {
    try {
      const { paxList } = req.body;

      if (!paxList || !Array.isArray(paxList) || paxList.length === 0) {
        res.status(400).json({
          success: false,
          message: 'paxList is required and must be a non-empty array',
          example: {
            paxList: [
              {
                name: "João Silva",
                cpf: "12345678901",
                phoneNumber: "5511999999999",
                email: "joao@example.com"
              }
            ]
          }
        });
        return;
      }

      // Validar estrutura básica de cada PAX
      for (let i = 0; i < paxList.length; i++) {
        const pax = paxList[i];
        if (!pax.name || !pax.cpf || !pax.phoneNumber) {
          res.status(400).json({
            success: false,
            message: `Invalid pax at index ${i}: name, cpf, and phoneNumber are required`,
            invalidPax: pax,
          });
          return;
        }
      }

      logger.info(`Import pax list requested: ${paxList.length} pax`);

      const result = await this.paxQueueService.importPaxList(paxList);

      res.status(200).json({
        success: result.success,
        message: result.message,
        data: {
          imported: result.imported,
          duplicates: result.duplicates,
          errors: result.errors,
          total: paxList.length,
        },
      });

    } catch (error) {
      logger.error('Error in import pax list endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during pax import',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 🎯 GET /api/pax/queue-stats
   * Obter estatísticas da fila
   */
  public async getQueueStats(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Get queue stats requested');

      const stats = await this.paxQueueService.getQueueStats();

      res.status(200).json({
        success: true,
        message: 'Queue statistics retrieved',
        data: stats,
      });

    } catch (error) {
      logger.error('Error in get queue stats endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error retrieving queue stats',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
