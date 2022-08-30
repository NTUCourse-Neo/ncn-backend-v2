import request from "supertest";
import StubData from "@/prisma/stubData";
import { app } from "@/src/express";
import prisma from "@/prisma";

describe("API /v2/users", () => {
  describe("GET /:id", () => {
    it("should return the selected user", async () => {
      const user = StubData.normalUsers[0];
      const token = StubData.getTokenByUserId(user.id);

      const res = await request(app)
        .get(`/api/v2/users/${user.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.user?.db?.id).toBe(user.id);
      expect(res.body.user?.db?.name).toBe(user.name);
      expect(res.body.user?.db?.email).toBe(user.email);

      // TODO: add more content tests
    });

    it("should only be available to user themself", async () => {
      const [user1, user2] = StubData.normalUsers.slice(0, 2);
      const token = StubData.getTokenByUserId(user1.id);

      const res = await request(app)
        .get(`/api/v2/users/${user2.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(403);
    });

    it("should response 404 to a request with unknown id", async () => {
      const user = StubData.normalUsers[0];
      const token = StubData.getTokenByUserId(user.id);

      const res = await request(app)
        .get(`/api/v2/users/unknown_user_id`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /", () => {
    it("should return the created user", async () => {
      const {
        user_id: id,
        name,
        email,
        token,
      } = StubData.getUnregisteredData();

      const res = await request(app)
        .post(`/api/v2/users`)
        .set("Authorization", `Bearer ${token}`)
        .send({ user: { email } });

      expect(res.statusCode).toBe(200);
      expect(res.body.user?.db?.id).toBe(id);
      expect(res.body.user?.db?.name).toBe(name);
      expect(res.body.user?.db?.email).toBe(email);
    });

    it("should block a request with unmatched email", async () => {
      const { email } = StubData.getUnregisteredData();
      const token = StubData.getFirstNormalUserToken();

      const res = await request(app)
        .post(`/api/v2/users`)
        .set("Authorization", `Bearer ${token}`)
        .send({ user: { email } });

      expect(res.statusCode).toBe(403);
    });

    it("should block a request with empty body", async () => {
      const { token } = StubData.getUnregisteredData();

      const res = await request(app)
        .post(`/api/v2/users`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(400);
    });

    it("should create a new user in db", async () => {
      const {
        user_id: id,
        name,
        email,
        token,
      } = StubData.getUnregisteredData();

      const res = await request(app)
        .get(`/api/v2/users`)
        .set("Authorization", `Bearer ${token}`)
        .send({ user: { email } });

      expect(res.statusCode).toBe(200);

      const resUser = await prisma.users.findUnique({ where: { id } });
      expect(resUser?.name).toBe(name);
      expect(resUser?.email).toBe(email);
    });

    afterEach(async () => {
      await prisma.users.deleteMany({
        where: { id: StubData.getUnregisteredData().user_id },
      });
    });
  });

  describe("PATCH /", () => {
    const { user_id: id, name, email, token } = StubData.getUnregisteredData();
    const userTemplate = { id, name, email, year: 0 };
    const newUserYear = 5;
    const newMajor = StubData.departments[0].id;

    beforeEach(async () => {
      await prisma.users.create({ data: userTemplate });
    });

    it("should return the updated user", async () => {
      const res = await request(app)
        .patch(`/api/v2/users`)
        .set("Authorization", `Bearer ${token}`)
        .send({ user: { year: newUserYear } });

      expect(res.statusCode).toBe(200);
      expect(res.body.user?.db?.id).toBe(id);
      expect(res.body.user?.db?.name).toBe(name);
      expect(res.body.user?.db?.email).toBe(email);
      expect(res.body.user?.db?.year).toBe(newUserYear);

      // TODO: test other fields
    });

    describe("should block a request with invalid fields", () => {
      const invalidFileds = {
        id: "test_id",
        email: "test@gmail.com",
        student_id: "B01234567",
      };

      it.each(Object.entries(invalidFileds))(
        "{ %p: %p }",
        async (key, value) => {
          const res = await request(app)
            .patch(`/api/v2/users`)
            .set("Authorization", `Bearer ${token}`)
            .send({ user: { [key]: value } });

          expect(res.statusCode).toBe(400);
        }
      );
    });

    describe("should block a request with wrong data type", () => {
      const wrongFields = {
        name: 0,
        year: "1",
        major: 0,
        d_major: 0,
        minors: 0,
        languages: 0,
        favorites: 0,
      };

      it.each(Object.entries(wrongFields))("{ %p: %p }", async (key, value) => {
        const res = await request(app)
          .patch(`/api/v2/users`)
          .set("Authorization", `Bearer ${token}`)
          .send({ user: { [key]: value } });

        console.log(res.body);
        expect(res.statusCode).toBe(400);
      });
    });

    it("should block guests to update other's user data", async () => {
      const res = await request(app)
        .patch(`/api/v2/users`)
        .send({ user: { year: newUserYear } });

      expect(res.statusCode).toBe(401);
      const resUser = await prisma.users.findUnique({ where: { id } });
      expect(resUser?.year).toBe(userTemplate.year);
    });

    it("should block users to update other's user data", async () => {
      const normalUserToken = StubData.getFirstNormalUserToken();

      const res = await request(app)
        .patch(`/api/v2/users`)
        .set("Authorization", `Bearer ${normalUserToken}`)
        .send({ user: { year: newUserYear } });

      expect(res.statusCode).toBe(403);
      const resUser = await prisma.users.findUnique({ where: { id } });
      expect(resUser?.year).toBe(userTemplate.year);
    });

    it("should update users in db", async () => {
      const res = await request(app)
        .patch(`/api/v2/users`)
        .set("Authorization", `Bearer ${token}`)
        .send({ user: { year: newUserYear, major: newMajor } });

      expect(res.statusCode).toBe(200);
      const resUser = await prisma.users.findUnique({ where: { id } });
      expect(resUser?.year).toBe(newUserYear);
      expect(resUser?.major).toBe(newMajor);

      // TODO: test other fields
    });

    afterEach(async () => {
      await prisma.users.deleteMany({
        where: { id: StubData.getUnregisteredData().user_id },
      });
    });
  });

  // NOTE: skipped `POST /v2/users/:id/course_table` since it should be removed in the next version

  describe("DELETE /:type", () => {
    const { user_id: id, name, email, token } = StubData.getUnregisteredData();
    const userTemplate = { id, name, email };

    it("should block a request with unknown target type", async () => {
      const res = await request(app)
        .delete(`/api/v2/users/unknown_type`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
    });

    it.each(["account", "profile"])(
      "should block guests to delete their data",
      async (type) => {
        const res = await request(app)
          .delete(`/api/v2/users/${type}`)
          .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(401);
      }
    );

    it("should delete the user in db", async () => {
      await prisma.users.create({ data: userTemplate });

      const res = await request(app)
        .delete(`/api/v2/users`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);

      const resUser = await prisma.users.findUnique({ where: { id } });
      expect(resUser).toBe(null);
    });

    // TODO: test deleting in auth0 api (`DELETE /account`)

    afterEach(async () => {
      await prisma.users.deleteMany({
        where: { id },
      });
    });
  });

  describe("PUT /favorites/:course_id", () => {
    const { user_id: id, name, email, token } = StubData.getUnregisteredData();
    const userTemplate = { id, name, email };
    const newCourseId = StubData.courses[0].id;

    beforeEach(async () => {
      await prisma.users.create({ data: userTemplate });
    });

    it("should return the updated favorite courses", async () => {
      const res = await request(app)
        .put(`/api/v2/users/favorites/${newCourseId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.favorites?.length).toBe(1);
      expect(res.body.favorites?.[0]?.id).toBe(newCourseId);
    });

    it("should block a request with unknown course id", async () => {
      const res = await request(app)
        .put(`/api/v2/users/favorites/unknown_course_id`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(400);
    });

    it("should block a request with course id already in favorites", async () => {
      await prisma.users.update({
        where: { id },
        data: { favorites: [newCourseId] },
      });

      const res = await request(app)
        .put(`/api/v2/users/favorites/${newCourseId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(400);
    });

    it("should update favorite courses in db", async () => {
      const res = await request(app)
        .put(`/api/v2/users/favorites/${newCourseId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);

      const resUser = await prisma.users.findUnique({ where: { id } });
      expect(resUser?.favorites?.length).toBe(1);
      expect(resUser?.favorites?.[0]).toBe(newCourseId);
    });

    afterEach(async () => {
      await prisma.users.deleteMany({
        where: { id },
      });
    });
  });

  describe("DELETE /favorites/:course_id", () => {
    const { user_id: id, name, email, token } = StubData.getUnregisteredData();
    const newCourseId = StubData.courses[0].id;
    const userTemplate = { id, name, email, favorites: [newCourseId] };

    beforeEach(async () => {
      await prisma.users.create({ data: userTemplate });
    });

    it("should return the updated favorite courses", async () => {
      const res = await request(app)
        .delete(`/api/v2/users/favorites/${newCourseId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.favorites?.length).toBe(0);
    });

    it("should block a request with unknown course id", async () => {
      const res = await request(app)
        .delete(`/api/v2/users/favorites/unknown_course_id`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(400);
    });

    it("should block a request with course id not in favorites", async () => {
      const secondCourseId = StubData.courses[1].id;

      const res = await request(app)
        .delete(`/api/v2/users/favorites/${secondCourseId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(400);
    });

    it("should update favorite courses in db", async () => {
      const res = await request(app)
        .delete(`/api/v2/users/favorites/${newCourseId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);

      const resUser = await prisma.users.findUnique({ where: { id } });
      expect(resUser?.favorites?.length).toBe(0);
    });

    afterEach(async () => {
      await prisma.users.deleteMany({
        where: { id },
      });
    });
  });
});
