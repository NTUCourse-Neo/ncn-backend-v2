import request from "supertest";
import StubData, { deleteStubData, insertStubData } from "@/prisma/stubData";
import { app } from "@/src/express";

describe("API /v2/courses", () => {
  beforeEach(async () => {
    // await insertStubData();
  });

  describe("GET /", () => {
    // TODO: add admin stub user data
    // it("should be available for admin", async () => {
    //   const response = await request(app).get("/api/v2/courses");

    //   expect(response.statusCode).toBe(403);
    // });

    // it("should return all courses", async () => {
    //   const response = await request(app).get("/api/v2/courses");

    //   expect(response.statusCode).toBe(200);
    //   expect(response.body.courses.length).toBe(StubData.courses.length);
    //   // TODO: check content
    // });

    it("should be invalid without auth", async () => {
      const response = await request(app).get("/api/v2/courses");

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /search", () => {
    const CompleteRequestObject = {
      keyword: "專題研究",
      fields: ["name"],
      filter: {
        strict_match: false,
        time: [["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "A", "B"]],
        department: ["5050"],
        category: ["test"],
        enroll_method: ["1", "2", "3"],
      },
      batch_size: 5,
      offset: 0,
    };

    it("should response invalid requests with 400", async () => {
      for (const key of Object.keys(CompleteRequestObject)) {
        const badRequestObject = {
          ...CompleteRequestObject,
        };
        delete badRequestObject[key];
        const response = await request(app)
          .post("/api/v2/courses/search")
          .send(CompleteRequestObject);

        expect(response.statusCode).toBe(400);
      }
    });

    it("should support search by name", async () => {
      const response = await request(app)
        .post("/api/v2/courses/search")
        .send(CompleteRequestObject);

      expect(response.statusCode).toBe(200);
      expect(response.body.courses.length > 0).toBeTruthy();
      // console.log(response.body);
      // TODO: check content
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
    // await deleteStubData();
  });
});
