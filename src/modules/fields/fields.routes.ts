import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import {
  createFieldSchema,
  updateFieldSchema,
  scheduleSchema,
  blockSlotSchema,
} from './fields.schema';
import {
  createField,
  getPublicFields,
  getFieldById,
  updateField,
  deactivateField,
  saveSchedules,
  getFieldAvailability,
  blockSlot,
  getOwnerFields,
} from './fields.service';

export async function fieldRoutes(app: FastifyInstance) {

  // GET /fields — lista pública
  app.get('/', async (req, reply) => {
    const { type } = req.query as { type?: string };
    const fields = await getPublicFields(type);
    reply.send({ fields });
  });

  // GET /fields/mine — canchas del dueño autenticado
  app.get('/mine', {
    preHandler: [authenticate, authorize('OWNER')],
  }, async (req, reply) => {
    const user = req.user as { id: string };
    const fields = await getOwnerFields(user.id);
    reply.send({ fields });
  });

  // GET /fields/:id — detalle público
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const field = await getFieldById(id);
    reply.send({ field });
  });

  // GET /fields/:id/availability — disponibilidad por fecha
  app.get('/:id/availability', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { date } = req.query as { date: string };
    if (!date) return reply.status(400).send({ error: 'El parámetro date es requerido (YYYY-MM-DD)' });
    const availability = await getFieldAvailability(id, date);
    reply.send(availability);
  });

  // POST /fields — crear cancha (solo OWNER)
  app.post('/', {
    preHandler: [authenticate, authorize('OWNER')],
  }, async (req, reply) => {
    const user = req.user as { id: string };
    const data = createFieldSchema.parse(req.body);
    const field = await createField(data, user.id);
    reply.status(201).send({ field });
  });

  // PATCH /fields/:id — editar cancha
  app.patch('/:id', {
    preHandler: [authenticate, authorize('OWNER')],
  }, async (req, reply) => {
    const user = req.user as { id: string };
    const { id } = req.params as { id: string };
    const data = updateFieldSchema.parse(req.body);
    const field = await updateField(id, user.id, data);
    reply.send({ field });
  });

  // DELETE /fields/:id — desactivar cancha
  app.delete('/:id', {
    preHandler: [authenticate, authorize('OWNER')],
  }, async (req, reply) => {
    const user = req.user as { id: string };
    const { id } = req.params as { id: string };
    await deactivateField(id, user.id);
    reply.send({ message: 'Cancha desactivada correctamente' });
  });

  // POST /fields/:id/schedules — guardar horarios
  app.post('/:id/schedules', {
    preHandler: [authenticate, authorize('OWNER')],
  }, async (req, reply) => {
    const user = req.user as { id: string };
    const { id } = req.params as { id: string };
    const data = scheduleSchema.parse(req.body);
    const schedules = await saveSchedules(id, user.id, data);
    reply.send({ schedules });
  });

  // POST /fields/:id/block — bloquear slot
  app.post('/:id/block', {
    preHandler: [authenticate, authorize('OWNER')],
  }, async (req, reply) => {
    const user = req.user as { id: string };
    const { id } = req.params as { id: string };
    const data = blockSlotSchema.parse(req.body);
    const blocked = await blockSlot(id, user.id, data);
    reply.status(201).send({ blocked });
  });
}