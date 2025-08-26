import { Router } from 'express';
import { PaxQueueController } from '@/controllers/PaxQueueController';

const router = Router();
const paxQueueController = PaxQueueController.getInstance();

/**
 * GET /api/pax/queue-pax
 * 🎯 Retornar próximo PAX da fila que ainda não recebeu QR Code
 */
router.get('/queue-pax', paxQueueController.getNextPax.bind(paxQueueController));

/**
 * PATCH /api/pax/update-unavailable/:id
 * 🎯 Marcar PAX como indisponível e mover para fim da fila
 */
router.patch('/update-unavailable/:id', paxQueueController.updatePaxAsUnavailable.bind(paxQueueController));

/**
 * PATCH /api/pax/update-sent/:id
 * 🎯 Marcar PAX como enviado (sent: true)
 */
router.patch('/update-sent/:id', paxQueueController.updatePaxAsSent.bind(paxQueueController));

/**
 * POST /api/pax/import
 * 🎯 Importar lista de PAX
 * Body: { paxList: [{ name, cpf, phoneNumber, email? }] }
 */
router.post('/import', paxQueueController.importPaxList.bind(paxQueueController));

/**
 * GET /api/pax/queue-stats
 * 🎯 Obter estatísticas da fila
 */
router.get('/queue-stats', paxQueueController.getQueueStats.bind(paxQueueController));

export const paxRoutes = router;
