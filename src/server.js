import "dotenv-defaults/config";
import mongoose from "mongoose";
import { startApp } from "./express";

async function main() {
  try {
    // mongoose
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("mongo db connection created");

    // express
    await startApp();
  } catch (err) {
    console.error(err);
  }
}

main();
