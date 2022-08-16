import { Router } from "express";
import v1Router from "./v1";
import v2Router from "./v2";

const router = Router();

router.use("/v1", v1Router).use("/v2", v2Router);

export default router;
