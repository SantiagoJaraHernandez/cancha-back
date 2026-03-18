import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { RegisterInput, LoginInput } from './auth.schema';

export async function registerUser(data: RegisterInput) {
  // Verificar que el email no exista
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError('El email ya está registrado', 409);

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      phone: data.phone,
      role: data.role,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
    },
  });

  return user;
}

export async function loginUser(data: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !user.passwordHash) throw new AppError('Credenciales inválidas', 401);
  if (!user.isActive) throw new AppError('Cuenta suspendida', 403);

  const validPassword = await bcrypt.compare(data.password, user.passwordHash);
  if (!validPassword) throw new AppError('Credenciales inválidas', 401);

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      avatarUrl: true,
      role: true,
      emailVerified: true,
      createdAt: true,
    },
  });
  if (!user) throw new AppError('Usuario no encontrado', 404);
  return user;
}