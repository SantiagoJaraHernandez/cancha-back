import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { createBookingSchema } from './bookings.schema';
import {
  createBooking,
  getMyBookings,
  getFieldBookings,
  cancelBooking,
  markNoShow,
  confirmCashPayment,
} from './bookings.service';

export async function bookingRoutes(app: FastifyInstance) {

  // POST /bookings — crear reserva
  app.post('/', {
    preHandler: [authenticate, authorize('PLAYER')],
  }, async (req, reply) => {
    const user = req.user as { id: string };
    const data = createBookingSchema.parse(req.body);
    const booking = await createBooking(data, user.id);
    reply.status(201).send({ booking });
  });

  // GET /bookings/mine — mis reservas
  app.get('/mine', {
    preHandler: [authenticate],
  }, async (req, reply) => {
    const user = req.user as { id: string };
    const { status } = req.query as { status?: string };
    const bookings = await getMyBookings(user.id, status);
    reply.send({ bookings });
  });

  // GET /bookings/field/:fieldId — reservas de una cancha (dueño)
  app.get('/field/:fieldId', {
    preHandler: [authenticate, authorize('OWNER')],
  }, async (req, reply) => {
    const user = req.user as { id: string };
    const { fieldId } = req.params as { fieldId: string };
    const bookings = await getFieldBookings(fieldId, user.id);
    reply.send({ bookings });
  });

  // DELETE /bookings/:id — cancelar reserva
  app.delete('/:id', {
    preHandler: [authenticate, authorize('PLAYER')],
  }, async (req, reply) => {
    const user = req.user as { id: string };
    const { id } = req.params as { id: string };
    const booking = await cancelBooking(id, user.id);
    reply.send({ booking, message: 'Reserva cancelada correctamente' });
  });

  // PATCH /bookings/:id/no-show — marcar no presentado
  app.patch('/:id/no-show', {
    preHandler: [authenticate, authorize('OWNER')],
  }, async (req, reply) => {
    const user = req.user as { id: string };
    const { id } = req.params as { id: string };
    const booking = await markNoShow(id, user.id);
    reply.send({ booking });
  });

  // PATCH /bookings/:id/confirm-cash — confirmar pago efectivo
  app.patch('/:id/confirm-cash', {
    preHandler: [authenticate, authorize('OWNER')],
  }, async (req, reply) => {
    const user = req.user as { id: string };
    const { id } = req.params as { id: string };
    const booking = await confirmCashPayment(id, user.id);
    reply.send({ booking, message: 'Pago confirmado correctamente' });
  });
}