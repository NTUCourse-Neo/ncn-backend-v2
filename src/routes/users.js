import dotenv from 'dotenv-defaults';
import express from "express";
import * as auth0_client from "../utils/auth0_client";
import { PrismaClient } from '@prisma/client';
import { checkJwt } from "../auth";
import { sendWebhookMessage } from "../utils/webhook_client";

dotenv.config();

const router = express.Router();
const prisma = new PrismaClient();


// API version: 2.0
router.get('/:id', checkJwt, async (req, res) => {
  const user_id = req.params.id;
  const token_sub = req.user.sub;
  if(token_sub !== user_id) {
    res.status(403).send({course_table: null, message: "you are not authorized to get this user data."});
    return;
  }
  try {
    const token = await auth0_client.get_token();
    const auth0_user = await auth0_client.get_user_by_id(user_id, token);
    if (!auth0_user){
      res.status(404).send({user: null, message: "User is not registered in Auth0"});
      return;
    }
    const db_user = await prisma.users.findUnique({ where: { id: user_id } });
    if(db_user){
      res.status(200).send({user: {db: db_user, auth0: auth0_user}, message: "Successfully get user by id."});
    }else{
      res.status(200).send({user: null, message: "User not found in DB."});
    }
  }
  catch (err) {
    res.status(500).send({user: null, message: err});
    const fields = [
      {name: "Component", value: "Backend API endpoint"},
      {name: "Method", value: "GET"},
      {name: "Route", value: "/users/:id"},
      {name: "Request Body", value: "```\n"+JSON.stringify(req.body)+"\n```"},
      {name: "Error Log", value: "```\n" + err + "\n```"}
    ]
    await sendWebhookMessage("error","Error occurred in ncn-backend.", fields);
    console.error(err);
  }
})

// API version: 2.0
router.post('/', checkJwt, async (req, res) => {
  const email = req.body.user.email;
  const token_sub = req.user.sub;
  try{
    if(!email){
      res.status(400).send({message: "email is required", user: null});
      return;
    }
    const db_user = await prisma.users.findUnique({ where: { email: email } });
    if(db_user){
      res.status(400).send({message: "email is already registered", user: null});
      return;
    }
    const token = await auth0_client.get_token()
    const auth0_users = await auth0_client.get_user_by_email(email, token)
    let auth0_user;
    if(auth0_users.length === 0){
      res.status(400).send({message: "email is not registered", user: null});
      return;
    }else if(auth0_users.length === 1){
      auth0_user = auth0_users[0];
    }else{
      auth0_user = auth0_users.filter(user => !user.identities.isSocial)[0];
    }
    if(token_sub !== auth0_user.user_id) {
      res.status(403).send({course_table: null, message: "you are not authorized to get this user data."});
      return;
    }
    const new_user = await prisma.users.create({
      data: {
        id: auth0_user.user_id,
        name: auth0_user.name,
        email: auth0_user.email,
        student_id: "",
        year: 0,
        major: "",
        d_major: "",
        minors: [],
        languages: [],
        favorites:[],
        course_tables: [],
        history_courses: []
      }
    });
    res.status(200).send({message: "User created", user: {db: new_user, auth0: auth0_user}});
  }catch(err){
    res.status(500).send({user: null, message: err});
    const fields = [
      {name: "Component", value: "Backend API endpoint"},
      {name: "Method", value: "POST"},
      {name: "Route", value: "/users"},
      {name: "Request Body", value: "```\n"+JSON.stringify(req.body)+"\n```"},
      {name: "Error Log", value: "```\n" + err + "\n```"}
    ]
    await sendWebhookMessage("error","Error occurred in ncn-backend.", fields);
  }
});

// API version: 2.0
router.post('/:id/course_table', checkJwt, async (req, res) => {
  const course_table_id = req.body.course_table_id;
  const user_id = req.params.id;
  const token_sub = req.user.sub;
  if(token_sub !== user_id) {
    res.status(403).send({course_table: null, message: "you are not authorized to get this user data."});
    return;
  }
  try{
    if(!course_table_id || !user_id){
      res.status(400).send({message: "course_table_id and user_id is required", user: null});
      return;
    }else{
      const token = await auth0_client.get_token()
      const auth0_user = await auth0_client.get_user_by_id(user_id, token)
      // Check if user is registered in Auth0
      if(!auth0_user){
        res.status(400).send({message: "User is not registered"});
        return;
      }
      // Check if user is registered in MongoDB
      const db_user = await prisma.users.findUnique({ where: { id: user_id } });
      if(!db_user){
        res.status(400).send({message: "User data not found"});
        return;
      }
      // check if course_table_id is already in db_user.course_tables.
      if(db_user.course_tables.includes(course_table_id)){
        res.status(400).send({message: "Course table is already linked to this user"});
        return;
      }
      // check if course_table_id is valid (is in coursetable collection).
      // check if user_id in course_table object is the same as user_id.
      const course_table = await prisma.course_tables.findUnique({ where: { id: course_table_id } });
      if(course_table.user_id && course_table.user_id !== user_id){
        res.status(400).send({message: "Course table is already linked to another user"});
        return;
      }
      // Add user id to course_table object.
      try{
        if(!course_table.user_id){
          await prisma.course_tables.update({
            where: { id: course_table_id },
            data: { 
              user_id: user_id,
              expire_ts: null,
            }
          });
        }
      }catch{
        res.status(500).send({message: "Error in saving coursetable."});
        const fields = [
          {name: "Component", value: "Backend API endpoint"},
          {name: "Method", value: "POST"},
          {name: "Route", value: "/users/:id/course_table"},
          {name: "Request Body", value: "```\n"+JSON.stringify(req.body)+"\n```"},
          {name: "Error Log", value: "```\n" + err + "\n```"}
        ]
        await sendWebhookMessage("error","Error occurred in ncn-backend.", fields);
        return;
      }
      // Add course table id to user object.
      // !if this step fails, it will set the user_id in course_table object back to null to prevent data inconsistency.
      let new_db_user;
      try{
        new_db_user = await prisma.users.update({
          where: { id: user_id },
          data: { 
            course_tables: {
              push: course_table_id
            }
          }
        });
      }catch{
        var expire_date = new Date();
        expire_date.setDate(expire_date.getDate() + 1);
        await prisma.course_tables.update({
          where: { id: course_table_id },
          data: {
            user_id: null,
            expire_ts: expire_date
          }
        });
        res.status(500).send({message: "Error in saving user data, restored coursetable data."});
        return;
      }
      res.status(200).send({message: "Successfully linked course table to user.", user: {db: new_db_user, auth0: auth0_user}});
      return;
    }
  }catch(err){
    console.error(err);
    const fields = [
      {name: "Component", value: "Backend API endpoint"},
      {name: "Method", value: "POST"},
      {name: "Route", value: "/users/:id/course_table"},
      {name: "Request Body", value: "```\n"+JSON.stringify(req.body)+"\n```"},
      {name: "Error Log", value: "```\n" + err + "\n```"}
    ]
    await sendWebhookMessage("error","Error occurred in ncn-backend.", fields);
    res.status(500).send({message: err});
  }
});

// API version: 2.0
router.patch('/', checkJwt, async (req, res) => {
  const user_id = req.user.sub;
  const patch_user = req.body.user;
  // Check if user exists
  try {
    let db_user = await prisma.users.findUnique({ where: { id: user_id } });
    if(!db_user){
      res.status(404).send({message: "User not found"});
      return;
    }
    // Check if user is registered in Auth0
    const token = await auth0_client.get_token()
    const auth0_user = await auth0_client.get_user_by_id(user_id, token)
    if (!auth0_user){
      res.status(404).send({message: "User is not registered in Auth0"});
      return;
    }
    // Check each field and update if necessary.
    let query = {};
    for(let key in patch_user){
      console.log(key);
      // Make sure client won't update _id and email.
      if(key == "_id" || key == "email" || key == "student_id"){
        res.status(400).send({message: "Cannot update _id or email and student_id."});
        return;
      }
      // If the field exists and is not the same as the one in the database, update it.
      if(key in db_user && (db_user[key] != patch_user[key])){
        query[key] = patch_user[key];
      }
    }
    // No updates.
    if(Object.keys(query).length === 0){
      res.status(200).send({message: "No update"});
      return;
    }
    // Update user in MongoDB.
    db_user = await prisma.users.update({
      where: { id: user_id },
      data: query
    });
    res.status(200).send({user:{ db:db_user, auth0: auth0_user}, message: "User updated."});
  } catch (err) {
    res.status(500).send({message: err});
    const fields = [
      {name: "Component", value: "Backend API endpoint"},
      {name: "Method", value: "PATCH"},
      {name: "Route", value: "/users"},
      {name: "Request Body", value: "```\n"+JSON.stringify(req.body)+"\n```"},
      {name: "Error Log", value: "```\n" + err + "\n```"}
    ]
    await sendWebhookMessage("error","Error occurred in ncn-backend.", fields);
    console.error(err);
  }
});

// API version: 2.0
router.delete("/profile", checkJwt, async(req, res) => {
  try{
    const user_id = req.user.sub;
    const db_user = await prisma.users.findUnique({ where: { id: user_id } });
    if(!db_user){
      res.status(400).send({message: "User profile data is not in DB."});
      return;
    }
    await prisma.users.deleteOne({ where: { id: user_id } });
    res.status(200).send({message: "Successfully deleted user profile."})
  }catch(err){
    res.status(500).send({message: err});
    const fields = [
      {name: "Component", value: "Backend API endpoint"},
      {name: "Method", value: "DELETE"},
      {name: "Route", value: "/users/profile"},
      {name: "Request Body", value: "```\n"+JSON.stringify(req.body)+"\n```"},
      {name: "Error Log", value: "```\n" + err + "\n```"}
    ]
    await sendWebhookMessage("error","Error occurred in ncn-backend.", fields);
  }
});

// API version: 2.0
router.delete("/account", checkJwt, async(req, res) => {
  try{
    const user_id = req.user.sub;
    const db_user = await prisma.users.findUnique({ where: { id: user_id } });
    if(!db_user){
      res.status(400).send({message: "User profile data is not in DB."});
      return;
    }
    const token = await auth0_client.get_token();
    const auth0_user = await auth0_client.get_user_by_id(user_id, token);
    if(!auth0_user){
      res.status(400).send({message: "User is not registered in Auth0"});
      return;
    }
    await prisma.users.deleteOne({ where: { id: user_id } });
    await auth0_client.delete_user_by_id(user_id, token);
    res.status(200).send({message: "Successfully deleted user account and profile."});
  }catch(err){
    res.status(500).send({message: err});
    const fields = [
      {name: "Component", value: "Backend API endpoint"},
      {name: "Method", value: "DELETE"},
      {name: "Route", value: "/users/account"},
      {name: "Request Body", value: "```\n"+JSON.stringify(req.body)+"\n```"},
      {name: "Error Log", value: "```\n" + err + "\n```"}
    ]
    await sendWebhookMessage("error","Error occurred in ncn-backend.", fields);
  }
});

// API version: 2.0
// TODO
router.post("/me/favorites", checkJwt, async(req, res) => {
  const user_id = req.user.sub;
  const course_ids = req.body.course_ids;
});

// API version: 2.0
// TODO
router.delete("/me/favorites/:course_id", checkJwt, async(req, res) => {
  const user_id = req.user.sub;
  const course_id = req.params.course_id;
});


export default router;