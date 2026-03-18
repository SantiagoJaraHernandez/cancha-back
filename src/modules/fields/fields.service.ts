import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { CreateFieldInput, UpdateFieldInput, ScheduleInput } from './fields.schema';
import { generateTimeSlots } from '../../utils/slots';

type BookingSelect = {
  startTime: string;
  expiresAt: Date | null;
  status: string;
};

type BlockedSelect = {
  startTime: string;
};

export async function createField(data: CreateFieldInput, ownerId: string) {
  return prisma.field.create({
    data: { ...data, ownerId },
  });
}

export async function getPublicFields(type?: string) {
  return prisma.field.findMany({
    where: {
      status: 'ACTIVE',
      ...(type ? { type: type as 'SYNTHETIC' | 'BEACH_VOLLEYBALL' } : {}),
    },
    include: {
      photos: { orderBy: { sortOrder: 'asc' }, take: 1 },
      schedules: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getFieldById(id: string) {
  const field = await prisma.field.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { sortOrder: 'asc' } },
      schedules: { orderBy: { dayOfWeek: 'asc' } },
      owner: { select: { id: true, fullName: true, phone: true } },
      reviews: {
        include: { user: { select: { fullName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
  if (!field) throw new AppError('Cancha no encontrada', 404);
  return field;
}

export async function updateField(id: string, ownerId: string, data: UpdateFieldInput) {
  const field = await prisma.field.findFirst({ where: { id, ownerId } });
  if (!field) throw new AppError('Cancha no encontrada o no tienes permiso', 404);
  return prisma.field.update({ where: { id }, data });
}

export async function deactivateField(id: string, ownerId: string) {
  const field = await prisma.field.findFirst({ where: { id, ownerId } });
  if (!field) throw new AppError('Cancha no encontrada o no tienes permiso', 404);
  return prisma.field.update({ where: { id }, data: { status: 'INACTIVE' } });
}

export async function saveSchedules(fieldId: string, ownerId: string, data: ScheduleInput) {
  const field = await prisma.field.findFirst({ where: { id: fieldId, ownerId } });
  if (!field) throw new AppError('Cancha no encontrada o no tienes permiso', 404);

  await Promise.all(
    data.schedules.map((s: ScheduleInput['schedules'][number]) =>
      prisma.fieldSchedule.upsert({
        where: { fieldId_dayOfWeek: { fieldId, dayOfWeek: s.dayOfWeek } },
        update: { openTime: s.openTime, closeTime: s.closeTime, isOpen: s.isOpen },
        create: { fieldId, ...s },
      })
    )
  );

  return prisma.fieldSchedule.findMany({
    where: { fieldId },
    orderBy: { dayOfWeek: 'asc' },
  });
}

export async function getFieldAvailability(fieldId: string, date: string) {
  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    include: { schedules: true },
  });
  if (!field) throw new AppError('Cancha no encontrada', 404);

  const dayOfWeek = new Date(date + 'T12:00:00').getDay();
  const schedule = field.schedules.find((s: { dayOfWeek: number; openTime: string; closeTime: string; isOpen: boolean }) => s.dayOfWeek === dayOfWeek);

  if (!schedule || !schedule.isOpen) {
    return { date, available: false, slots: [] };
  }

  const allSlots = generateTimeSlots(
    schedule.openTime,
    schedule.closeTime,
    field.slotDurationMin
  );

  const bookings = await prisma.booking.findMany({
    where: {
      fieldId,
      bookingDate: new Date(date + 'T00:00:00.000Z'),
      status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
    },
    select: { startTime: true, expiresAt: true, status: true },
  });

  const blocked = await prisma.blockedSlot.findMany({
    where: {
      fieldId,
      blockedDate: new Date(date + 'T00:00:00.000Z'),
    },
    select: { startTime: true },
  });

  const now = new Date();

  const bookedTimes = new Set<string>([
    ...bookings
      .filter((b: BookingSelect) =>
        b.status === 'CONFIRMED' ||
        (b.status === 'PENDING_PAYMENT' && b.expiresAt && b.expiresAt > now)
      )
      .map((b: BookingSelect) => b.startTime),
    ...blocked.map((b: BlockedSelect) => b.startTime),
  ]);

  const slots = allSlots.map(slot => ({
    start: slot.start,
    end: slot.end,
    available: !bookedTimes.has(slot.start),
  }));

  return { date, available: true, slots };
}

export async function blockSlot(
  fieldId: string,
  ownerId: string,
  data: { blockedDate: string; startTime: string; endTime: string; reason?: string }
) {
  const field = await prisma.field.findFirst({ where: { id: fieldId, ownerId } });
  if (!field) throw new AppError('Cancha no encontrada o no tienes permiso', 404);

  return prisma.blockedSlot.create({
    data: {
      fieldId,
      blockedDate: new Date(data.blockedDate + 'T00:00:00.000Z'),
      startTime: data.startTime,
      endTime: data.endTime,
      reason: data.reason,
    },
  });
}

export async function getOwnerFields(ownerId: string) {
  return prisma.field.findMany({
    where: { ownerId },
    include: {
      photos: { take: 1, orderBy: { sortOrder: 'asc' } },
      _count: { select: { bookings: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
