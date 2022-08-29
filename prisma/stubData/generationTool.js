import "dotenv-defaults/config";
import prisma from "..";
import fs from "fs";

async function writeModelData(modelName, data) {
  fs.writeFileSync(
    `./prisma/stubData/${modelName}.json`,
    JSON.stringify(data, null, 2)
  );
}

const maskedUserIdMap = new Map();
function getMaskedUserId(userId) {
  if (!maskedUserIdMap.has(userId)) {
    maskedUserIdMap.set(userId, maskedUserIdMap.size);
  }
  return `test-user-id-${maskedUserIdMap.get(userId)}`;
}

async function main() {
  // users
  const users = await prisma.users.findMany({ take: 10, skip: 50 });

  // tables
  const userTables = await prisma.course_tables.findMany({
    where: { user_id: { in: users.map((u) => u.id) } },
  });
  const guestTable = await prisma.course_tables.findMany({
    where: {
      user_id: null,
    },
    take: 3,
  });
  const courseTables = [...userTables, ...guestTable];

  // courses
  const courseIds = new Set();
  for (const user of users) {
    for (const fav of user.favorites) {
      courseIds.add(fav);
    }
  }
  for (const table of courseTables) {
    for (const course of table.courses) {
      courseIds.add(course);
    }
  }
  const courses = await prisma.courses.findMany({
    where: { id: { in: Array.from(courseIds) } },
  });

  // schedule
  const courseSchedules = await prisma.course_schedules.findMany({
    where: { course_id: { in: courses.map((c) => c.id) } },
  });

  // courseAreas
  const courseAreas = await prisma.course_areas.findMany({
    where: { course_id: { in: courses.map((u) => u.id) } },
  });

  // areas
  const areaIds = new Set();
  for (const courseArea of courseAreas) {
    areaIds.add(courseArea.area_id);
  }
  const areas = await prisma.areas.findMany({
    where: { id: { in: Array.from(areaIds) } },
  });

  // courseDepartment
  const courseDepartments = await prisma.course_departments.findMany({
    where: { course_id: { in: Array.from(courseIds) } },
  });

  // department
  const departmentIds = new Set();
  for (const courseDepartment of courseDepartments) {
    departmentIds.add(courseDepartment.department_id);
  }
  for (const user of users) {
    departmentIds.add(user.major);
    departmentIds.add(user.d_major);
  }
  departmentIds.delete(null);
  const departments = await prisma.departments.findMany({
    where: { id: { in: Array.from(departmentIds) } },
  });

  // colleage
  const colleageIds = new Set();
  for (const department of departments) {
    colleageIds.add(department.college_id);
  }
  const colleges = await prisma.colleges.findMany({
    where: { id: { in: Array.from(colleageIds) } },
  });

  // mask & write
  await writeModelData(
    "users",
    users.map((u, i) => {
      u.name = `Test User ${i}`;
      u.id = getMaskedUserId(u.id);
      u.email = `user.${i}@ntu.edu.tw`;
      u.student_id = `B010101${i}`;

      if (i < 1) {
        u.name += " (admin)";
      }
      return u;
    })
  );
  await writeModelData(
    "course_tables",
    courseTables.map((ct) => {
      if (ct.user_id) {
        ct.user_id = getMaskedUserId(ct.user_id);
      }
      return ct;
    })
  );
  await writeModelData(
    "courses",
    courses.map((c, i) => {
      c.name = `測試課程 ${i}`;
      c.teacher = `測試教師 ${Math.floor(i / Math.sqrt(courses.length))}`;
      c.note = `note ${i}`;
      return c;
    })
  );
  await writeModelData("course_schedules", courseSchedules);
  await writeModelData("course_areas", courseAreas);
  await writeModelData("areas", areas);
  await writeModelData("course_departments", courseDepartments);
  await writeModelData("departments", departments);
  await writeModelData("colleges", colleges);
}

main();
