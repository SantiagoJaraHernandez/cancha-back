import { z } from 'zod';

export const createFieldSchema = z.object({
  name: z.string().min(3, 'Nombre muy corto'),
  type: z.enum(['SYNTHETIC', 'BEACH_VOLLEYBALL']),
  address: z.string().min(5, 'Dirección muy corta'),
  description: z.string().optional(),
  pricePerHour: z.number().int().positive('El precio debe ser positivo'),
  pricePerHourNight: z.number().int().positive().optional(),
  slotDurationMin: z.number().int().refine(v => [60, 90].includes(v), {
    message: 'La duración debe ser 60 o 90 minutos',
  }).default(60),
});

export const updateFieldSchema = createFieldSchema.partial();

export const scheduleSchema = z.object({
  schedules: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    openTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
    closeTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
    isOpen: z.boolean().default(true),
  })).length(7, 'Debes enviar los 7 días'),
});

export const blockSlotSchema = z.object({
  blockedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().optional(),
});

export type CreateFieldInput = z.infer<typeof createFieldSchema>;
export type UpdateFieldInput = z.infer<typeof updateFieldSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;