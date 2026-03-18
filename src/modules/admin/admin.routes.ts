import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import {
  getPendingFields,
  approveField,
  rejectField,
  getAllUsers,
  suspendUser,
  getDashboardMetrics,
} from './admin.service';

const rejectSchema = z.object({
  reason: z.string().min(5, 'La razón debe tener al menos 5 caracteres'),
});

export async function adminRoutes(app: FastifyInstance) {

  // Todas las rutas admin requieren estar autenticado y ser ADMIN
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', authorize('ADMIN'));

  // GET /admin/fields/pending
  app.get('/fields/pending', async (req, reply) => {
    const fields = await getPendingFields();
    reply.send({ fields });
  });

  // PATCH /admin/fields/:id/approve
  app.patch('/fields/:id/approve', async (req, reply) => {
    const { id } = req.params as { id: string };
    const field = await approveField(id);
    reply.send({ field, message: 'Cancha aprobada correctamente' });
  });

  // PATCH /admin/fields/:id/reject
  app.patch('/fields/:id/reject', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { reason } = rejectSchema.parse(req.body);
    const field = await rejectField(id, reason);
    reply.send({ field, message: 'Cancha rechazada' });
  });

  // GET /admin/users
  app.get('/users', async (req, reply) => {
    const { search } = req.query as { search?: string };
    const users = await getAllUsers(search);
    reply.send({ users });
  });

  // PATCH /admin/users/:id/suspend
  app.patch('/users/:id/suspend', async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await suspendUser(id);
    reply.send({
      user,
      message: user.isActive ? 'Usuario reactivado' : 'Usuario suspendido',
    });
  });

  // GET /admin/metrics
  app.get('/metrics', async (req, reply) => {
    const metrics = await getDashboardMetrics();
    reply.send(metrics);
  });
}