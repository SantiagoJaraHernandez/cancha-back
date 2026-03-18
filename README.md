# Cancha Back — API REST

Backend del SaaS de reservas de canchas sintéticas y vóley playa en Neiva, Huila.

## Stack
- Node.js 20 + TypeScript + Fastify
- PostgreSQL 16 + Prisma ORM
- JWT para autenticación

## Requisitos
- Node.js 20+
- Docker y Docker Compose (para la base de datos)

## Opción A — Con Docker (recomendado, sin instalar PostgreSQL)

1. Clona el repo
2. Copia el archivo de variables de entorno
   cp .env.example .env
3. Edita el .env con tus valores (mínimo los JWT secrets)
4. Levanta todo
   docker-compose up -d
5. La API queda en http://localhost:3001

## Opción B — Solo la base de datos en Docker

1. Clona el repo
2. Copia y edita el .env
   cp .env.example .env
3. Levanta solo PostgreSQL
   docker-compose up -d db
4. Instala dependencias
   npm install
5. Corre migraciones
   npx dotenv -e .env -- prisma migrate deploy
6. Arranca el servidor
   npm run dev
7. La API queda en http://localhost:3001

## Colección Postman
Importa el archivo cancha-back.postman_collection.json para probar todos los endpoints.

## Endpoints principales
- POST /auth/register
- POST /auth/login
- GET  /fields
- GET  /fields/:id/availability?date=YYYY-MM-DD
- POST /bookings
- POST /payments/initiate