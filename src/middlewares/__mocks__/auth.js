import "dotenv-defaults/config";
import StubData from "@/prisma/stubData";

export function checkJwt(req, res, next) {
  const token = req.get("Authorization")?.split(" ")[1];
  if (token) {
    if (token === StubData.getUnregisteredData().token) {
      req.user = {
        sub: StubData.getUnregisteredData().user_id,
      };
    } else {
      const user = StubData.getUserByToken(token);
      req.user = {
        sub: user.id,
      };
    }
    next();
  } else {
    res.status(401).send({ message: "Missing JWT token" });
  }
}
