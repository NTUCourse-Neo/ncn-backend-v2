export default async function checkIsAdmin(id) {
  if (id) {
    return StubData.isUserAdmin(id);
  } else {
    throw new Error(`No user id is given.`);
  }
}
