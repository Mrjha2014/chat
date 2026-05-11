import { createServer } from "node:http";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { Server } from "socket.io";

const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim());

const PREDEFINED_GROUPS = {
  Technology: ["Frontend", "Backend", "DevOps"],
  Gaming: ["RPG", "FPS", "Strategy"],
  Sports: ["Cricket", "Football", "Basketball"],
};
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const roomHistoryLimit = 50;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

function isValidRoom(group, subgroup) {
  return PREDEFINED_GROUPS[group]?.includes(subgroup) ?? false;
}

async function waitForDatabase(maxRetries = 20) {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
    }
  }
}

io.on("connection", (socket) => {
  socket.emit("groups:list", PREDEFINED_GROUPS);

  socket.on("room:join", async ({ user, group, subgroup }) => {
    try {
      if (!isValidRoom(group, subgroup)) {
        socket.emit("room:error", "Invalid group/subgroup.");
        return;
      }

      const room = `${group}::${subgroup}`;
      const username = user?.trim() || "Anonymous";
      const previousRoom = socket.data.room;

      if (previousRoom) {
        socket.leave(previousRoom);
      }

      await prisma.room.upsert({
        where: { id: room },
        update: {
          group,
          subgroup,
        },
        create: {
          id: room,
          group,
          subgroup,
        },
      });

      await prisma.user.upsert({
        where: { name: username },
        update: {},
        create: { name: username },
      });

      const history = await prisma.message.findMany({
        where: { roomId: room },
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: roomHistoryLimit,
      });

      socket.data.username = username;
      socket.data.room = room;
      socket.join(room);

      socket.emit(
        "room:history",
        history.reverse().map((message) => ({
          id: message.id,
          user: message.user.name,
          text: message.text,
          room: message.roomId,
          createdAt: message.createdAt.toISOString(),
        })),
      );
    } catch (error) {
      console.error("room:join failed", error);
      socket.emit("room:error", "Could not join room. Please try again.");
    }
  });

  socket.on("chat:send", async ({ user, text, room }) => {
    try {
      const sender = user?.trim() || socket.data.username || "Anonymous";
      const trimmedText = text?.trim();

      if (!room || socket.data.room !== room || !trimmedText) {
        return;
      }

      await prisma.room.upsert({
        where: { id: room },
        update: {},
        create: {
          id: room,
          group: room.split("::")[0] ?? "Unknown",
          subgroup: room.split("::")[1] ?? "General",
        },
      });

      const dbUser = await prisma.user.upsert({
        where: { name: sender },
        update: {},
        create: { name: sender },
      });

      const created = await prisma.message.create({
        data: {
          text: trimmedText,
          roomId: room,
          userId: dbUser.id,
        },
      });

      io.to(room).emit("chat:message", {
        id: created.id,
        user: sender,
        text: created.text,
        room,
        createdAt: created.createdAt.toISOString(),
      });
    } catch (error) {
      console.error("chat:send failed", error);
      socket.emit("room:error", "Could not send message. Please try again.");
    }
  });
});

waitForDatabase()
  .then(() => {
    httpServer.listen(port, () => {
      console.log(`Socket.IO chat server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server. Database is not reachable.", error);
    process.exit(1);
  });
