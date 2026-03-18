import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/errorHandler';

export async function getPendingFields() {
  return prisma.field.findMany({
    where: { status: 'PENDING' },
    include: {
      owner: { select: { fullName: true, email: true, phone: true } },
      photos: { take: 1, orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function approveField(fieldId: string) {
  const field = await prisma.field.findUnique({ where: { id: fieldId } });
  if (!field) throw new AppError('Cancha no encontrada', 404);
  if (field.status !== 'PENDING') throw new AppError('La cancha no está pendiente de aprobación', 400);

  return prisma.field.update({
    where: { id: fieldId },
    data: { status: 'ACTIVE' },
    include: {
      owner: { select: { fullName: true, email: true } },
    },
  });
}

export async function rejectField(fieldId: string, reason: string) {
  const field = await prisma.field.findUnique({ where: { id: fieldId } });
  if (!field) throw new AppError('Cancha no encontrada', 404);
  if (field.status !== 'PENDING') throw new AppError('La cancha no está pendiente de aprobación', 400);

  // Dejamos la cancha en INACTIVE con la razón en descripción
  return prisma.field.update({
    where: { id: fieldId },
    data: {
      status: 'INACTIVE',
      description: `[RECHAZADA] ${reason}`,
    },
  });
}

export async function getAllUsers(search?: string) {
  return prisma.user.findMany({
    where: search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      isActive: true,
      emailVerified: true,
      createdAt: true,
      _count: { select: { bookings: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function suspendUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('Usuario no encontrado', 404);
  if (user.role === 'ADMIN') throw new AppError('No puedes suspender a un admin', 400);

  return prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
    select: {
      id: true,
      fullName: true,
      email: true,
      isActive: true,
    },
  });
}

export async function getDashboardMetrics() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    totalFields,
    activeFields,
    pendingFields,
    bookingsThisMonth,
    totalBookings,
    revenueThisMonth,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.field.count(),
    prisma.field.count({ where: { status: 'ACTIVE' } }),
    prisma.field.count({ where: { status: 'PENDING' } }),
    prisma.booking.count({
      where: { createdAt: { gte: startOfMonth } },
    }),
    prisma.booking.count(),
    prisma.booking.aggregate({
      where: {
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        createdAt: { gte: startOfMonth },
      },
      _sum: { totalPrice: true },
    }),
  ]);

  // Top 5 canchas más reservadas
  const topFields = await prisma.field.findMany({
    where: { status: 'ACTIVE' },
    include: {
      _count: { select: { bookings: true } },
      owner: { select: { fullName: true } },
    },
    orderBy: { bookings: { _count: 'desc' } },
    take: 5,
  });

  return {
    users: { total: totalUsers },
    fields: { total: totalFields, active: activeFields, pending: pendingFields },
    bookings: { thisMonth: bookingsThisMonth, total: totalBookings },
    revenue: { thisMonth: revenueThisMonth._sum.totalPrice ?? 0 },
    topFields: topFields.map((f: typeof topFields[number]) => ({
    id: f.id,
    name: f.name,
    owner: f.owner.fullName,
    totalBookings: f._count.bookings,
})),
  };
}