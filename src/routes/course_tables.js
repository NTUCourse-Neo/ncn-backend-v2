import express from "express";
import { PrismaClient } from "@prisma/client";
import { sendWebhookMessage } from "../utils/webhook_client";
import { checkJwt } from "../auth";
import * as auth0_client from "../utils/auth0_client";
import { getCoursesbyIds } from "../prisma/course_query";

const prisma = new PrismaClient();
const router = express.Router();

const check_is_admin = async (user_id) => {
  const token = await auth0_client.get_token();
  const user_roles = await auth0_client.get_user_meta_roles(user_id, token);
  return user_roles.includes("admin");
};

// API version: 2.0
router.get("/", checkJwt, async (req, res) => {
  if (!(await check_is_admin(req.user.sub))) {
    res.status(403).send({
      course_table: null,
      message: "You are not authorized to get this data.",
    });
    return;
  }
  let result;
  try {
    result = await prisma.course_tables.findMany();
    res
      .status(200)
      .send({ course_table: result, message: "Get full course table package" });
    console.log("Get full course table package.");
  } catch (err) {
    res.status(500).send({ coures_table: null, message: err });
    const fields = [
      { name: "Component", value: "Backend API endpoint" },
      { name: "Method", value: "GET" },
      { name: "Route", value: "/course_tables/" },
      {
        name: "Request Body",
        value: "```\n" + JSON.stringify(req.body) + "\n```",
      },
      { name: "Error Log", value: "```\n" + err + "\n```" },
    ];
    await sendWebhookMessage("error", "Error occurred in ncn-backend.", fields);
    console.error(err);
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
    console.log(err);
    res.status(500).send({ course_table: null, message: err });
    const fields = [
      { name: "Component", value: "Backend API endpoint" },
      { name: "Method", value: "GET" },
      { name: "Route", value: "/course_tables/:id" },
      {
        name: "Request Body",
        value: "```\n" + JSON.stringify(req.body) + "\n```",
      },
      { name: "Error Log", value: "```\n" + err + "\n```" },
    ];
    await sendWebhookMessage("error", "Error occurred in ncn-backend.", fields);
    console.error(err);
  }
});

// API version: 2.0
router.post("/", async (req, res) => {
  const course_table_id = req.body.id;
  const course_table_name = req.body.name;
  const user_id = req.body.user_id;
  const semester = req.body.semester;

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
    res.status(500).send({ course_table: null, message: err });
    const fields = [
      { name: "Component", value: "Backend API endpoint" },
      { name: "Method", value: "POST" },
      { name: "Route", value: "/course_tables/" },
      {
        name: "Request Body",
        value: "```\n" + JSON.stringify(req.body) + "\n```",
      },
      { name: "Error Log", value: "```\n" + err + "\n```" },
    ];
    await sendWebhookMessage("error", "Error occurred in ncn-backend.", fields);
    console.error(err);
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
        .status(200)
        .send({ course_table: null, message: "Course table not found." });
      return;
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
    new_table.courses = await getCoursesbyIds(new_table.courses, true);;
    res.status(200).send({
      course_table: new_table,
      message: "Course table has been patched",
    });
  } catch (err) {
    res.status(500).send({ course_table: null, message: err });
    const fields = [
      { name: "Component", value: "Backend API endpoint" },
      { name: "Method", value: "PATCH" },
      { name: "Route", value: "/course_tables/:id" },
      {
        name: "Request Body",
        value: "```\n" + JSON.stringify(req.body) + "\n```",
      },
      { name: "Error Log", value: "```\n" + err + "\n```" },
    ];
    await sendWebhookMessage("error", "Error occurred in ncn-backend.", fields);
    console.error(err);
  }
});

// API version: 2.0
router.delete("/:id", checkJwt, async (req, res) => {
  if (!(await check_is_admin(req.user.sub))) {
    res.status(403).send({
      course_table: null,
      message: "You are not authorized to get this data.",
    });
    return;
  }
  const course_table_id = req.params.id;
  try {
    await prisma.course_tables.delete({ where: { id: course_table_id } });
    res.status(200).send({ message: "delete course table successfully." });
    console.log("delete course table successfully.");
  } catch (err) {
    res.status(500).send({ message: err });
    const fields = [
      { name: "Component", value: "Backend API endpoint" },
      { name: "Method", value: "DELETE" },
      { name: "Route", value: "/course_tables/:id" },
      {
        name: "Request Body",
        value: "```\n" + JSON.stringify(req.body) + "\n```",
      },
      { name: "Error Log", value: "```\n" + err + "\n```" },
    ];
    await sendWebhookMessage("error", "Error occurred in ncn-backend.", fields);
    console.error(err);
  }
});

export default router;
