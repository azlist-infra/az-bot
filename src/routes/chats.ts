import { Router } from 'express';
import { ChatController } from '@/controllers/ChatController';

const router = Router();
const chatController = ChatController.getInstance();

/**
 * POST /api/chats/sync
 * Sincronizar chats da Z-API com o banco de dados
 */
router.post('/sync', chatController.syncChats.bind(chatController));

/**
 * GET /api/chats/stats
 * Obter estatísticas dos chats
 * NOTA: Esta rota deve vir antes de /:phone para evitar conflitos
 */
router.get('/stats', chatController.getChatStats.bind(chatController));

/**
 * GET /api/chats
 * Listar todos os chats
 */
router.get('/', chatController.getAllChats.bind(chatController));

/**
 * GET /api/chats/:phone
 * Buscar chat por telefone
 */
router.get('/:phone', chatController.getChatByPhone.bind(chatController));

/**
 * PATCH /api/chats/:phone/mark-sent
 * Marcar chat como tendo mensagem enviada
 */
router.patch('/:phone/mark-sent', chatController.markChatAsSent.bind(chatController));

export { router as chatRoutes };
