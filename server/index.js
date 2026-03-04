const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const boardRoutes = require("./routes/boards");
const Board = require("./models/Board");

const app = express();
const server = http.createServer(app);

// ─── Socket.IO Setup ──────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    // origin: process.env.CLIENT_URL || "http://localhost:5173",
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ─── Middleware ───────────────────────────────────────────────────────────────
// app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(
  cors({
    origin: "*",
  }),
);
app.use(express.json({ limit: "50mb" })); // large images as base64 can be big // larger limit for image uploads

// ─── REST Routes ──────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/boards", boardRoutes);

app.get("/", (req, res) => res.send("IntelliBoard API running"));

// ─── MongoDB Connection ───────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ─── Socket.IO Real-Time Logic ────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // User joins a board room
  socket.on("join-room", async ({ roomId, userId }) => {
    socket.join(roomId);
    console.log(`👤 User ${userId} joined room ${roomId}`);

    // Load current board state from DB and send to the joining user
    try {
      const board = await Board.findOne({ roomId });
      if (board) {
        socket.emit("load-board", board.boardState);
      }
    } catch (err) {
      console.error("Error loading board:", err);
    }
  });

  // Handle all board actions (ADD_SHAPE, UPDATE_SHAPE, DELETE_SHAPE, etc.)
  // The server simply relays the action to all OTHER users in the same room.
  // The sender already applied the action locally (optimistic update).
  socket.on("board-action", async (action) => {
    const { roomId, actionType, payload } = action;

    // Broadcast to all OTHER users in the room (socket.to excludes the sender).
    // FIX: removed duplicate PERM_UPDATE broadcast. The line below handles ALL
    // action types including PERM_UPDATE. The previous code had an extra
    // `socket.to(roomId).emit(...)` inside an if(actionType==="PERM_UPDATE") block,
    // causing every PERM_UPDATE to be delivered twice to every remote client.
    socket.to(roomId).emit("board-action", action);
  });

  // Client sends full board state to persist (called after major changes)
  socket.on("save-board", async ({ roomId, boardState }) => {
    try {
      await Board.findOneAndUpdate(
        { roomId },
        { boardState, updatedAt: new Date() },
      );
    } catch (err) {
      console.error("Error saving board:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(` Server running on port ${PORT}`));
