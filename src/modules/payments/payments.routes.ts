import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import {
  initiatePayment,
  getPaymentByBooking,
  getOwnerIncome,
  handleWompiWebhook,
} from './payments.service';

export async function paymentRoutes(app: FastifyInstance) {

  // POST /payments/initiate — iniciar pago online
  app.post('/initiate', {
    preHandler: [authenticate, authorize('PLAYER')],
  }, async (req, reply) => {
    const user = req.user as { id: string };
    const { bookingId } = req.body as { bookingId: string };
    if (!bookingId) return reply.status(400).send({ error: 'bookingId requerido' });
    const result = await initiatePayment(bookingId, user.id);
    reply.send(result);
  });

  // POST /payments/webhook — Wompi nos avisa del resultado
  app.post('/webhook', async (req, reply) => {
    const result = await handleWompiWebhook(req.body);
    reply.send(result);
  });

  // GET /payments/booking/:id — estado de pago
  app.get('/booking/:id', {
    preHandler: [authenticate],
  }, async (req, reply) => {
    const user = req.user as { id: string };
    const { id } = req.params as { id: string };
    const result = await getPaymentByBooking(id, user.id);
    reply.send(result);
  });

  // GET /payments/income — ingresos del dueño
  app.get('/income', {
    preHandler: [authenticate, authorize('OWNER')],
  }, async (req, reply) => {
    const user = req.user as { id: string };
    const income = await getOwnerIncome(user.id);
    reply.send(income);
  });
}