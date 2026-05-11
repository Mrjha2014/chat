"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { io, Socket } from "socket.io-client";

type ChatMessage = {
  id: string;
  user: string;
  text: string;
  room: string;
  createdAt: string;
};

type GroupConfig = Record<string, string[]>;

const GROUPS: GroupConfig = {
  Technology: ["Frontend", "Backend", "DevOps"],
  Gaming: ["RPG", "FPS", "Strategy"],
  Sports: ["Cricket", "Football", "Basketball"],
};

const socketUrl =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

let socketInstance: Socket | null = null;
const emptySubscribe = () => () => {};

function getSocket() {
  if (!socketInstance) {
    socketInstance = io(socketUrl, {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }

  return socketInstance;
}

export default function Home() {
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState(Object.keys(GROUPS)[0]);
  const [subgroup, setSubgroup] = useState(GROUPS[Object.keys(GROUPS)[0]][0]);
  const [joinedRoom, setJoinedRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  const roomId = useMemo(() => `${group}::${subgroup}`, [group, subgroup]);

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleRoomHistory = (history: ChatMessage[]) => setMessages(history);
    const handleNewMessage = (message: ChatMessage) =>
      setMessages((prev) => [...prev, message]);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("room:history", handleRoomHistory);
    socket.on("chat:message", handleNewMessage);

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("room:history", handleRoomHistory);
      socket.off("chat:message", handleNewMessage);
    };
  }, []);

  const onGroupChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextGroup = event.target.value;
    setGroup(nextGroup);
    setSubgroup(GROUPS[nextGroup][0]);
  };

  const joinRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const username = name.trim() || "Anonymous";
    const socket = getSocket();

    socket.emit("room:join", {
      user: username,
      group,
      subgroup,
    });

    setName(username);
    setJoinedRoom(roomId);
    setMessages([]);
  };

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!draft.trim() || !joinedRoom) {
      return;
    }

    const socket = getSocket();

    socket.emit("chat:send", {
      user: name,
      text: draft.trim(),
      room: joinedRoom,
    });

    setDraft("");
  };

  if (!isMounted) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Realtime Group Chat</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Loading chat...
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Realtime Group Chat</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Socket status: {isConnected ? "Connected" : "Connecting..."}
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <form className="grid gap-3 md:grid-cols-4" onSubmit={joinRoom}>
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            placeholder="Your name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            value={group}
            onChange={onGroupChange}
          >
            {Object.keys(GROUPS).map((groupName) => (
              <option key={groupName} value={groupName}>
                {groupName}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            value={subgroup}
            onChange={(event) => setSubgroup(event.target.value)}
          >
            {GROUPS[group].map((subgroupName) => (
              <option key={subgroupName} value={subgroupName}>
                {subgroupName}
              </option>
            ))}
          </select>
          <button
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
            type="submit"
          >
            Join Room
          </button>
        </form>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          {joinedRoom
            ? `Active room: ${joinedRoom}`
            : "Active room: None (pick a group and subgroup first)"}
        </p>
      </section>

      <section className="flex min-h-[420px] flex-col rounded-xl border border-zinc-200 dark:border-zinc-700">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No messages yet. Join a room and start chatting.
            </p>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <p className="text-sm font-medium">
                  {message.user} · {message.room}
                </p>
                <p className="mt-1 text-sm">{message.text}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {new Date(message.createdAt).toLocaleTimeString()}
                </p>
              </article>
            ))
          )}
        </div>

        <form
          className="flex gap-2 border-t border-zinc-200 p-4 dark:border-zinc-700"
          onSubmit={sendMessage}
        >
          <input
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            placeholder="Type your message..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={!joinedRoom}
          >
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
