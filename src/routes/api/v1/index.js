import { Router } from "express";
import healthCheckRouter from "./healthcheck";
import logsRouter from "./logs";
import socialRouter from "./social";

// route: "/api/v1"
const router = Router();

router
  .use("/healthcheck", healthCheckRouter)
  .use("/logs", logsRouter)
  .use("/social", socialRouter);

export default router;
