import express from "express";

const router = express.Router();

// API version: 1.0
router.get("/healthcheck", (req, res) => {
  res.send("OK");
});

export default router;
