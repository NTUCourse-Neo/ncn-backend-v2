import express from "express";
import apiRouter from "./routes/api";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use("/api", apiRouter);

export function startApp() {
  const PORT = process.env.PORT || 5000;

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
