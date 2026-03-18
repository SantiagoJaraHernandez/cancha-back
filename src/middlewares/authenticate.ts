import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../lib/jwt';

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Token requerido' });
    }
    const token = authHeader.split(' ')[1];
    req.user = verifyAccessToken(token);
  } catch {
    reply.status(401).send({ error: 'Token inválido o expirado' });
  }
}