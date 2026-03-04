const express = require("express");
const Board = require("../models/Board");
const authMiddleware = require("../middleware/auth");
const router = express.Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const boards = await Board.find({ $or: [{ owner: req.userId }, { collaborators: req.userId }] })
      .populate("owner", "name email")
      .populate("collaborators", "name email")
      .sort({ updatedAt: -1 });
    res.json(boards);
  } catch (err) { res.status(500).json({ message: "Error fetching boards" }); }
});

router.post("/", async (req, res) => {
  const { title } = req.body;
  try {
    const board = await Board.create({ title: title || "Untitled Board", owner: req.userId, collaborators: [], boardState: [] });
    res.status(201).json(board);
  } catch (err) { res.status(500).json({ message: "Error creating board" }); }
});

router.get("/:roomId", async (req, res) => {
  try {
    const board = await Board.findOne({ roomId: req.params.roomId })
      .populate("owner", "name email")
      .populate("collaborators", "name email");
    if (!board) return res.status(404).json({ message: "Board not found" });
    const isOwner = board.owner._id.toString() === req.userId;
    const isCollab = board.collaborators.map(c => c._id.toString()).includes(req.userId);
    if (!isOwner && !isCollab) {
      board.collaborators.push(req.userId);
      await board.save();
      await board.populate("collaborators", "name email");
    }
    const obj = board.toObject();
    obj.collaboratorPermissions = Object.fromEntries(board.collaboratorPermissions || new Map());
    res.json(obj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching board" });
  }
});

router.delete("/:roomId", async (req, res) => {
  try {
    const board = await Board.findOne({ roomId: req.params.roomId });
    if (!board) return res.status(404).json({ message: "Board not found" });
    if (board.owner.toString() !== req.userId) return res.status(403).json({ message: "Only the owner can delete this board" });
    await board.deleteOne();
    res.json({ message: "Board deleted" });
  } catch (err) { res.status(500).json({ message: "Error deleting board" }); }
});

router.patch("/:roomId/state", async (req, res) => {
  try {
    const { boardState } = req.body;

    const board = await Board.findOne({ roomId: req.params.roomId });

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    const isOwner = board.owner.toString() === req.userId;
    const isCollab = board.collaborators.map(c => c.toString()).includes(req.userId);

    if (!isOwner && !isCollab) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const perm = board.collaboratorPermissions?.get(req.userId);

    if (!isOwner && perm === "view") {
      return res.status(403).json({ message: "View-only access" });
    }

    board.boardState = boardState || [];
    board.updatedAt = new Date();

    await board.save();

    res.json({ message: "Saved" });

  } catch (err) {
    console.error("Error saving board state:", err);
    res.status(500).json({ message: "Error saving board state" });
  }
});

router.patch("/:roomId/permissions", async (req, res) => {
  try {
    const { userId, permission } = req.body;

    const board = await Board.findOne({ roomId: req.params.roomId });

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    // Only owner can change permissions
    if (board.owner._id.toString() !== req.userId) {
      return res.status(403).json({ message: "Only owner can update permissions" });
    }

    if (!board.collaboratorPermissions) {
      board.collaboratorPermissions = new Map();
    }

    board.collaboratorPermissions.set(userId, permission);

    await board.save();

    res.json({
      collaboratorPermissions: Object.fromEntries(board.collaboratorPermissions),
    });

  } catch (err) {
    console.error("Permission update error:", err);
    res.status(500).json({ message: "Error updating permissions" });
  }
});

module.exports = router;
