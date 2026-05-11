# Realtime Group Chat (Next.js + Socket.IO)

This project is a realtime chat application with:

- Next.js frontend (`src/app/page.tsx`)
- Socket.IO backend (`socket-server/server.js`)
- PostgreSQL database (Docker Compose)
- Prisma ORM schema (`socket-server/prisma/schema.prisma`)
- Dockerized socket server (`docker-compose.yml`)
- Predefined groups and subgroups users can join before chatting

## Prerequisites

- Node.js 20+
- npm
- Docker + Docker Compose (for socket server via container)

## Project Structure

- `src/app/page.tsx` - chat UI and Socket.IO client connection
- `socket-server/server.js` - Socket.IO server and room logic
- `socket-server/prisma.config.ts` - Prisma datasource configuration
- `socket-server/Dockerfile` - backend container image
- `docker-compose.yml` - local socket-server orchestration

## Run Locally

### 1) Install frontend dependencies

```bash
npm install
```

### 2) Start backend services (Docker)

```bash
docker compose up -d --build
```

This starts:

- PostgreSQL on `localhost:5432`
- Socket.IO server on `http://localhost:4000`

### 3) Start Next.js app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment

Frontend socket URL can be configured with:

```bash
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

If not set, it defaults to `http://localhost:4000`.

Socket server CORS origin is configured in `docker-compose.yml`:

- `ALLOWED_ORIGINS=http://localhost:3000`
- `DATABASE_URL=postgresql://chat:chat@postgres:5432/chat?schema=public`

## Database Models

Implemented models:

- `Room`: `id` (`group::subgroup`), `group`, `subgroup`, `createdAt`
- `User`: `id`, `name` (unique), `createdAt`
- `Message`: `id`, `roomId`, `userId`, `text`, `createdAt`

Behavior:

- On room join, server loads latest 50 messages from database
- On send, message is inserted into database and broadcast to room

## Predefined Chat Rooms

Users select a group and subgroup, then join and start chatting.

- Technology: Frontend, Backend, DevOps
- Gaming: RPG, FPS, Strategy
- Sports: Cricket, Football, Basketball

Room IDs use the format:

`Group::Subgroup` (example: `Gaming::RPG`)

## Useful Commands

```bash
# check container status
docker compose ps

# see backend logs
docker compose logs -f socket-server

# see postgres logs
docker compose logs -f postgres

# stop backend
docker compose down

# run lint
npm run lint
```

## Troubleshooting

- Browser cannot connect to `ws://localhost:4000`:
  - Ensure container is running: `docker compose ps`
  - Confirm port mapping shows `0.0.0.0:4000->4000/tcp`
  - Recreate backend: `docker compose up -d --build --force-recreate socket-server`
- CORS issues:
  - Update `ALLOWED_ORIGINS` in `docker-compose.yml` to match your frontend URL
- Database connection issues:
  - Check postgres health: `docker compose ps`
  - Recreate services: `docker compose up -d --build --force-recreate`
- Messages not sending:
  - Join a room first, then send messages
