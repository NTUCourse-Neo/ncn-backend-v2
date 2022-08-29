import prisma from "@/prisma";

const course_include_all = {
  departments: {
    select: {
      departments: true,
    },
  },
  areas: {
    select: {
      area_id: true,
      areas: {
        select: {
          name: true,
        },
      },
    },
  },
  specialties: {
    select: {
      specialty_id: true,
      specialties: {
        select: {
          name: true,
        },
      },
    },
  },
  prerequisites: {
    select: {
      pre_course_id: true,
    },
  },
  prerequisite_of: {
    select: {
      course_id: true,
    },
  },
  schedules: {
    select: {
      weekday: true,
      interval: true,
      location: true,
    },
  },
};

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

async function getCoursesbyIds(ids, doSort = true) {
  if (ids.length === 0) {
    return [];
  }
  const courses = await prisma.courses.findMany({
    where: {
      id: {
        in: ids,
      },
    },
    include: course_include_all,
  });
  if (courses) {
    if (!doSort) {
      return courses;
    }
    const sortedCourses = ids.map((id) =>
      courses.find((course) => course.id === id)
    );
    return sortedCourses;
  } else {
    return [];
  }
}

export {
  course_include_all,
  course_post_process,
  generate_course_filter,
  getCoursesbyIds,
};
