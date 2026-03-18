import { z } from 'zod';

export const createBookingSchema = z.object({
  fieldId: z.string().uuid('fieldId inválido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  paymentMethod: z.enum(['ONLINE', 'ON_SITE']),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;