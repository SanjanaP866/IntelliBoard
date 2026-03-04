const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

// ─── Helper: generate JWT ─────────────────────────────────────────────────────
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Hash password with bcrypt (salt rounds = 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create and save the new user
    const user = await User.create({ name, email, password: hashedPassword });

    // Return token + user info (no password)
    const token = generateToken(user._id);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error during signup" });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare provided password with stored hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Return token + user info
    const token = generateToken(user._id);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login" });
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
    if (board.owner.toString() !== req.userId) {
      return res.status(403).json({ message: "Only owner can change permissions" });
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


