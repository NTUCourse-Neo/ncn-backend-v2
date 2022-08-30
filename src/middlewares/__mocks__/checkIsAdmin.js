import StubData from "@/prisma/stubData";

export default async function checkIsAdmin(req, res, next) {
  if (req?.user?.sub) {
    if (StubData.isUserAdmin(req.user.sub)) {
      next();
    } else {
      res
        .status(403)
        .send({ message: "You are not authorized to get this data." });
    }
  } else {
    throw new Error(`No user id is given.`);
  }
}
