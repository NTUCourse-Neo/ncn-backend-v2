import request from "supertest";
// import prisma from "../../../prisma";
import { app } from "../../express";

describe("API /courses", () => {
  beforeEach(async () => {
    // TODO: insert stub data
    // await prisma.courses.createMany({ data: allCourseData });
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
    // TODO: cleanup
    // await prisma.courses.deleteMany();
  });
});
