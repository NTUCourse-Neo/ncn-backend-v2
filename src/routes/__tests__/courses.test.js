import request from "supertest";
import { deleteStubData, insertStubData } from "@/prisma/stubData";
import { app } from "../../express";

describe("API /courses", () => {
  beforeEach(async () => {
    await insertStubData();
  });

  describe("GET /", () => {
    it("should be admin only", async () => {
      const response = await request(app).get("/api/v2/courses");

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /ids", () => {
    it("should return the selected courses", async () => {
      const response = await request(app)
        .post("/api/v2/courses/ids")
        .send({
          ids: ["1102_01001", "1102_01002", "1102_01003"],
        });

      expect(response.statusCode).toBe(200);
      // TODO: add more test
      // expect(response.body).toBe(allCourseData);
    });
  });

  afterEach(async () => {
    await deleteStubData();
  });
});
