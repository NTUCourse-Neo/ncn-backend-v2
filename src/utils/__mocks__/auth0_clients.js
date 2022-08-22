import { AxiosError } from "axios";
import "dotenv-defaults/config";

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

  // Not used is test currently
  return null;
}

const AdminIds = new Set();
AdminIds.add("admin");

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
