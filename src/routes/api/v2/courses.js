import { Router } from "express";
import axios from "axios";
import { checkJwt } from "@/src/middlewares/auth";
import checkIsAdmin from "@/src/middlewares/checkIsAdmin";
import { Prisma } from "@prisma/client";
import prisma from "@/prisma";
import {
  course_include_all,
  course_post_process,
  generate_course_filter,
  getCoursesbyIds,
} from "@/src/queries/courses";

// route: "/api/v2/courses"
const router = Router();

// API version: 2.0
router.get("/", checkJwt, checkIsAdmin, async (req, res, next) => {
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
    next(err);
  }
});

// API version: 2.0
router.post("/search", async (req, res, next) => {
  const { keyword, fields, filter, batch_size, offset, semester } = req.body;
  const valid_keyword_fields = [
    "name",
    "teacher",
    "serial",
    "code",
    "identifier",
  ];
  const active_semester = process.env.SEMESTER;
  if (
    !fields ||
    fields.map((field) => valid_keyword_fields.includes(field)).includes(false)
  ) {
    res.status(400).send({ message: "Invalid keyword fields." });
    return;
  }
  try {
    let conditions = generate_course_filter(filter, null);
    let find_object = {
      where: conditions,
      include: course_include_all,
      skip: offset,
      take: batch_size,
    };
    if (keyword && keyword.length !== 0) {
      console.log(`Search "${keyword}" in fields: ${fields.join(", ")}`);
      const search_conditions = [];
      fields.forEach((field) => {
        search_conditions.push({
          [field]: {
            contains: keyword,
          },
        });
      });
      conditions.AND.push({
        OR: search_conditions,
      });
    }
    conditions.AND.push({
      semester: {
        equals: semester ?? active_semester,
      },
    });
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
    next(err);
  }
});

// API version: 2.0
router.post("/ids", async (req, res, next) => {
  const { ids, sorted } = req.body;
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
    const courses = await getCoursesbyIds(ids, sorted == null ? true : sorted);
    res.status(200).send({
      courses: course_post_process(courses),
      total_count: courses.length,
    });
  } catch (err) {
    next(err);
  }
});

// API version: 2.0
router.get("/:id", async (req, res, next) => {
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
    next(err);
  }
});

// Live API below: auth token is required

// API version: 2.0
router.get("/:id/enrollinfo", checkJwt, async (req, res, next) => {
  try {
    const course_id = req.params.id;
    let course_enroll_data;
    let update_ts;
    const db_data = await prisma.course_enrollinfo.findFirst({
      where: { course_id: { equals: `${process.env.SEMESTER}_${course_id}` } },
      orderBy: { fetch_ts: "desc" },
    });
    if (!db_data || liveDataisExpired(db_data.fetch_ts)) {
      const url = `${process.env.LIVE_API_ENDPOINT}/api/v1/courses/${course_id}/enrollinfo`;
      update_ts = new Date();
      try {
        const resp = await axios.get(url);
        course_enroll_data = resp.data.course_status;
      } catch (err) {
        console.log(err);
        course_enroll_data = db_data?.content ?? null;
      }
      await prisma.course_enrollinfo.create({
        data: {
          course_id: `${process.env.SEMESTER}_${course_id}`,
          content: course_enroll_data ?? Prisma.DbNull,
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
    next(err);
  }
});

// API version: 2.0
router.get("/:id/rating", checkJwt, async (req, res, next) => {
  try {
    const course_id = req.params.id;
    let course_rating_data;
    let update_ts;
    const db_data = await prisma.course_rating.findFirst({
      where: { course_id: { equals: course_id } },
      orderBy: { fetch_ts: "desc" },
    });
    if (!db_data || liveDataisExpired(db_data.fetch_ts)) {
      const url = `${process.env.LIVE_API_ENDPOINT}/api/v1/courses/${course_id}/rating`;
      update_ts = new Date();
      try {
        const resp = await axios.get(url);
        course_rating_data = resp.data.course_rating;
      } catch (err) {
        console.log(err);
        course_rating_data = db_data?.content ?? null;
      }
      await prisma.course_rating.create({
        data: {
          course_id: course_id,
          content: course_rating_data ?? Prisma.DbNull,
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
    next(err);
  }
});

// API version: 2.0
router.get("/:id/ptt/:board", checkJwt, async (req, res, next) => {
  try {
    const course_id = req.params.id;
    const data_type = req.params.board == "review" ? 0 : 1;
    let ptt_post_data;
    let update_ts;
    const db_data = await prisma.course_ptt.findFirst({
      where: { course_id: { equals: course_id }, type: { equals: data_type } },
      orderBy: { fetch_ts: "desc" },
    });
    if (!db_data || liveDataisExpired(db_data.fetch_ts)) {
      const url = `${process.env.PTT_API_ENDPOINT}/api/v1/courses/${course_id}/ptt/${req.params.board}`;
      update_ts = new Date();
      try {
        const resp = await axios.get(url);
        ptt_post_data = resp.data.course_rating;
      } catch (err) {
        console.log(err);
        ptt_post_data = db_data?.content ?? null;
      }
      await prisma.course_ptt.upsert({
        where: {
          course_id_type: {
            course_id: course_id,
            type: data_type,
          },
        },
        update: {
          content: ptt_post_data ?? Prisma.DbNull,
          fetch_ts: update_ts,
        },
        create: {
          course_id: course_id,
          content: ptt_post_data ?? Prisma.DbNull,
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
    next(err);
  }
});

// API version: 2.0
router.get("/:id/syllabus", async (req, res, next) => {
  try {
    const course_id = req.params.id;
    let syllabus_data;
    let update_ts;
    const db_data = await prisma.course_syllabus.findFirst({
      where: { course_id: { equals: course_id } },
      orderBy: { fetch_ts: "desc" },
    });
    if (!db_data || liveDataisExpired(db_data.fetch_ts)) {
      const url = `${process.env.LIVE_API_ENDPOINT}/api/v1/courses/${course_id}/syllabus`;
      update_ts = new Date();
      try {
        const resp = await axios.get(url);
        syllabus_data = resp.data.course_syllabus;
      } catch (err) {
        console.log(err);
        syllabus_data = db_data?.content ?? null;
      }
      await prisma.course_syllabus.upsert({
        where: {
          course_id: course_id,
        },
        update: {
          content: syllabus_data ?? Prisma.DbNull,
          fetch_ts: update_ts,
        },
        create: {
          course_id: course_id,
          content: syllabus_data ?? Prisma.DbNull,
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
    next(err);
  }
});

function liveDataisExpired(expire_time) {
  const now = new Date();
  expire_time.setSeconds(
    expire_time.getSeconds() + Number(process.env.LIVE_DATA_RENEW_INTERVAL)
  );
  return now > expire_time;
}

export default router;
