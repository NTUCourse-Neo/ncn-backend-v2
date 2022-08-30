import "dotenv-defaults/config";
import StubData from "@/prisma/stubData";

async function getUser({ id }) {
  // Not used in test currently
  return null;
}

async function getUsersByEmail(email) {
  if (email === StubData.getUnregisteredData().email) {
    return [StubData.getUnregisteredData()];
  }

  return [];
}

async function deleteUser({ id }) {
  // Not used in test currently
  return null;
}

export default {
  getUser,
  getUsersByEmail,
  deleteUser,
};
