import auth0Client from "../utils/auth0Client";

export default async function checkIsAdmin(req, res, next) {
  const user = await auth0Client.getUser({ id: req.user.sub });
  if (user.app_metadata?.roles?.includes("admin")) {
    next();
  } else {
    res
      .status(403)
      .send({ message: "You are not authorized to get this data." });
  }
}
