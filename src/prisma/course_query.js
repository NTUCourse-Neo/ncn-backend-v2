const course_include_all = {
  departments: {
    select: {
      department_id: true,
      department: {
        select: {
          name_full: true,
          name_short: true,
        }
      }
    }
  },
  areas: {
    select: {
      area_id: true,
      area: {
        select: {
          name: true,
        }
      }
    }
  },
  specialties: {
    select: {
      specialty_id: true,
      specialty: {
        select: {
          name: true,
        }
      }
    }
  },
  prerequisites: {
    select: {
      pre_course_id: true
    }
  },
  prerequisite_of: {
    select: {
      course_id: true
    }
  },
  schedules: {
    select: {
      weekday: true,
      interval: true,
      location: true,
    }
  }
}

export { course_include_all }