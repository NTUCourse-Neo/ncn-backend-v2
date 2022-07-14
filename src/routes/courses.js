import express from "express";
import search from '../utils/search';
import collection from "../utils/mongo_client";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import { sendWebhookMessage } from "../utils/webhook_client";
import { course_include_all } from "../prisma/course_query";

const router = express.Router();
const prisma = new PrismaClient();

// API version: 2.0
router.get('/', async (req, res) => {
    try {
      const courses = await prisma.courses.findMany({ include: course_include_all });
      res.status(200).send({courses: courses, message: "Successfully retrieved all courses."});
      console.log('Get full courses package.');
    }
    catch (err) {
      res.status(500).send({message: err})
      const fields = [
          {name: "Component", value: "Backend API endpoint"},
          {name: "Method", value: "GET"},
          {name: "Route", value: "/courses/"},
          {name: "Request Body", value: "```\n"+JSON.stringify(req.body)+"\n```"},
          {name: "Error Log", value: "```\n" + err + "\n```"}
      ]
      await sendWebhookMessage("error","Error occurred in ncn-backend.", fields);
      console.error(err);
    }
});

// API version: 2.0
router.post('/', async (req, res) => {
  const filter = req.body.filter;
  const batch_size = req.body.batch_size;
  const offset = req.body.offset;

  try {
    const conditions = generate_course_filter(filter);
    const courses = await prisma.courses.findMany({
      where: conditions,
      include: course_include_all,
      skip: offset,
      take: batch_size
    });
    if(courses){
      res.status(200).send({courses: courses, total_count: courses.length});
    }else{
      res.status(200).send({courses: [], total_count: 0});
    }
  }
  catch (err) {
    console.error(err);
    res.status(500).send({message: err});
    const fields = [
      {name: "Component", value: "Backend API endpoint"},
      {name: "Method", value: "POST"},
      {name: "Route", value: "/courses/ids"},
      {name: "Request Body", value: "```\n"+JSON.stringify(req.body)+"\n```"},
      {name: "Error Log", value: "```\n" + err + "\n```"}
    ];
    await sendWebhookMessage("error","Error occurred in ncn-backend.", fields);
  }

});

// API version: 2.0
router.post('/search', async (req, res) => {
    const query = req.body.query;
    const paths = req.body.paths;

    try {
      if (query === "" || !query) {
        // if query is empty, return all courses
        const courses_pack = await prisma.courses.findMany({ select: { id: true }});
        let result = courses_pack.map(a => a.id);
        res.status(200).send({ids: result});
      }
      else {
        const result = await search(query, paths, collection);
        res.status(200).send({ ids: result });
      }
    }
    catch (err) {
      res.status(500).send({message: "Internal Server Error", log: err})
      const fields = [
        {name: "Component", value: "Backend API endpoint"},
        {name: "Method", value: "POST"},
        {name: "Route", value: "/courses/search"},
        {name: "Request Body", value: "```\n"+JSON.stringify(req.body)+"\n```"},
        {name: "Error Log", value: "```\n" + err + "\n```"}
      ]
      await sendWebhookMessage("error","Error occurred in ncn-backend.", fields);
      console.error(err);
    }
});

// API version: 2.0
router.post('/ids', async (req, res) => {
  const ids = req.body.ids;
  const filter = req.body.filter;
  const batch_size = req.body.batch_size;
  const offset = req.body.offset;

  
  if(ids.length === 0) {
    console.log('No ids provided.');
    res.status(200).send({courses: [], total_count: 0});
    return;
  }
  else if(ids.length >= process.env.COURSE_REQUEST_LIMIT) {
    console.log('Request course ids size exceeds limit.');
    res.status(400).send({courses: [], message: 'Request course ids size exceeds limit.'});
    return;
  }
  try {
    const conditions = generate_course_filter(filter, ids);
    const courses = await prisma.courses.findMany({
      where: conditions,
      include: course_include_all,
      skip: offset,
      take: batch_size
    });
    if(courses){
      res.status(200).send({courses: courses, total_count: courses.length});
    }else{
      res.status(200).send({courses: [], total_count: 0});
    }

  }
  catch (err) {
    console.error(err);
    res.status(500).send({message: err});
    const fields = [
      {name: "Component", value: "Backend API endpoint"},
      {name: "Method", value: "POST"},
      {name: "Route", value: "/courses/ids"},
      {name: "Request Body", value: "```\n"+JSON.stringify(req.body)+"\n```"},
      {name: "Error Log", value: "```\n" + err + "\n```"}
    ];
    await sendWebhookMessage("error","Error occurred in ncn-backend.", fields);
  }

});

// API version: 2.0
router.get('/:id', async (req, res) => {
  try {
    const course_id = req.params.id;
    const course = await prisma.courses.findUnique({ 
      where: { id: course_id },
      include: course_include_all
    });
    if(!course) {
      res.status(404).send({message: "Course not found."});
      return;
    }
    res.status(200).send({
      course: course,
      message: "Successfully retrieved course."
    });
  }
  catch (err) {
    console.log(err);
    res.status(500).send({message: err});
    const fields = [
      {name: "Component", value: "Backend API endpoint"},
      {name: "Method", value: "GET"},
      {name: "Route", value: "/courses/:id"},
      {name: "Error Log", value: "```\n" + err + "\n```"}
    ];
    await sendWebhookMessage("error","Error occurred in ncn-backend.", fields);
  }
});

// API version: 2.0
router.get('/:id/enrollinfo', async (req, res) => {
  try{
    const course_id = req.params.id;
    let course_enroll_data;
    const db_data = await prisma.course_enrollinfo.findFirst({
      where: { course_id: { equals: `${process.env.SEMESTER}_${course_id}` } },
      orderBy: { fetch_ts: 'desc' },
    })
    if(!db_data || isExpired(db_data.fetch_ts) ) {
      const url = `${process.env.LIVE_API_ENDPOINT}/api/v1/courses/${course_id}/enrollinfo`;
      try{
        const resp = await axios.get(url);
        course_enroll_data = resp.data.course_status
      }catch(err){
        console.log(err);
        course_enroll_data = db_data ? db_data.content : null;
      }
      await prisma.course_enrollinfo.create({
        data: {
          course_id: `${process.env.SEMESTER}_${course_id}`,
          content: course_enroll_data,
          fetch_ts: new Date()
        }
      });
    }else{
      course_enroll_data = db_data.content;
    }
    res.status(200).send({
      course_id: `${process.env.SEMESTER}_${course_id}`,
      course_status: course_enroll_data,
      message: "Successfully retrieved course enroll info."
    });

  }catch(err){
    console.log(err);
    res.status(500).send({message: err});
    const fields = [
      {name: "Component", value: "Backend API endpoint"},
      {name: "Method", value: "GET"},
      {name: "Route", value: "/courses/:id/enrollinfo"},
      {name: "Error Log", value: "```\n" + err + "\n```"}
    ];
    await sendWebhookMessage("error","Error occurred in ncn-backend.", fields);
  }
});

// API version: 2.0
// TODO
router.get('/:id/rating', async (req, res) => {
  const course_id = req.params.id;

});

// API version: 2.0
// TODO
router.get('/:id/ptt/:board', async (req, res) => {
  const course_id = req.params.id;
  const ptt_board = req.params.board;
});

// API version: 2.0
// TODO
router.get('/:id/syllabus', async (req, res) => {
  const course_id = req.params.id;
});

function isExpired(expire_time){
  const now = new Date();
  expire_time.setSeconds(expire_time.getSeconds() + Number(process.env.LIVE_DATA_RENEW_INTERVAL));
  return now > expire_time;
}

function generate_course_filter (filter, ids=null) {
  const strict_match = filter.strict_match;
  const time = filter.time;
  const department = filter.department;
  const area = filter.category;
  const enroll_method = filter.enroll_method;
  let filters = [];
  if(time) {
    let schedules = {OR: []}
    time.forEach((intervals, index) => {
      if(intervals.length !== 0) {
        schedules.OR.push({
          schedules: {
            some: {
              weekday: { equals: index+1 },
              interval: { in: intervals }
            }
          }
        })
      }
      filters.push(schedules);
    });
  }
  if(department) {
    filters.push({
      departments: {
        some: {
          department_id: {in: department}
        }
      }
    });
  }
  if(area) {
    filters.push({
      areas: {
        some: {
          area_id: {in: area}
        }
      }
    });
  }
  
  let where_condition = { AND:[] };
  if(ids) {
    where_condition.AND.push({
      id: {in: ids}
    });
  }
  if(enroll_method) {
    where_condition.AND.push({
      enroll_method: {
        in: enroll_method.map(method => Number(method))
      }
    });
  }
  if(strict_match) {
    where_condition.AND.push({AND: filters});
  }else{
    where_condition.AND.push({OR: filters});
  }
  return where_condition;
}

export default router;