import prisma from "../";
import areas from "./areas.json";
import colleges from "./colleges.json";
import courses from "./courses.json";
import departments from "./departments.json";
import users from "./users.json";
import course_tables from "./course_tables.json";
import course_areas from "./course_areas.json";
import course_departments from "./course_departments.json";
import course_schedules from "./course_schedules.json";

const Verbose = 0;
// const Verbose = 1;

class StubDataContainer {
  constructor() {
    // add all raw data
    // NOTE: these should be ordered by dependency relations
    // NOTE: we need to hardcode this to get type hint
    this.areas = areas;
    this.colleges = colleges;
    this.courses = courses;
    this.departments = departments;
    this.users = users;
    this.course_tables = course_tables;
    this.course_areas = course_areas;
    this.course_departments = course_departments;
    this.course_schedules = course_schedules;

    // indexing
    this._usersById = {};
    this._tokensByUserId = {};
    this._usersByToken = {};
    this.admins = [];
    this.normalUsers = [];
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const { id } = user;
      const token = `${i}.${i}.${i}`;
      this._tokensByUserId[id] = token;
      this._usersById[id] = user;
      this._usersByToken[token] = user;

      if (this.isUserAdmin(id)) {
        this.admins.push(user);
      } else {
        this.normalUsers.push(user);
      }
    }
    this._guestTables = [];
    this._linkedTables = [];
    for (const table of this.course_tables) {
      if (!table.user_id) {
        this._guestTables.push(table);
      } else {
        this._linkedTables.push(table);
      }
    }

    // export { UsersByToken };
  }

  getAllRaw() {
    return {
      areas,
      colleges,
      courses,
      departments,
      users,
      course_tables,
      course_areas,
      course_departments,
      course_schedules,
    };
  }

  isUserAdmin(userId) {
    const user = this.getUserById(userId);
    return user.name.includes("admin");
  }

  getTokenByUserId(userId) {
    return this._tokensByUserId[userId];
  }

  getUserByToken(token) {
    return this._usersByToken[token];
  }

  getUserById(userId) {
    return this._usersById[userId];
  }

  getAdminToken() {
    return this.getTokenByUserId(this.admins[0]);
  }

  getNormalUserToken() {
    return this.getTokenByUserId(this.normalUsers[0]);
  }

  getGuestTable() {
    return this._guestTables[0];
  }

  getLinkedTable() {
    return this._linkedTables[0];
  }
}

const stubDataContainer = new StubDataContainer();

export async function insertStubData() {
  for (const [name, data] of Object.entries(stubDataContainer.getAllRaw())) {
    await prisma[name].createMany({ data });
    Verbose > 0 && console.log(`Model ${name} injected`);
  }
}

export async function deleteStubData() {
  for (const name of Object.keys(stubDataContainer.getAllRaw()).reverse()) {
    await prisma[name].deleteMany();
    Verbose > 0 && console.log(`Model ${name} deleted`);
  }
}

export default stubDataContainer;
