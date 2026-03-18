import { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema, refreshSchema } from './auth.schema';
import { registerUser, loginUser, getUserById } from './auth.service';
import { authenticate } from '../../middlewares/authenticate';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../lib/jwt';

export async function authRoutes(app: FastifyInstance) {

  // POST /auth/register
  app.post('/register', async (req, reply) => {
    const data = registerSchema.parse(req.body);
    const user = await registerUser(data);

    const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken(user.id);

    reply.status(201).send({ user, accessToken, refreshToken });
  });

  // POST /auth/login
  app.post('/login', async (req, reply) => {
    const data = loginSchema.parse(req.body);
    const user = await loginUser(data);

    const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken(user.id);

    reply.send({ user, accessToken, refreshToken });
  });

  // POST /auth/refresh
  app.post('/refresh', async (req, reply) => {
    const { refreshToken } = refreshSchema.parse(req.body);

    try {
      const payload = verifyRefreshToken(refreshToken);
      const user = await getUserById(payload.id);

      const newAccessToken = signAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      reply.send({ accessToken: newAccessToken });
    } catch {
      reply.status(401).send({ error: 'Refresh token inválido o expirado' });
    }
  });

  // GET /auth/me
  app.get('/me', { preHandler: authenticate }, async (req, reply) => {
    const payload = req.user as { id: string };
    const user = await getUserById(payload.id);
    reply.send({ user });
  });
}