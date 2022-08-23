import request from "supertest";
import StubData, { deleteStubData, insertStubData } from "@/prisma/stubData";
import { app } from "@/src/express";
import TokensByUserId from "@/src/__tests__/util/UserTokens";

describe("API /v2/courses", () => {
  describe("GET /", () => {
    it("should return all courses", async () => {
      const res = await request(app)
        .get("/api/v2/courses")
        .set("Authorization", `Bearer ${TokensByUserId[StubData.users[0].id]}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.courses.length).toBe(StubData.courses.length);
      expect(res.body.courses.map((c) => c.name)).toBe(
        StubData.courses.map((c) => c.name)
      );
    });

    it("should be invalid without auth", async () => {
      const res = await request(app).get("/api/v2/courses");

      expect(res.statusCode).toBe(403);
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
        const res = await request(app)
          .post("/api/v2/courses/search")
          .send(CompleteRequestObject);

        expect(res.statusCode).toBe(400);
      }
    });

    it("should support search by name", async () => {
      const res = await request(app)
        .post("/api/v2/courses/search")
        .send(CompleteRequestObject);

      expect(res.statusCode).toBe(200);
      expect(res.body.courses.length > 0).toBeTruthy();
      // console.log(res.body);
      // TODO: check content
    });
  });

  describe("POST /ids", () => {
    const SomeCourse = StubData.courses.slice(0, 3);
    const SomeCourseIds = SomeCourse.map((c) => c.id);

    it("should block a request with any unknown id", async () => {
      const res = await request(app)
        .post("/api/v2/courses/ids")
        .send({
          ids: ["unknown_id_1", ...SomeCourseIds],
        });

      expect(res.statusCode).toBe(400);
    });

    it("should return the selected courses", async () => {
      const res = await request(app).post("/api/v2/courses/ids").send({
        ids: SomeCourseIds,
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.courses.length).toBe(SomeCourseIds.length);
      expect(res.body.courses[0].name).toBe(SomeCourse[0].name);
    });
  });

  describe("Get /:id", () => {
    it("should return the selected courses", async () => {
      const course = StubData.courses[0];
      const res = await request(app).get(`/api/v2/courses/${course.id}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.course.name).toBe(course.name);
      expect(res.body.course.id).toBe(course.id);
    });

    it("should response 404 to a request with unknown id", async () => {
      const res = await request(app).get(`/api/v2/courses/unknown_course_id`);

      expect(res.statusCode).toBe(404);
    });
  });

  // TODO: add live api support for `/:serial/enrollinfo`, `/:id/rating` , `/:id/ptt/:board`, `/:id/syllabus`

  // describe("Get /:course_id/syllabus", () => {
  //   it("should return the syllabus for the selected course", async () => {
  //     const course = StubData.courses[0];
  //     const res = await request(app).get(
  //       `/api/v2/courses/${course.id}/syllabus`
  //     );

  //     expect(res.statusCode).toBe(200);
  //     expect(res.body.course_id).toBe(course.id);
  //     expect(res.body.course_syllabus?.syllabus).toEqual(expect.anything());
  //     expect(res.body.course_syllabus?.grade).toEqual(expect.anything());
  //   });

  //   it("should response 404 to a request with unknown id", async () => {
  //     const res = await request(app).get(
  //       `/api/v2/courses/unknown_course_id/syllabus`
  //     );

  //     expect(res.statusCode).toBe(404);
  //   });
  // });
});
