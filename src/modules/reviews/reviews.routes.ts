import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { createReview, getFieldReviews, replyToReview } from './reviews.service';

const createReviewSchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

const replySchema = z.object({
  reply: z.string().min(1, 'La respuesta no puede estar vacía'),
});

export async function reviewRoutes(app: FastifyInstance) {

  // POST /reviews — crear valoración
  app.post('/', {
    preHandler: [authenticate, authorize('PLAYER')],
  }, async (req, reply) => {
    const user = req.user as { id: string };
    const { bookingId, rating, comment } = createReviewSchema.parse(req.body);
    const review = await createReview(bookingId, user.id, rating, comment);
    reply.status(201).send({ review });
  });

  // GET /reviews/field/:fieldId — reviews de una cancha
  app.get('/field/:fieldId', async (req, reply) => {
    const { fieldId } = req.params as { fieldId: string };
    const result = await getFieldReviews(fieldId);
    reply.send(result);
  });

  // PATCH /reviews/:id/reply — dueño responde una review
  app.patch('/:id/reply', {
    preHandler: [authenticate, authorize('OWNER')],
  }, async (req, reply) => {
    const user = req.user as { id: string };
    const { id } = req.params as { id: string };
    const { reply: ownerReply } = replySchema.parse(req.body);
    const review = await replyToReview(id, user.id, ownerReply);
    reply.send({ review });
  });
}