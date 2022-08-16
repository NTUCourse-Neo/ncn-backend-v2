import { Router } from "express";

// route: "/api/v1/healthcheck"
const router = Router();

// API version: 1.0
router.get("/", (req, res) => {
  res.send("OK");
});

export default router;
