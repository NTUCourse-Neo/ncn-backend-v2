import express from "express";
import router from "./routes/index";
import course_router from "./routes/courses";
import user_router from "./routes/users";
import course_table_router from "./routes/course_tables";
import social_router from "./routes/social";
import logs_router from "./routes/logs";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use("/api/v1", router);
app.use("/api/v2/courses", course_router);
app.use("/api/v2/course_tables", course_table_router);
app.use("/api/v2/users", user_router);
app.use("/api/v1/social", social_router);
app.use("/api/v1/logs", logs_router);

export function startApp() {
  const PORT = 5000 || process.env.PORT;

  const p = new Promise((resolve, reject) => {
    try {
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });

  return p;
}

export { app };
