import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { URL } from "url";

const schemaId = `test`;
const url = makePostgresURL(schemaId);
process.env.POSTGRES_URL = url;
const prisma = new PrismaClient({
  datasources: { db: { url } },
});

beforeEach(async () => {
  execSync(`npx prisma db push`, {
    env: {
      ...process.env,
      POSTGRES_URL: url,
    },
  });
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(
    `DROP SCHEMA IF EXISTS "${schemaId}" CASCADE;`
  );
  await prisma.$disconnect();
});

function makePostgresURL(schema) {
  if (!process.env.POSTGRES_URL) {
    throw new Error("Cannot find `POSTGRES_URL` in env variables");
  }
  const url = new URL(process.env.POSTGRES_URL);
  url.searchParams.set("schema", schema);
  return url.toString();
}

export default prisma;
