import "dotenv-defaults/config";
import stubDataContainer from "@/prisma/stubData";

export function checkJwt(req, res, next) {
  const token = req.get("Authorization")?.split(" ")[1];
  if (token) {
    const user = stubDataContainer.getUserByToken(token);
    req.user = {
      sub: user.id,
    };
    next();
  } else {
    res.status(401).send({ message: "Missing JWT token" });
  }
}
