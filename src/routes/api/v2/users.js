import { Router } from "express";
import prisma from "@/prisma";
import { checkJwt } from "@/src/middlewares/auth";
import auth0Client from "@/src/utils/auth0Client";
import { getCoursesbyIds } from "@/src/queries/courses";

// route: "/api/v2/users"
const router = Router();

// API version: 2.0
router.get("/:id", checkJwt, async (req, res, next) => {
  try {
    const user_id = req.params.id;
    const token_sub = req.user.sub;
    if (token_sub !== user_id) {
      res.status(403).send({
        course_table: null,
        message: "you are not authorized to get this user data.",
      });
      return;
    }
    let db_user = await prisma.users.findUnique({
      where: { id: user_id },
      include: {
        major_dept: true,
        d_major_dept: true,
      },
    });
    if (db_user) {
      db_user = await process_user_info(db_user);
      res.status(200).send({
        user: { db: db_user },
        message: "Successfully get user by id.",
      });
    } else {
      res.status(200).send({ user: null, message: "User not found in DB." });
    }
  } catch (err) {
    next(err);
  }
});

// API version: 2.0
// Checks Auth0 user instance.
router.post("/", checkJwt, async (req, res, next) => {
  try {
    const email = req.body.user.email;
    const token_sub = req.user.sub;
    if (!email) {
      res.status(400).send({ message: "email is required", user: null });
      return;
    }
    const db_user = await prisma.users.findFirst({ where: { email: email } }); // workaround here bcz email is not unique, so can't use findUnique
    if (db_user) {
      res
        .status(400)
        .send({ message: "email is already registered", user: null });
      return;
    }
    const auth0_users = await auth0Client.getUsersByEmail(email);
    let auth0_user;
    if (auth0_users.length === 0) {
      res.status(400).send({ message: "email is not registered", user: null });
      return;
    } else if (auth0_users.length === 1) {
      auth0_user = auth0_users[0];
    } else {
      auth0_user = auth0_users.filter((user) => !user.identities.isSocial)[0];
    }
    if (token_sub !== auth0_user.user_id) {
      res.status(403).send({
        user: null,
        message: "you are not authorized to get this user data.",
      });
      return;
    }
    let new_user = await prisma.users.create({
      data: {
        id: auth0_user.user_id,
        name: auth0_user.name,
        email: auth0_user.email,
        student_id: null,
        year: 0,
        major: null,
        d_major: null,
        minors: [],
        favorites: [],
        course_tables: [],
        history_courses: [],
      },
      include: {
        major_dept: true,
        d_major_dept: true,
      },
    });
    new_user = await process_user_info(new_user);
    res.status(200).send({
      message: "User created",
      user: { db: new_user },
    });
  } catch (err) {
    next(err);
  }
});

// API version: 2.0
router.post("/:id/course_table", checkJwt, async (req, res, next) => {
  const course_table_id = req.body.course_table_id;
  const user_id = req.params.id;
  const token_sub = req.user.sub;
  if (token_sub !== user_id) {
    res.status(403).send({
      course_table: null,
      message: "you are not authorized to get this user data.",
    });
    return;
  }
  try {
    if (!course_table_id || !user_id) {
      res.status(400).send({
        message: "course_table_id and user_id is required",
        user: null,
      });
      return;
    } else {
      // Check if user is registered in MongoDB
      const db_user = await prisma.users.findUnique({ where: { id: user_id } });
      if (!db_user) {
        res.status(400).send({ message: "User data not found" });
        return;
      }
      // check if course_table_id is already in db_user.course_tables.
      if (db_user.course_tables.includes(course_table_id)) {
        res
          .status(400)
          .send({ message: "Course table is already linked to this user" });
        return;
      }
      // check if course_table_id is valid (is in coursetable collection).
      // check if user_id in course_table object is the same as user_id.
      const course_table = await prisma.course_tables.findUnique({
        where: { id: course_table_id },
      });
      if (course_table.user_id && course_table.user_id !== user_id) {
        res
          .status(400)
          .send({ message: "Course table is already linked to another user" });
        return;
      }
      // Add user id to course_table object.
      try {
        if (!course_table.user_id) {
          await prisma.course_tables.update({
            where: { id: course_table_id },
            data: {
              user_id: user_id,
              expire_ts: null,
            },
          });
        }
      } catch {
        next(err);
      }
      // Add course table id to user object.
      // !if this step fails, it will set the user_id in course_table object back to null to prevent data inconsistency.
      let new_db_user;
      try {
        new_db_user = await prisma.users.update({
          where: { id: user_id },
          data: {
            course_tables: {
              push: course_table_id,
            },
          },
          include: {
            major_dept: true,
            d_major_dept: true,
          },
        });
      } catch {
        var expire_date = new Date();
        expire_date.setDate(expire_date.getDate() + 1);
        await prisma.course_tables.update({
          where: { id: course_table_id },
          data: {
            user_id: null,
            expire_ts: expire_date,
          },
        });
        res.status(500).send({
          message: "Error in saving user data, restored coursetable data.",
        });
        return;
      }
      new_db_user = await process_user_info(new_db_user);
      res.status(200).send({
        message: "Successfully linked course table to user.",
        user: { db: new_db_user },
      });
      return;
    }
  } catch (err) {
    next(err);
  }
});

// API version: 2.0
router.patch("/", checkJwt, async (req, res, next) => {
  const user_id = req.user.sub;
  const patch_user = req.body.user;
  // Check if user exists
  try {
    let db_user = await prisma.users.findUnique({
      where: { id: user_id },
      include: {
        major_dept: true,
        d_major_dept: true,
      },
    });
    if (!db_user) {
      res.status(404).send({ message: "User not found" });
      return;
    }
    // Check each field and update if necessary.
    let query = {};
    for (let key in patch_user) {
      console.log(key);
      // Make sure client won't update _id and email.
      if (key == "_id" || key == "email" || key == "student_id") {
        res
          .status(400)
          .send({ message: "Cannot update _id or email and student_id." });
        return;
      }
      // If the field exists and is not the same as the one in the database, update it.
      if (key in db_user && db_user[key] != patch_user[key]) {
        query[key] = patch_user[key];
      }
    }
    // No updates.
    if (Object.keys(query).length === 0) {
      db_user = await process_user_info(db_user);
      res.status(200).send({
        user: { db: db_user },
        message: "No update",
      });
      return;
    }
    // Update user in MongoDB.
    db_user = await prisma.users.update({
      where: { id: user_id },
      data: query,
      include: {
        major_dept: true,
        d_major_dept: true,
      },
    });
    db_user = await process_user_info(db_user);
    res.status(200).send({
      user: { db: db_user },
      message: "User updated.",
    });
  } catch (err) {
    next(err);
  }
});

// API version: 2.0
router.delete("/profile", checkJwt, async (req, res, next) => {
  try {
    const user_id = req.user.sub;
    const db_user = await prisma.users.findUnique({ where: { id: user_id } });
    if (!db_user) {
      res.status(400).send({ message: "User profile data is not in DB." });
      return;
    }
    await prisma.users.delete({ where: { id: user_id } });
    res.status(200).send({ message: "Successfully deleted user profile." });
  } catch (err) {
    next(err);
  }
});

// API version: 2.0
// Checks Auth0 user instance.
router.delete("/account", checkJwt, async (req, res, next) => {
  try {
    const user_id = req.user.sub;
    const db_user = await prisma.users.findUnique({ where: { id: user_id } });
    if (!db_user) {
      res.status(400).send({ message: "User profile data is not in DB." });
      return;
    }
    const auth0_user = await auth0Client.getUser({ id: user_id });
    if (!auth0_user) {
      res.status(400).send({ message: "User is not registered in Auth0" });
      return;
    }
    await prisma.users.delete({ where: { id: user_id } });
    await auth0Client.deleteUser({ id: user_id });
    res
      .status(200)
      .send({ message: "Successfully deleted user account and profile." });
  } catch (err) {
    next(err);
  }
});

// API version: 2.0
router.put("/favorites/:course_id", checkJwt, async (req, res, next) => {
  try {
    const user_id = req.user.sub;
    const course_id = req.params.course_id;
    let { favorites } = await prisma.users.findUnique({
      where: { id: user_id },
    });
    if (favorites.includes(course_id)) {
      res.status(400).send({ message: "Course is already in favorites." });
      return;
    }
    const course = await prisma.courses.findUnique({ where: { id: course_id } });
    if (!course) {
      res.status(400).send({ message: "Course not found." });
      return;
    }
    ({ favorites } = await prisma.users.update({
      where: { id: user_id },
      data: {
        favorites: {
          push: course_id,
        },
      },
      include: {
        major_dept: true,
        d_major_dept: true,
      },
    }));
    favorites = await getCoursesbyIds(favorites, false);
    res.status(200).send({
      favorites: favorites,
      message: "Course added to favorites.",
    });
  } catch (err) {
    next(err);
  }
});

// API version: 2.0
router.delete("/favorites/:course_id", checkJwt, async (req, res, next) => {
  try {
    const user_id = req.user.sub;
    const course_id = req.params.course_id;
    let { favorites } = await prisma.users.findUnique({
      where: { id: user_id },
    });
    ({ favorites } = await prisma.users.update({
      where: { id: user_id },
      data: {
        favorites: favorites.filter((id) => id != course_id),
      },
      include: {
        major_dept: true,
        d_major_dept: true,
      },
    }));
    favorites = await getCoursesbyIds(favorites, false);
    res.status(200).send({
      favorites: favorites,
      message: "Course removed from favorites.",
    });
  } catch (err) {
    next(err);
  }
});

// utility functions below

async function process_user_info(user) {
  const replace_keys = ["major", "d_major"];
  for (let i = 0; i < replace_keys.length; i++) {
    const key = replace_keys[i];
    if (replace_keys.includes(key)) {
      user[key] = user[`${key}_dept`];
      delete user[`${key}_dept`];
    }
  }
  const minor_codes = JSON.parse(JSON.stringify(user.minors));
  user.minors = await prisma.departments.findMany({
    where: {
      id: {
        in: minor_codes,
      },
    },
  });
  user.favorites = await getCoursesbyIds(user.favorites, false);
  return user;
}

export default router;
