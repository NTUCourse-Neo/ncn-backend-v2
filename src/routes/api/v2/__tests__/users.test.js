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
      const token = StubData.getNormalUserToken();

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
});
