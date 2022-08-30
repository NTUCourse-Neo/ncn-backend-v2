import { Router } from "express";
import prisma from "@/prisma";
import { checkJwt } from "@/src/middlewares/auth";
import checkIsAdmin from "@/src/middlewares/checkIsAdmin";
import { reportAPIError } from "@/src/utils/webhook_client";
import { getCoursesbyIds } from "@/src/queries/courses";

// route: "/api/v2/course_tables"
const router = Router();
const active_semester = process.env.SEMESTER;

// API version: 2.0
router.get("/", checkJwt, checkIsAdmin, async (req, res) => {
  let result;
  try {
    result = await prisma.course_tables.findMany();
    res.status(200).send({
      course_tables: result,
      message: "Get full course table package",
    });
    console.log("Get full course table package.");
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: err });
    await reportAPIError({
      method: "GET",
      route: "/course_tables",
      reqBody: req.body,
      error: err,
    });
  }
});

// API version: 2.0
router.get("/:id", async (req, res) => {
  let course_table_id = req.params.id;
  let result;
  try {
    result = await prisma.course_tables.findUnique({
      where: {
        id: course_table_id,
      },
    });
    if (!result) {
      res.status(404).send({ message: "Course table not found." });
      return;
    }
    if (result.semester != active_semester) {
      res
        .status(403)
        .send({ message: "Course table semester is not active semester." });
      return;
    }
    let user_id = result.user_id;
    let expire_time = result.expire_ts;
    if (!user_id && new Date() > expire_time) {
      res
        .status(403)
        .send({ course_table: null, message: "this course table is expired" });
    } else {
      result.courses = await getCoursesbyIds(result.courses, true);
      res
        .status(200)
        .send({ course_table: result, message: "get course table" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: err });
    await reportAPIError({
      method: "GET",
      route: "/course_tables/:id",
      reqBody: req.body,
      error: err,
    });
  }
});

// API version: 2.0
router.post("/", async (req, res) => {
  // TODO: spawn uuid in backend instead of using frontend input
  const course_table_id = req.body.id;
  const course_table_name = req.body.name;
  const user_id = req.body.user_id;
  const semester = req.body.semester;
  if (!semester || semester != active_semester) {
    res.status(403).send({ message: "Semester is not active semester." });
    return;
  }

  let existing;

  try {
    existing = await prisma.course_tables.findUnique({
      where: { id: course_table_id },
    });
    if (existing) {
      console.log("course table is existing");
      res
        .status(400)
        .send({ course_table: existing, message: "course table is existing" });
      return;
    } else {
      var expire_time = new Date();
      expire_time.setDate(expire_time.getDate() + 1);
      const new_course_table = await prisma.course_tables.create({
        data: {
          id: course_table_id,
          name: course_table_name,
          user_id: user_id,
          semester: semester,
          courses: [],
          expire_ts: user_id ? null : expire_time,
        },
      });
      res.status(200).send({
        course_table: new_course_table,
        message: "create course table successfully",
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: err });
    await reportAPIError({
      method: "POST",
      route: "/course_tables/",
      reqBody: req.body,
      error: err,
    });
  }
});

// API version: 2.0
router.patch("/:id", async (req, res) => {
  const _id = req.params.id;
  const name = req.body.name;
  const user_id = req.body.user_id;
  const courses = req.body.courses;
  const current_ts = new Date();

  try {
    let target = await prisma.course_tables.findUnique({ where: { id: _id } });
    if (!target) {
      res
        .status(404)
        .send({ course_table: null, message: "Course table not found." });
      return;
    }
    if (target.semester != active_semester) {
      res
        .status(403)
        .send({ message: "Course table semester is not active semester." });
      return;
    }
    for (let i = 0; i < courses.length; i++) {
      if (courses[i].substr(0, 4) != target.semester) {
        res.status(403).send({
          message:
            "Course table semester does not match course table semester.",
        });
        return;
      }
    }
    if (target.expire_ts && current_ts > target.expire_ts) {
      res
        .status(403)
        .send({ course_table: null, message: "Course table is expired" });
      return;
    }
    let new_table;
    if (user_id) {
      if (target.user_id && target.user_id !== user_id) {
        res.status(403).send({
          course_table: null,
          message: "You are not authorized to update this course table.",
        });
        return;
      }
      new_table = await prisma.course_tables.update({
        where: { id: _id },
        data: {
          name: name,
          user_id: user_id,
          courses: courses,
          expire_ts: null,
        },
      });
    } else if (!user_id) {
      new_table = await prisma.course_tables.update({
        where: { id: _id },
        data: {
          name: name,
          courses: courses,
        },
      });
    }
    new_table.courses = await getCoursesbyIds(new_table.courses, true);
    res.status(200).send({
      course_table: new_table,
      message: "Course table has been patched",
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: err });
    await reportAPIError({
      method: "PATCH",
      route: "/course_tables/:id",
      reqBody: req.body,
      error: err,
    });
  }
});

// API version: 2.0
router.delete("/:id", checkJwt, checkIsAdmin, async (req, res) => {
  const course_table_id = req.params.id;
  try {
    await prisma.course_tables.delete({ where: { id: course_table_id } });
    res.status(200).send({ message: "delete course table successfully." });
    console.log("delete course table successfully.");
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: err });
    await reportAPIError({
      method: "DELETE",
      route: "/course_tables/:id",
      reqBody: req.body,
      error: err,
    });
  }
});

export default router;
