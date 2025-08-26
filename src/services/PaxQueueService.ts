import { Pax, IPax } from '@/models/Pax';
import { Message } from '@/models/Message';
import { logger } from '@/utils/logger';

export interface QueueResult {
  success: boolean;
  pax?: IPax;
  message: string;
  queuePosition?: number;
  totalInQueue?: number;
  unavailableCount?: number; // 🎯 Contagem de unavailable na fila
}

export interface ImportResult {
  success: boolean;
  imported: number;
  errors: number;
  duplicates: number;
  message: string;
}

export interface PaxImportData {
  name: string;
  cpf: string;
  phoneNumber: string;
  email?: string;
}

export class PaxQueueService {
  private static instance: PaxQueueService;

  private constructor() {}

  public static getInstance(): PaxQueueService {
    if (!PaxQueueService.instance) {
      PaxQueueService.instance = new PaxQueueService();
    }
    return PaxQueueService.instance;
  }

  /**
   * 🎯 Buscar próximo PAX da fila que ainda não recebeu QR Code
   */
  public async getNextPaxInQueue(): Promise<QueueResult> {
    try {
      logger.info('Getting next pax in queue...');

      // 1️⃣ Buscar todos os telefones que JÁ receberam QR Code
      const phonesWithQRCode = await Message.distinct('from', {
        qrcodeMessage: true,
        direction: 'out',
        kind: 'image'
      });

      logger.info(`Found ${phonesWithQRCode.length} phones that already received QR Code`);

      // 2️⃣ Buscar próximo PAX que:
      // - sent: false (não foi marcado como enviado)
      // - telefone NÃO está na lista de quem já recebeu QR
      const nextPax = await Pax.findOne({
        sent: false,
        phoneNumber: { $nin: phonesWithQRCode } // Excluir quem já recebeu QR
      })
      .sort({ sequenceId: 1 }) // Ordem da fila (menor sequenceId primeiro)
      .lean();

      if (!nextPax) {
        // Verificar estatísticas da fila
        const totalPax = await Pax.countDocuments();
        const sentPax = await Pax.countDocuments({ sent: true });
        const withQRCode = phonesWithQRCode.length;

        return {
          success: false,
          message: `Queue is empty. Stats: ${totalPax} total, ${sentPax} marked as sent, ${withQRCode} received QR Code`,
        };
      }

      // 3️⃣ Calcular posição na fila
      const queuePosition = await Pax.countDocuments({
        sent: false,
        phoneNumber: { $nin: phonesWithQRCode },
        sequenceId: { $lte: nextPax.sequenceId }
      });

      const totalInQueue = await Pax.countDocuments({
        sent: false,
        phoneNumber: { $nin: phonesWithQRCode }
      });

      // 🎯 Contar quantos unavailable temos na fila
      const unavailableCount = await Pax.countDocuments({
        unavailable: true,
        sent: false,
        phoneNumber: { $nin: phonesWithQRCode }
      });

      logger.info(`Next pax in queue: ${nextPax.name} (${nextPax.phoneNumber}), position ${queuePosition}/${totalInQueue}, unavailable: ${unavailableCount}`);

      return {
        success: true,
        pax: nextPax as IPax,
        message: `Next pax found: ${nextPax.name}`,
        queuePosition,
        totalInQueue,
        unavailableCount, // 🎯 Retornar contagem de unavailable
      };

    } catch (error) {
      logger.error('Error getting next pax in queue:', error);
      return {
        success: false,
        message: 'Internal error getting next pax in queue',
      };
    }
  }

  /**
   * 🎯 Marcar PAX como indisponível e mover para fim da fila
   */
  public async markPaxAsUnavailable(paxId: string): Promise<{ success: boolean; message: string; pax?: IPax }> {
    try {
      logger.info(`Marking pax as unavailable and moving to end of queue: ${paxId}`);

      // 1️⃣ Buscar o PAX atual
      const currentPax = await Pax.findById(paxId);
      if (!currentPax) {
        return {
          success: false,
          message: 'Pax not found',
        };
      }

      // 2️⃣ Buscar o maior sequenceId atual para adicionar no final da fila
      const maxSequencePax = await Pax.findOne({}, { sequenceId: 1 })
        .sort({ sequenceId: -1 })
        .lean();

      const newSequenceId = (maxSequencePax?.sequenceId || 0) + 1;

      // 3️⃣ Atualizar PAX: marcar como unavailable e mover para fim da fila
      const updatedPax = await Pax.findByIdAndUpdate(
        paxId,
        { 
          unavailable: true,
          sequenceId: newSequenceId // 🎯 Mover para fim da fila
        },
        { new: true, runValidators: true }
      );

      if (!updatedPax) {
        return {
          success: false,
          message: 'Error updating pax',
        };
      }

      logger.info(`Pax marked as unavailable and moved to end: ${updatedPax.name} (${updatedPax.phoneNumber}) - new sequenceId: ${newSequenceId}`);

      return {
        success: true,
        message: `Pax ${updatedPax.name} marked as unavailable and moved to end of queue`,
        pax: updatedPax,
      };

    } catch (error) {
      logger.error(`Error marking pax as unavailable (${paxId}):`, error);
      return {
        success: false,
        message: 'Internal error marking pax as unavailable',
      };
    }
  }

  /**
   * 🎯 Marcar PAX como enviado
   */
  public async markPaxAsSent(paxId: string): Promise<{ success: boolean; message: string; pax?: IPax }> {
    try {
      logger.info(`Marking pax as sent: ${paxId}`);

      const updatedPax = await Pax.findByIdAndUpdate(
        paxId,
        { sent: true },
        { new: true, runValidators: true }
      );

      if (!updatedPax) {
        return {
          success: false,
          message: 'Pax not found',
        };
      }

      logger.info(`Pax marked as sent: ${updatedPax.name} (${updatedPax.phoneNumber})`);

      return {
        success: true,
        message: `Pax ${updatedPax.name} marked as sent`,
        pax: updatedPax,
      };

    } catch (error) {
      logger.error(`Error marking pax as sent (${paxId}):`, error);
      return {
        success: false,
        message: 'Internal error marking pax as sent',
      };
    }
  }

  /**
   * 🎯 Importar lista de PAX
   */
  public async importPaxList(paxList: PaxImportData[]): Promise<ImportResult> {
    try {
      logger.info(`Starting import of ${paxList.length} pax...`);

      let imported = 0;
      let errors = 0;
      let duplicates = 0;

      // Buscar o maior sequenceId atual para continuar a sequência
      const maxSequence = await Pax.findOne({}, { sequenceId: 1 })
        .sort({ sequenceId: -1 })
        .lean();

      let currentSequenceId = (maxSequence?.sequenceId || 0) + 1;

      for (const paxData of paxList) {
        try {
          // Verificar se CPF já existe
          const existingPax = await Pax.findOne({ cpf: paxData.cpf }).lean();

          if (existingPax) {
            logger.info(`Duplicate CPF found: ${paxData.cpf} (${paxData.name})`);
            duplicates++;
            continue;
          }

          // Criar novo PAX
          await Pax.create({
            name: paxData.name.trim(),
            cpf: paxData.cpf.trim(),
            phoneNumber: paxData.phoneNumber.trim(),
            email: paxData.email?.trim(),
            sent: false,
            sequenceId: currentSequenceId++,
          });

          imported++;

          // Log a cada 100 importados
          if (imported % 100 === 0) {
            logger.info(`Import progress: ${imported}/${paxList.length} pax imported`);
          }

        } catch (error) {
          logger.error(`Error importing pax ${paxData.name} (${paxData.cpf}):`, error);
          errors++;
        }
      }

      const message = `Import completed: ${imported} imported, ${duplicates} duplicates, ${errors} errors`;
      logger.info(message);

      return {
        success: true,
        imported,
        errors,
        duplicates,
        message,
      };

    } catch (error) {
      logger.error('Error during pax import:', error);
      return {
        success: false,
        imported: 0,
        errors: paxList.length,
        duplicates: 0,
        message: 'Critical error during import',
      };
    }
  }

  /**
   * 🎯 Obter estatísticas da fila
   */
  public async getQueueStats(): Promise<{
    total: number;
    sent: number;
    pending: number;
    withQRCode: number;
    nextInQueue: number;
    unavailable: number; // 🎯 Total de unavailable
  }> {
    try {
      const total = await Pax.countDocuments();
      const sent = await Pax.countDocuments({ sent: true });
      
      // Buscar quantos já receberam QR Code
      const phonesWithQRCode = await Message.distinct('from', {
        qrcodeMessage: true,
        direction: 'out',
        kind: 'image'
      });
      
      const withQRCode = phonesWithQRCode.length;

      // Próximos na fila (sent: false E não recebeu QR Code)
      const nextInQueue = await Pax.countDocuments({
        sent: false,
        phoneNumber: { $nin: phonesWithQRCode }
      });

      // 🎯 Total de unavailable
      const unavailable = await Pax.countDocuments({ unavailable: true });

      const pending = total - sent;

      return {
        total,
        sent,
        pending,
        withQRCode,
        nextInQueue,
        unavailable, // 🎯 Incluir contagem de unavailable
      };

    } catch (error) {
      logger.error('Error getting queue stats:', error);
      return {
        total: 0,
        sent: 0,
        pending: 0,
        withQRCode: 0,
        nextInQueue: 0,
        unavailable: 0, // 🎯 Incluir na resposta de erro também
      };
    }
  }
}
