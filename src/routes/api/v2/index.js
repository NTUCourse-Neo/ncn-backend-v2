import { Router } from "express";
import courseTableRouter from "./course_tables";
import coursesRouter from "./courses";
import usersRouter from "./users";

// route: "/api/v2"
const router = Router();

router
  .use("/course_tables", courseTableRouter)
  .use("/courses", coursesRouter)
  .use("/users", usersRouter);

export default router;
