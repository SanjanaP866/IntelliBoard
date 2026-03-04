const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const boardSchema = new mongoose.Schema({
  roomId: {
    type: String,
    default: () => uuidv4(), // auto-generate unique room ID
    unique: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  collaborators: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  // Map of userId -> "edit" | "view"  (default "edit" for backwards compat)
  collaboratorPermissions: {
    type: Map,
    of: String,
    default: {},
  },
  // boardState stores the array of all shapes/elements on the canvas
  boardState: {
    type: Array,
    default: [],
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Board", boardSchema);
