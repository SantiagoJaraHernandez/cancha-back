import { FastifyRequest, FastifyReply } from 'fastify';

export function authorize(...roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user as { role: string };
    if (!roles.includes(user.role)) {
      reply.status(403).send({ error: 'No tienes permiso para esta acción' });
    }
  };
}