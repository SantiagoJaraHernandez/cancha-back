import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/errorHandler';

export async function createReview(
  bookingId: string,
  userId: string,
  rating: number,
  comment?: string
) {
  // Verificar que la reserva existe, pertenece al usuario y está completada
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId, status: 'COMPLETED' },
  });
  if (!booking) {
    throw new AppError('Solo puedes valorar reservas completadas', 400);
  }

  // Verificar que no haya review previa
  const existing = await prisma.review.findUnique({ where: { bookingId } });
  if (existing) throw new AppError('Ya valoraste esta reserva', 409);

  if (rating < 1 || rating > 5) throw new AppError('La valoración debe ser entre 1 y 5', 400);

  return prisma.review.create({
    data: {
      bookingId,
      userId,
      fieldId: booking.fieldId,
      rating,
      comment,
    },
    include: {
      user: { select: { fullName: true, avatarUrl: true } },
      field: { select: { name: true } },
    },
  });
}

export async function getFieldReviews(fieldId: string) {
  const reviews = await prisma.review.findMany({
    where: { fieldId },
    include: {
      user: { select: { fullName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const avg =
    reviews.length > 0
      ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length
      : 0;

  return {
    average: Math.round(avg * 10) / 10,
    total: reviews.length,
    reviews,
  };
}

export async function replyToReview(reviewId: string, ownerId: string, reply: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { field: true },
  });
  if (!review) throw new AppError('Valoración no encontrada', 404);
  if (review.field.ownerId !== ownerId) throw new AppError('No tienes permiso', 403);
  if (review.ownerReply) throw new AppError('Ya respondiste esta valoración', 409);

  return prisma.review.update({
    where: { id: reviewId },
    data: { ownerReply: reply },
  });
}