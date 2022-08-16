import prisma from "..";
import areas from "./areas.json";
import colleges from "./colleges.json";
import courses from "./courses.json";
import departments from "./departments.json";
import specialties from "./specialties.json";
import users from "./users.json";

const Verbose = 0;
// const Verbose = 1;

// NOTE: these should be ordered by dependency relations
const AllDataRaw = {
  areas,
  colleges,
  courses,
  departments,
  specialties,
  users,
};

export async function insertStubData() {
  for (const [name, data] of Object.entries(AllDataRaw)) {
    await prisma[name].createMany({ data });
    Verbose > 0 && console.log(`Model ${name} injected`);
  }
}

export async function deleteStubData() {
  for (const name of Object.keys(AllDataRaw).reverse()) {
    await prisma[name].deleteMany();
    Verbose > 0 && console.log(`Model ${name} deleted`);
  }
}

export default AllDataRaw;
