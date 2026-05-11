import { createServer } from "node:http";
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

const rooms = new Map();

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

io.on("connection", (socket) => {
  socket.emit("groups:list", PREDEFINED_GROUPS);

  socket.on("room:join", ({ user, group, subgroup }) => {
    if (!isValidRoom(group, subgroup)) {
      socket.emit("room:error", "Invalid group/subgroup.");
      return;
    }

    const room = `${group}::${subgroup}`;
    const previousRoom = socket.data.room;

    if (previousRoom) {
      socket.leave(previousRoom);
    }

    socket.data.username = user || "Anonymous";
    socket.data.room = room;
    socket.join(room);

    if (!rooms.has(room)) {
      rooms.set(room, []);
    }

    socket.emit("room:history", rooms.get(room));
  });

  socket.on("chat:send", ({ user, text, room }) => {
    const sender = user || socket.data.username || "Anonymous";

    if (!room || socket.data.room !== room || !text?.trim()) {
      return;
    }

    const message = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      user: sender,
      text: text.trim(),
      room,
      createdAt: new Date().toISOString(),
    };

    const roomHistory = rooms.get(room) ?? [];
    roomHistory.push(message);
    rooms.set(room, roomHistory.slice(-200));

    io.to(room).emit("chat:message", message);
  });
});

httpServer.listen(port, () => {
  console.log(`Socket.IO chat server running on port ${port}`);
});
