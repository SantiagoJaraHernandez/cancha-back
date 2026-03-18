import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import { AppError } from '../../middlewares/errorHandler';
import { CreateBookingInput } from './bookings.schema';
import { generateTimeSlots } from '../../utils/slots';

function calculateEndTime(startTime: string, durationMin: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const totalMin = h * 60 + m + durationMin;
  const endH = String(Math.floor(totalMin / 60)).padStart(2, '0');
  const endM = String(totalMin % 60).padStart(2, '0');
  return `${endH}:${endM}`;
}

function calculatePrice(pricePerHour: number, pricePerHourNight: number | null, startTime: string): number {
  const hour = parseInt(startTime.split(':')[0]);
  const isNight = hour >= 18;
  return isNight && pricePerHourNight ? pricePerHourNight : pricePerHour;
}

export async function createBooking(data: CreateBookingInput, userId: string) {
  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {

    // 1. Verificar que la cancha existe y está activa
    const field = await tx.field.findFirst({
      where: { id: data.fieldId, status: 'ACTIVE' },
    });
    if (!field) throw new AppError('Cancha no encontrada o no disponible', 404);

    // 2. Verificar conflicto de slot
    const now = new Date();
    const conflict = await tx.booking.findFirst({
      where: {
        fieldId: data.fieldId,
        bookingDate: new Date(data.date + 'T00:00:00.000Z'),
        startTime: data.startTime,
        OR: [
          { status: 'CONFIRMED' },
          {
            status: 'PENDING_PAYMENT',
            expiresAt: { gt: now },
          },
        ],
      },
    });
    if (conflict) throw new AppError('Este slot ya no está disponible', 409);

    // 3. Verificar que no esté bloqueado por el dueño
    const blocked = await tx.blockedSlot.findFirst({
      where: {
        fieldId: data.fieldId,
        blockedDate: new Date(data.date + 'T00:00:00.000Z'),
        startTime: data.startTime,
      },
    });
    if (blocked) throw new AppError('Este slot está bloqueado por el dueño', 409);

    // 4. Verificar que el slot existe en el horario de la cancha
    const dayOfWeek = new Date(data.date + 'T12:00:00').getDay();
    const schedule = await tx.fieldSchedule.findUnique({
      where: { fieldId_dayOfWeek: { fieldId: data.fieldId, dayOfWeek } },
    });
    if (!schedule || !schedule.isOpen) {
      throw new AppError('La cancha no está disponible ese día', 400);
    }
    const validSlots = generateTimeSlots(schedule.openTime, schedule.closeTime, field.slotDurationMin);
    const slotExists = validSlots.some(s => s.start === data.startTime);
    if (!slotExists) throw new AppError('El horario seleccionado no es válido', 400);

    // 5. Crear la reserva con expiración de 10 minutos
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const endTime = calculateEndTime(data.startTime, field.slotDurationMin);
    const totalPrice = calculatePrice(field.pricePerHour, field.pricePerHourNight, data.startTime);

    const booking = await tx.booking.create({
      data: {
        fieldId: data.fieldId,
        userId,
        bookingDate: new Date(data.date + 'T00:00:00.000Z'),
        startTime: data.startTime,
        endTime,
        totalPrice,
        status: 'PENDING_PAYMENT',
        paymentMethod: data.paymentMethod,
        expiresAt,
      },
      include: {
        field: { select: { name: true, address: true } },
        user: { select: { fullName: true, email: true } },
      },
    });

    return booking;
  });
}

export async function getMyBookings(userId: string, status?: string) {
  return prisma.booking.findMany({
    where: {
      userId,
      ...(status ? { status: status as any } : {}),
    },
    include: {
      field: {
        select: {
          name: true,
          address: true,
          type: true,
          photos: { take: 1, orderBy: { sortOrder: 'asc' } },
        },
      },
    },
    orderBy: { bookingDate: 'desc' },
  });
}

export async function getFieldBookings(fieldId: string, ownerId: string) {
  // Verificar que la cancha pertenece al dueño
  const field = await prisma.field.findFirst({ where: { id: fieldId, ownerId } });
  if (!field) throw new AppError('Cancha no encontrada o no tienes permiso', 404);

  return prisma.booking.findMany({
    where: { fieldId },
    include: {
      user: { select: { fullName: true, email: true, phone: true } },
    },
    orderBy: [{ bookingDate: 'desc' }, { startTime: 'asc' }],
  });
}

export async function cancelBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
  });
  if (!booking) throw new AppError('Reserva no encontrada', 404);
  if (!['PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status)) {
    throw new AppError('Esta reserva no se puede cancelar', 400);
  }

  // Verificar que faltan más de 2 horas
  const bookingDateTime = new Date(
    booking.bookingDate.toISOString().split('T')[0] + 'T' + booking.startTime + ':00'
  );
  const twoHoursBefore = new Date(bookingDateTime.getTime() - 2 * 60 * 60 * 1000);
  if (new Date() > twoHoursBefore) {
    throw new AppError('No puedes cancelar con menos de 2 horas de anticipación', 400);
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'CANCELLED', expiresAt: null },
  });
}

export async function markNoShow(bookingId: string, ownerId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId },
    include: { field: true },
  });
  if (!booking) throw new AppError('Reserva no encontrada', 404);
  if (booking.field.ownerId !== ownerId) throw new AppError('No tienes permiso', 403);
  if (booking.status !== 'CONFIRMED') throw new AppError('Solo se pueden marcar reservas confirmadas', 400);

  return prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'NO_SHOW' },
  });
}

export async function confirmCashPayment(bookingId: string, ownerId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId },
    include: { field: true },
  });
  if (!booking) throw new AppError('Reserva no encontrada', 404);
  if (booking.field.ownerId !== ownerId) throw new AppError('No tienes permiso', 403);
  if (booking.paymentMethod !== 'ON_SITE') throw new AppError('Esta reserva no es de pago en cancha', 400);
  if (booking.status !== 'PENDING_PAYMENT') throw new AppError('Esta reserva ya fue procesada', 400);

  return prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'CONFIRMED', expiresAt: null },
  });
}