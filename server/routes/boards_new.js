const express = require("express");
const Board = require("../models/Board");
const authMiddleware = require("../middleware/auth");
const router = express.Router();
router.use(authMiddleware);
