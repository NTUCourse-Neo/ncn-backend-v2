import { AxiosError } from "axios";
import "dotenv-defaults/config";
import StubData from "@/prisma/stubData";

const MockedToken = `MockedTokenForTesting`;

export async function get_token() {
  return MockedToken;
}

function checkAccessToken(token) {
  if (token !== MockedToken) {
    throw new AxiosError(`Invalid authorization token`, "401");
  }
}

export async function get_user_by_email(email, token) {
  checkAccessToken(token);

  // Not used in test currently
  return null;
}

export async function get_user_by_id(id, token) {
  checkAccessToken(token);

  // Not used in test currently
  return null;
}

export async function delete_user_by_id(id, token) {
  checkAccessToken(token);

  // Not used in test currently
  return null;
}

/**
 * To make a stub user admin, simply set `user.name` to include "admin" magic string
 */
export const AdminIds = new Set();
for (const user of StubData.users) {
  if (user.name.includes("admin")) {
    AdminIds.add(user.id);
  }
}

export async function get_user_meta_roles(id, token) {
  checkAccessToken(token);

  if (AdminIds.has(id)) {
    return ["admin"];
  } else if (id) {
    return ["user"];
  } else {
    throw new Error(`No user id is given.`);
  }
}
