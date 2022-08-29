import { v4 as uuidv4 } from "uuid";
import request from "supertest";
import StubData from "@/prisma/stubData";
import { app } from "@/src/express";
import prisma from "@/prisma";

describe("API /v2/course_tables", () => {
  describe("GET /", () => {
    it("should return all tables", async () => {
      const token = StubData.getFirstAdminToken();

      const res = await request(app)
        .get("/api/v2/course_tables")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.course_tables.length).toBe(StubData.course_tables.length);
      // NOTE: here we assume the tables are not aggregated
      expect(res.body.course_tables.map((c) => c.id)).toEqual(
        StubData.course_tables.map((c) => c.id)
      );
    });

    it("should be invalid without admin privilege", async () => {
      const res = await request(app).get("/api/v2/course_tables");

      expect(res.statusCode).toBe(403);
    });
  });

  describe("POST /", () => {
    const reqData = {
      name: "new test table",
    };

    it("should return the created table", async () => {
      const res = await request(app)
        .post("/api/v2/course_tables")
        .send(reqData);

      expect(res.statusCode).toBe(200);
      expect(res.body.course_table.id).toEqual(expect.any(String));
      expect(res.body.course_table.semester).toEqual(process.env.SEMESTER);
      expect(res.body.course_table.name).toEqual(reqData.name);
    });

    it("should block a request without input", async () => {
      const res = await request(app).post("/api/v2/course_tables");

      expect(res.statusCode).toBe(400);
    });

    it("should block a request with empty name", async () => {
      const res = await request(app)
        .post("/api/v2/course_tables")
        .send({ name: "" });

      expect(res.statusCode).toBe(400);
    });

    it("should create a table in db", async () => {
      const res = await request(app)
        .post("/api/v2/course_tables")
        .send(reqData);

      expect(res.statusCode).toBe(200);

      const table = prisma.course_tables.findUnique({
        where: { id: res.body.course_table.id },
      });
      expect(table?.name).toEqual(reqTable.name);
      expect(table?.courses).toEqual([]);
    });
  });

  describe("GET /:id", () => {
    it("should return the selected table", async () => {
      const guestTable = StubData.getFirstGuestTable();
      const res = await request(app).get(
        `/api/v2/course_tables/${guestTable.id}`
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.course_table?.id).toEqual(guestTable.id);
      expect(res.body.course_table?.name).toEqual(guestTable.name);
      expect(res.body.course_table?.courses.length).toEqual(
        guestTable.courses.length
      );
    });

    it("should allow owner to get their tables", async () => {
      const linkedTable = StubData.getFirstLinkedTable();
      const token = StubData.getTokenByUserId(linkedTable.user_id);
      const res = await request(app)
        .get(`/api/v2/course_tables/${linkedTable.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.course_table?.id).toEqual(linkedTable.id);
      expect(res.body.course_table?.name).toEqual(linkedTable.name);
      expect(res.body.course_table?.courses.length).toEqual(
        linkedTable.courses.length
      );
    });

    it("should block guests to get other's tables", async () => {
      const linkedTable = StubData.getFirstLinkedTable();
      const res = await request(app).get(
        `/api/v2/course_tables/${linkedTable.id}`
      );

      expect(res.statusCode).toBe(403);
    });

    it("should block users to get other's tables", async () => {
      const linkedTable = StubData.getFirstLinkedTable();
      const anotherNormalUser = StubData.users.find(
        (u) => !StubData.isUserAdmin(u.id) && u.id !== linkedTable.user_id
      );
      const token = StubData.getTokenByUserId(anotherNormalUser.id);
      const res = await request(app)
        .get(`/api/v2/course_tables/${linkedTable.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(403);
    });

    it("should response 404 to a request with unknown id", async () => {
      const res = await request(app).get(
        `/api/v2/course_tables/unkown_table_id`
      );

      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /:id", () => {
    const [user1, user2] = StubData.normalUsers.slice(0, 2);
    const token1 = StubData.getTokenByUserId(user1.id);
    const token2 = StubData.getTokenByUserId(user2.id);
    const tableTemplate = {
      id: uuidv4(),
      name: "temp table",
      semester: process.env.SEMESTER,
      user_id: user1.id,
      courses: [],
    };

    beforeEach(async () => {
      await prisma.course_tables.create({ data: tableTemplate });
    });

    it("should block guests to delete other's tables", async () => {
      const res = await request(app).delete(
        `/api/v2/course_tables/${tableTemplate.id}`
      );

      expect(res.statusCode).toBe(401);

      const resTable = await prisma.course_tables.findUnique({
        where: { id: tableTemplate.id },
      });
      expect(resTable?.name).toBe(tableTemplate.name);
    });

    it("should block users to delete other's tables", async () => {
      const res = await request(app)
        .delete(`/api/v2/course_tables/${tableTemplate.id}`)
        .set("Authorization", `Bearer ${token2}`);

      expect(res.statusCode).toBe(403);

      const resTable = await prisma.course_tables.findUnique({
        where: { id: tableTemplate.id },
      });
      expect(resTable?.name).toBe(tableTemplate.name);
    });

    it("should response 404 to a request with unknown table id", async () => {
      const res = await request(app)
        .delete(`/api/v2/course_tables/unknown_table_id`)
        .set("Authorization", `Bearer ${token2}`);

      expect(res.statusCode).toBe(404);

      const resTable = await prisma.course_tables.findUnique({
        where: { id: tableTemplate.id },
      });
      expect(resTable?.name).toBe(tableTemplate.name);
    });

    it("should delete tables in db", async () => {
      const res = await request(app)
        .delete(`/api/v2/course_tables/${tableTemplate.id}`)
        .set("Authorization", `Bearer ${token1}`);

      expect(res.statusCode).toBe(200);

      const resTable = await prisma.course_tables.findUnique({
        where: { id: tableTemplate.id },
      });
      expect(resTable).toBe(null);
    });

    afterEach(async () => {
      // hackfix: using `deleteMany` to delete records that may not exists
      await prisma.course_tables.deleteMany({
        where: { id: tableTemplate.id },
      });
    });
  });

  describe("PATCH /:id", () => {
    const [user1, user2] = StubData.normalUsers.slice(0, 2);
    const token1 = StubData.getTokenByUserId(user1.id);
    const token2 = StubData.getTokenByUserId(user2.id);
    const tableTemplate = {
      id: uuidv4(),
      name: "temp table",
      semester: process.env.SEMESTER,
      user_id: user1.id,
      courses: [],
    };

    const newName = "new temp table";
    const newCourses = StubData.courses.slice(0, 3).map((c) => c.id);

    beforeEach(async () => {
      await prisma.course_tables.create({ data: tableTemplate });
    });

    it("should return the updated table", async () => {
      const res = await request(app)
        .patch(`/api/v2/course_tables/${tableTemplate.id}`)
        .set("Authorization", `Bearer ${token1}`)
        .send({
          courses: newCourses,
        });

      expect(res.statusCode).toBe(200);
      expect(res?.body.course_table.name).toEqual(tableTemplate.name);
      expect(res?.body.course_table.courses.map((c) => c.id)).toEqual(
        newCourses
      );
    });

    it("should block guests to update other's tables", async () => {
      const res = await request(app)
        .patch(`/api/v2/course_tables/${tableTemplate.id}`)
        .send({
          courses: newCourses,
        });

      expect(res.statusCode).toBe(401);

      const resTable = await prisma.course_tables.findUnique({
        where: { id: tableTemplate.id },
      });
      expect(resTable?.name).toBe(tableTemplate.name);
      expect(resTable?.courses).toEqual(tableTemplate.courses);
    });

    it("should block users to update other's tables", async () => {
      const res = await request(app)
        .patch(`/api/v2/course_tables/${tableTemplate.id}`)
        .set("Authorization", `Bearer ${token2}`)
        .send({
          courses: newCourses,
        });

      expect(res.statusCode).toBe(403);

      const resTable = await prisma.course_tables.findUnique({
        where: { id: tableTemplate.id },
      });
      expect(resTable?.name).toBe(tableTemplate.name);
      expect(resTable?.courses).toEqual(tableTemplate.courses);
    });

    it("should response 404 to a request with unknown table id", async () => {
      const res = await request(app)
        .patch(`/api/v2/course_tables/unknown_table_id`)
        .set("Authorization", `Bearer ${token2}`)
        .send({
          courses: newCourses,
        });

      expect(res.statusCode).toBe(404);

      const resTable = await prisma.course_tables.findUnique({
        where: { id: tableTemplate.id },
      });
      expect(resTable?.name).toBe(tableTemplate.name);
      expect(resTable?.courses).toEqual(tableTemplate.courses);
    });

    it("should block a request with no update data", async () => {
      const res = await request(app)
        .patch(`/api/v2/course_tables/${tableTemplate.id}`)
        .set("Authorization", `Bearer ${token1}`);

      expect(res.statusCode).toBe(400);
    });

    it("should block a request with invalid course id", async () => {
      const res = await request(app)
        .patch(`/api/v2/course_tables/${tableTemplate.id}`)
        .set("Authorization", `Bearer ${token1}`)
        .send({
          courses: ["unknown_course_id", ...newCourses],
        });

      expect(res.statusCode).toBe(400);

      const resTable = await prisma.course_tables.findUnique({
        where: { id: tableTemplate.id },
      });
      expect(resTable?.name).toBe(tableTemplate.name);
      expect(resTable?.courses).toEqual(tableTemplate.courses);
    });

    it("should update table name in db", async () => {
      const res = await request(app)
        .patch(`/api/v2/course_tables/${tableTemplate.id}`)
        .set("Authorization", `Bearer ${token1}`)
        .send({
          name: newName,
        });

      expect(res.statusCode).toBe(200);

      const resTable = await prisma.course_tables.findUnique({
        where: { id: tableTemplate.id },
      });
      expect(resTable?.name).toBe(newName);
      expect(resTable?.courses).toEqual(tableTemplate.courses);
    });

    it("should update table courses in db", async () => {
      const res = await request(app)
        .patch(`/api/v2/course_tables/${tableTemplate.id}`)
        .set("Authorization", `Bearer ${token1}`)
        .send({
          courses: newCourses,
        });

      expect(res.statusCode).toBe(200);

      const resTable = await prisma.course_tables.findUnique({
        where: { id: tableTemplate.id },
      });
      expect(resTable?.name).toBe(tableTemplate.name);
      expect(resTable?.courses).toEqual(newCourses);
    });

    afterEach(async () => {
      await prisma.course_tables.delete({ where: { id: tableTemplate.id } });
    });
  });
});
