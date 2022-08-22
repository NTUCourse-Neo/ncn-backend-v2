import StubData from "@/prisma/stubData";

const TokensByUserId = {};

const { users } = StubData;
for (let i = 0; i < users.length; i++) {
  const user = users[i];
  TokensByUserId[user.id] = `${i}.${i}.${i}`;
}

export default TokensByUserId;
