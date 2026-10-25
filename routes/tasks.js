
const express = require("express");
const mongoose = require("mongoose");
const Task = require("../models/Task");
const User = require("../models/User");

const {
  authenticateToken,
  requireAdmin,
} = require("../middleware/auth");

const router = express.Router();

// All task routes require login
router.use(authenticateToken);

// GET: Admin can view all users; Members cannot access this route
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const users = await User.find()
      .select("_id name email role")
      .sort({ name: 1 });

    res.json(users);
  } catch (error) {
    console.error("Fetch users error:", error.message);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// GET: Fetch tasks
// Admin sees all tasks; Member sees only their own
router.get("/", async (req, res) => {
  try {
    const filter =
      req.user.role === "Admin"
        ? {}
        : { userId: req.user._id };

    const tasks = await Task.find(filter).sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error("Fetch tasks error:", error.message);
    res.status(500).json({ message: "Failed to fetch tasks" });
  }
});

// POST: Create a task for the logged-in user
router.post("/", async (req, res) => {
  try {
    const { title, category, dueDate, priority, status } = req.body;

    if (typeof title !== "string" || title.trim().length < 3) {
      return res.status(400).json({
        message: "Title must be at least 3 characters long",
      });
    }

    if (!dueDate || !Number.isFinite(Date.parse(dueDate))) {
      return res.status(400).json({
        message: "A valid due date is required",
      });
    }

    const parsedDueDate = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (parsedDueDate < today) {
      return res.status(400).json({
        message: "Due date cannot be in the past",
      });
    }

    const priorities = ["Low", "Medium", "High"];
    const statuses = ["To-Do", "In-Progress", "Completed"];

    if (priority && !priorities.includes(priority)) {
      return res.status(400).json({ message: "Invalid priority" });
    }

    if (status && !statuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const task = await Task.create({
      title: title.trim(),
      category:
        typeof category === "string" ? category.trim() : "General",
      dueDate: parsedDueDate,
      priority: priority || "Medium",
      status: status || "To-Do",
      userId: req.user._id,
    });

    res.status(201).json(task);
  } catch (error) {
    console.error("Create task error:", error.message);
    res.status(400).json({ message: "Failed to create task" });
  }
});

// PATCH: Update task status
// Admin can update any task; Member can update their own
router.patch("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const fields = Object.keys(req.body);

    if (fields.length !== 1 || fields[0] !== "status") {
      return res.status(400).json({
        message: "Only the status field can be updated here",
      });
    }

    const statuses = ["To-Do", "In-Progress", "Completed"];

    if (!statuses.includes(req.body.status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const filter =
      req.user.role === "Admin"
        ? { _id: req.params.id }
        : { _id: req.params.id, userId: req.user._id };

    const task = await Task.findOneAndUpdate(
      filter,
      { $set: { status: req.body.status } },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json(task);
  } catch (error) {
    console.error("Update task error:", error.message);
    res.status(500).json({ message: "Failed to update task" });
  }
});

// PATCH: Admin-only task reassignment
router.patch("/:id/assign", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    if (
      !mongoose.isValidObjectId(req.params.id) ||
      !mongoose.isValidObjectId(userId)
    ) {
      return res.status(400).json({
        message: "Valid task ID and user ID are required",
      });
    }

    const user = await User.findById(userId).select("_id");

    if (!user) {
      return res.status(404).json({ message: "Target user not found" });
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: { userId: user._id } },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json({
      message: "Task reassigned successfully",
      task,
    });
  } catch (error) {
    console.error("Reassign task error:", error.message);
    res.status(500).json({ message: "Failed to reassign task" });
  }
});

// DELETE: Admin can delete any task; Member can delete their own
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const filter =
      req.user.role === "Admin"
        ? { _id: req.params.id }
        : { _id: req.params.id, userId: req.user._id };

    const task = await Task.findOneAndDelete(filter);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Delete task error:", error.message);
    res.status(500).json({ message: "Failed to delete task" });
  }
});

module.exports = router;
