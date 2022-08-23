import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { URL } from "url";
import { insertStubData } from "../stubData";

const schemaId = `test`;
const url = makePostgresURL(schemaId);
process.env.POSTGRES_URL = url;
const prisma = new PrismaClient({
  datasources: { db: { url } },
});

jest.setTimeout(10 * 1000);

beforeAll(async () => {
  console.log(`Initializing DB...`);
  execSync(`npx prisma db push`, {
    env: {
      ...process.env,
      POSTGRES_URL: url,
    },
  });
  await insertStubData();
  console.log(`DB initialization finished.`);
});

afterAll(async () => {
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
