import express from "express";
import search from "../utils/search";
import collection from "../utils/mongo_client";
import axios from "axios";
import { checkJwt } from "../auth";
import { PrismaClient } from "@prisma/client";
import { sendWebhookMessage } from "../utils/webhook_client";
import { course_include_all } from "../prisma/course_query";

const router = express.Router();
const prisma = new PrismaClient();

// API version: 2.0
router.get("/", async (req, res) => {
  try {
    const courses = await prisma.courses.findMany({
      include: course_include_all,
    });
    res.status(200).send({
      courses: course_post_process(courses),
      message: "Successfully retrieved all courses.",
    });
    console.log("Get full courses package.");
  } catch (err) {
    res.status(500).send({ message: err });
    const fields = [
      { name: "Component", value: "Backend API endpoint" },
      { name: "Method", value: "GET" },
      { name: "Route", value: "/courses/" },
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
router.post("/search", async (req, res) => {
  const keyword = req.body.keyword;
  const filter = req.body.filter;
  const batch_size = req.body.batch_size;
  const offset = req.body.offset;

  try {
    let conditions = generate_course_filter(filter, null);
    let find_object = {
      where: conditions,
      include: course_include_all,
      skip: offset,
      take: batch_size,
    };
    if (keyword && keyword.length !== 0) {
      console.log("keyword provided.");
      conditions.AND.push({
        name: {
          contains: keyword,
        },
      });
      find_object["orderBy"] = {
        _relevance: {
          fields: ["name"],
          search: keyword,
          sort: "asc",
        },
      };
    }
    const courses = await prisma.courses.findMany(find_object);
    const course_cnt = await prisma.courses.count({
      where: conditions,
    });
    if (courses) {
      res.status(200).send({
        courses: course_post_process(courses),
        total_count: course_cnt,
      });
    } else {
      res.status(200).send({ courses: [], total_count: 0 });
    }
  } catch (err) {
    res.status(500).send({ message: "Internal Server Error", log: err });
    const fields = [
      { name: "Component", value: "Backend API endpoint" },
      { name: "Method", value: "POST" },
      { name: "Route", value: "/courses/search" },
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
router.post("/ids", async (req, res) => {
  const ids = req.body.ids;
  const filter = req.body.filter;
  const batch_size = req.body.batch_size;
  const offset = req.body.offset;

  if (ids.length === 0) {
    console.log("No ids provided.");
    res.status(200).send({ courses: [], total_count: 0 });
    return;
  } else if (ids.length >= process.env.COURSE_REQUEST_LIMIT) {
    console.log("Request course ids size exceeds limit.");
    res
      .status(400)
      .send({ courses: [], message: "Request course ids size exceeds limit." });
    return;
  }
  try {
    const conditions = generate_course_filter(filter, ids);
    const courses = await prisma.courses.findMany({
      where: conditions,
      include: course_include_all,
      skip: offset,
      take: batch_size,
    });
    const course_cnt = await prisma.courses.count({
      where: conditions,
    });
    if (courses) {
      const courseObjects = course_post_process(courses);
      const coursesSortByIds = ids.map((id) =>
        courseObjects.find((course) => course.id === id)
      );
      res.status(200).send({
        courses: coursesSortByIds,
        total_count: course_cnt,
      });
    } else {
      res.status(200).send({ courses: [], total_count: 0 });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: err });
    const fields = [
      { name: "Component", value: "Backend API endpoint" },
      { name: "Method", value: "POST" },
      { name: "Route", value: "/courses/ids" },
      {
        name: "Request Body",
        value: "```\n" + JSON.stringify(req.body) + "\n```",
      },
      { name: "Error Log", value: "```\n" + err + "\n```" },
    ];
    await sendWebhookMessage("error", "Error occurred in ncn-backend.", fields);
  }
});

// API version: 2.0
router.get("/:id", async (req, res) => {
  try {
    const course_id = req.params.id;
    const course = await prisma.courses.findUnique({
      where: { id: course_id },
      include: course_include_all,
    });
    if (!course) {
      res.status(404).send({ message: "Course not found." });
      return;
    }
    res.status(200).send({
      course: course_post_process([course])[0],
      message: "Successfully retrieved course.",
    });
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: err });
    const fields = [
      { name: "Component", value: "Backend API endpoint" },
      { name: "Method", value: "GET" },
      { name: "Route", value: "/courses/:id" },
      { name: "Error Log", value: "```\n" + err + "\n```" },
    ];
    await sendWebhookMessage("error", "Error occurred in ncn-backend.", fields);
  }
});

// Live API below: auth token is required

// API version: 2.0
router.get("/:id/enrollinfo", checkJwt, async (req, res) => {
  try {
    const course_id = req.params.id;
    let course_enroll_data;
    let update_ts;
    const db_data = await prisma.course_enrollinfo.findFirst({
      where: { course_id: { equals: `${process.env.SEMESTER}_${course_id}` } },
      orderBy: { fetch_ts: "desc" },
    });
    if (!db_data || isExpired(db_data.fetch_ts)) {
      const url = `${process.env.LIVE_API_ENDPOINT}/api/v1/courses/${course_id}/enrollinfo`;
      update_ts = new Date();
      try {
        const resp = await axios.get(url);
        course_enroll_data = resp.data.course_status;
      } catch (err) {
        console.log(err);
        course_enroll_data = db_data ? db_data.content : {};
      }
      await prisma.course_enrollinfo.create({
        data: {
          course_id: `${process.env.SEMESTER}_${course_id}`,
          content: course_enroll_data ? course_enroll_data : {},
          fetch_ts: update_ts,
        },
      });
    } else {
      course_enroll_data = db_data.content;
      update_ts = db_data.fetch_ts;
    }
    res.status(200).send({
      course_id: `${process.env.SEMESTER}_${course_id}`,
      course_status: course_enroll_data,
      update_ts: update_ts,
      message: "Successfully retrieved course enroll info.",
    });
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: err });
    const fields = [
      { name: "Component", value: "Backend API endpoint" },
      { name: "Method", value: "GET" },
      { name: "Route", value: "/courses/:id/enrollinfo" },
      { name: "Error Log", value: "```\n" + err + "\n```" },
    ];
    await sendWebhookMessage("error", "Error occurred in ncn-backend.", fields);
  }
});

// API version: 2.0
router.get("/:id/rating", checkJwt, async (req, res) => {
  try {
    const course_id = req.params.id;
    let course_rating_data;
    let update_ts;
    const db_data = await prisma.course_rating.findFirst({
      where: { course_id: { equals: course_id } },
      orderBy: { fetch_ts: "desc" },
    });
    if (!db_data || isExpired(db_data.fetch_ts)) {
      const url = `${process.env.LIVE_API_ENDPOINT}/api/v1/courses/${course_id}/rating`;
      update_ts = new Date();
      try {
        const resp = await axios.get(url);
        course_rating_data = resp.data.course_rating;
      } catch (err) {
        console.log(err);
        course_rating_data = db_data ? db_data.content : {};
      }
      await prisma.course_rating.create({
        data: {
          course_id: course_id,
          content: course_rating_data ? course_rating_data : undefined,
          fetch_ts: update_ts,
        },
      });
    } else {
      course_rating_data = db_data.content;
      update_ts = db_data.fetch_ts;
    }
    res.status(200).send({
      course_id: course_id,
      course_rating: course_rating_data,
      update_ts: update_ts,
      message: "Successfully retrieved course rating info.",
    });
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: err });
    const fields = [
      { name: "Component", value: "Backend API endpoint" },
      { name: "Method", value: "GET" },
      { name: "Route", value: "/courses/:id/rating" },
      { name: "Error Log", value: "```\n" + err + "\n```" },
    ];
    await sendWebhookMessage("error", "Error occurred in ncn-backend.", fields);
  }
});

// API version: 2.0
router.get("/:id/ptt/:board", checkJwt, async (req, res) => {
  try {
    const course_id = req.params.id;
    const data_type = req.params.board == "review" ? 0 : 1;
    let ptt_post_data;
    let update_ts;
    const db_data = await prisma.course_ptt.findFirst({
      where: { course_id: { equals: course_id }, type: { equals: data_type } },
      orderBy: { fetch_ts: "desc" },
    });
    if (!db_data || isExpired(db_data.fetch_ts)) {
      const url = `${process.env.PTT_API_ENDPOINT}/api/v1/courses/${course_id}/ptt/${req.params.board}`;
      update_ts = new Date();
      try {
        const resp = await axios.get(url);
        ptt_post_data = resp.data.course_rating;
      } catch (err) {
        console.log(err);
        ptt_post_data = db_data ? db_data.content : {};
      }
      await prisma.course_ptt.upsert({
        where: {
          course_id_type: {
            course_id: course_id,
            type: data_type,
          },
        },
        update: {
          content: ptt_post_data ? ptt_post_data : {},
          fetch_ts: update_ts,
        },
        create: {
          course_id: course_id,
          content: ptt_post_data ? ptt_post_data : {},
          type: data_type,
          fetch_ts: update_ts,
        },
      });
    } else {
      ptt_post_data = db_data.content;
      update_ts = db_data.fetch_ts;
    }
    res.status(200).send({
      course_id: course_id,
      course_rating: ptt_post_data,
      update_ts: update_ts,
      message: "Successfully retrieved course ptt post info.",
    });
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: err });
    const fields = [
      { name: "Component", value: "Backend API endpoint" },
      { name: "Method", value: "GET" },
      { name: "Route", value: "/courses/:id/ptt/:board" },
      { name: "Error Log", value: "```\n" + err + "\n```" },
    ];
    await sendWebhookMessage("error", "Error occurred in ncn-backend.", fields);
  }
});

// API version: 2.0
router.get("/:id/syllabus", async (req, res) => {
  try {
    const course_id = req.params.id;
    let syllabus_data;
    let update_ts;
    const db_data = await prisma.course_syllabus.findFirst({
      where: { course_id: { equals: course_id } },
      orderBy: { fetch_ts: "desc" },
    });
    if (!db_data || isExpired(db_data.fetch_ts)) {
      const url = `${process.env.LIVE_API_ENDPOINT}/api/v1/courses/${course_id}/syllabus`;
      update_ts = new Date();
      try {
        const resp = await axios.get(url);
        syllabus_data = resp.data.course_syllabus;
      } catch (err) {
        console.log(err);
        syllabus_data = db_data ? db_data.content : {};
      }
      await prisma.course_syllabus.upsert({
        where: {
          course_id: course_id,
        },
        update: {
          content: syllabus_data ? syllabus_data : {},
          fetch_ts: update_ts,
        },
        create: {
          course_id: course_id,
          content: syllabus_data ? syllabus_data : {},
          fetch_ts: update_ts,
        },
      });
    } else {
      syllabus_data = db_data.content;
      update_ts = db_data.fetch_ts;
    }
    res.status(200).send({
      course_id: course_id,
      course_syllabus: syllabus_data,
      update_ts: update_ts,
      message: "Successfully retrieved course syllabus.",
    });
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: err });
    const fields = [
      { name: "Component", value: "Backend API endpoint" },
      { name: "Method", value: "GET" },
      { name: "Route", value: "/courses/:id/syllabus" },
      { name: "Error Log", value: "```\n" + err + "\n```" },
    ];
    await sendWebhookMessage("error", "Error occurred in ncn-backend.", fields);
  }
});

function isExpired(expire_time) {
  const now = new Date();
  expire_time.setSeconds(
    expire_time.getSeconds() + Number(process.env.LIVE_DATA_RENEW_INTERVAL)
  );
  return now > expire_time;
}

function generate_course_filter(filter, ids = null) {
  const strict_match = filter.strict_match;
  const time = filter.time;
  const department = filter.department;
  const area = filter.category;
  const enroll_method = filter.enroll_method;
  let filters = [];
  if (time) {
    let schedules = { OR: [] };
    time.forEach((intervals, index) => {
      if (intervals.length !== 0) {
        schedules.OR.push({
          schedules: {
            some: {
              weekday: { equals: index + 1 },
              interval: { in: intervals },
            },
          },
        });
      }
      filters.push(schedules);
    });
  }
  if (department) {
    filters.push({
      departments: {
        some: {
          department_id: { in: department },
        },
      },
    });
  }
  if (area) {
    filters.push({
      areas: {
        some: {
          area_id: { in: area },
        },
      },
    });
  }

  let where_condition = { AND: [] };
  if (ids) {
    where_condition.AND.push({
      id: { in: ids },
    });
  }
  if (enroll_method) {
    where_condition.AND.push({
      enroll_method: {
        in: enroll_method.map((method) => Number(method)),
      },
    });
  }
  if (strict_match) {
    where_condition.AND.push({ AND: filters });
  } else {
    where_condition.AND.push({ OR: filters });
  }
  return where_condition;
}

function course_post_process(courses) {
  courses.forEach((course) => {
    course.departments = course.departments.map((d) => {
      return d.department;
    });
    course.departments_raw.forEach((name) => {
      course.departments.push({
        id: null,
        college_id: null,
        name_short: null,
        name_full: name,
        name_alt: null,
      });
    });
    delete course.departments_raw;
  });
  return courses;
}

export default router;
