import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { authRoutes } from './modules/auth/auth.routes';
import { fieldRoutes } from './modules/fields/fields.routes';
import { bookingRoutes } from './modules/bookings/bookings.routes';
import { startExpireBookingsJob } from './jobs/expireBookings.job';
import { paymentRoutes } from './modules/payments/payments.routes';
import { reviewRoutes } from './modules/reviews/reviews.routes';
import { adminRoutes } from './modules/admin/admin.routes';

const server = Fastify({ logger: true });

// Plugins
server.register(cors, {
  origin: env.FRONTEND_URL,
  credentials: true,
});

server.register(jwt, {
  secret: env.JWT_SECRET,
});

// Error handler global
server.setErrorHandler(errorHandler);

// Rutas
server.register(authRoutes, { prefix: '/auth' });
server.register(fieldRoutes, { prefix: '/fields' });
server.register(bookingRoutes, { prefix: '/bookings' });
server.register(paymentRoutes, { prefix: '/payments' });
server.register(reviewRoutes, { prefix: '/reviews' });
server.register(adminRoutes, { prefix: '/admin' });

// Health check
server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

const start = async () => {
  try {
    await server.listen({ port: Number(env.PORT), host: '0.0.0.0' });
    console.log(`🚀 Servidor corriendo en http://localhost:${env.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

startExpireBookingsJob();
start();