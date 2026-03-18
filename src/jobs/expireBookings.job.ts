import cron from 'node-cron';
import { prisma } from '../lib/prisma';

export function startExpireBookingsJob() {
  cron.schedule('* * * * *', async () => {
    const expired = await prisma.booking.updateMany({
      where: {
        status: 'PENDING_PAYMENT',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'CANCELLED', expiresAt: null },
    });
    if (expired.count > 0) {
      console.log(`[cron] ${expired.count} reservas expiradas liberadas`);
    }
  });
}