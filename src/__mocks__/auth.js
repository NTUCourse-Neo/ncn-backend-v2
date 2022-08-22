import "dotenv-defaults/config";
import users from "@/prisma/stubData/users.json";

const usersByToken = new Map();
for (const user of users) {
  usersByToken.set(user.id, user);
}

export function checkJwt(req, res) {
  const token = req.header.authorization.split(" ")[1];
  const user = usersByToken.get(token);
  return (req, res) => {
    req.user = {
      sub: user.id,
    };
  };
}
