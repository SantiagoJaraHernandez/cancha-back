import { FastifyRequest, FastifyReply } from 'fastify';

export class AppError extends Error {
  constructor(public message: string, public statusCode: number = 400) {
    super(message);
  }
}

export function errorHandler(
  error: any,
  req: FastifyRequest,
  reply: FastifyReply
) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ error: error.message });
  }

  if (error.validation) {
    return reply.status(400).send({ error: 'Datos inválidos', details: error.validation });
  }

  console.error(error);
  reply.status(500).send({ error: 'Error interno del servidor' });
}