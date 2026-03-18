import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/errorHandler';

export async function getPaymentByBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
  });
  if (!booking) throw new AppError('Reserva no encontrada', 404);

  const payment = await prisma.payment.findUnique({
    where: { bookingId },
  });

  return { booking, payment };
}

export async function getOwnerIncome(ownerId: string) {
  const now = new Date();

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const bookings = await prisma.booking.findMany({
    where: {
      field: { ownerId },
      status: { in: ['CONFIRMED', 'COMPLETED'] },
    },
    include: {
      payment: true,
      field: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  type BookingWithRelations = typeof bookings[number];

  const calcTotal = (from: Date) =>
    bookings
      .filter((b: BookingWithRelations) => new Date(b.createdAt) >= from)
      .reduce((sum: number, b: BookingWithRelations) => sum + b.totalPrice, 0);

  return {
    today: calcTotal(startOfDay),
    thisWeek: calcTotal(startOfWeek),
    thisMonth: calcTotal(startOfMonth),
    total: bookings.reduce((sum: number, b: BookingWithRelations) => sum + b.totalPrice, 0),
    transactions: bookings.map((b: BookingWithRelations) => ({
      id: b.id,
      field: b.field.name,
      date: b.bookingDate,
      startTime: b.startTime,
      amount: b.totalPrice,
      paymentMethod: b.paymentMethod,
      status: b.payment?.status ?? 'PENDING',
      createdAt: b.createdAt,
    })),
  };
}

export async function initiatePayment(bookingId: string, userId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: { field: true, user: true },
  });
  if (!booking) throw new AppError('Reserva no encontrada', 404);
  if (booking.status !== 'PENDING_PAYMENT') {
    throw new AppError('Esta reserva no requiere pago', 400);
  }
  if (booking.paymentMethod !== 'ONLINE') {
    throw new AppError('Esta reserva es de pago en cancha', 400);
  }

  // Crear registro de pago en la DB
  const payment = await prisma.payment.upsert({
    where: { bookingId },
    update: {},
    create: {
      bookingId,
      amount: booking.totalPrice,
      status: 'PENDING',
      gateway: 'wompi',
    },
  });

  // URL de pago de Wompi (sandbox para desarrollo)
  // En producción reemplazar con llamada real a la API de Wompi
  const wompiUrl = `https://checkout.wompi.co/p/?public-key=${process.env.WOMPI_PUBLIC_KEY ?? 'pub_test_demo'}&currency=COP&amount-in-cents=${booking.totalPrice * 100}&reference=${bookingId}&redirect-url=${process.env.FRONTEND_URL}/bookings/${bookingId}/confirm`;

  return {
    payment,
    paymentUrl: wompiUrl,
    amount: booking.totalPrice,
    reference: bookingId,
  };
}

export async function handleWompiWebhook(body: any) {
  // Validar que el evento es de una transacción
  if (body.event !== 'transaction.updated') return { received: true };

  const transaction = body?.data?.transaction;
  if (!transaction) return { received: true };

  const bookingId = transaction.reference;
  const status = transaction.status;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });
  if (!booking) return { received: true };

  if (status === 'APPROVED') {
    // Confirmar reserva y registrar pago
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CONFIRMED', expiresAt: null },
      }),
      prisma.payment.upsert({
        where: { bookingId },
        update: {
          status: 'PAID',
          gatewayRef: transaction.id,
          gatewayResponse: transaction,
          paidAt: new Date(),
        },
        create: {
          bookingId,
          amount: booking.totalPrice,
          status: 'PAID',
          gateway: 'wompi',
          gatewayRef: transaction.id,
          gatewayResponse: transaction,
          paidAt: new Date(),
        },
      }),
    ]);
  } else if (['DECLINED', 'ERROR', 'VOIDED'].includes(status)) {
    // Pago fallido — liberar slot
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED', expiresAt: null },
      }),
      prisma.payment.upsert({
        where: { bookingId },
        update: {
          status: 'FAILED',
          gatewayRef: transaction.id,
          gatewayResponse: transaction,
        },
        create: {
          bookingId,
          amount: booking.totalPrice,
          status: 'FAILED',
          gateway: 'wompi',
          gatewayRef: transaction.id,
          gatewayResponse: transaction,
        },
      }),
    ]);
  }

  return { received: true };
}