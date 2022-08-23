import StubData from "@/prisma/stubData";

/**
 * NOTE: By current setting, only the first user is admin
 * @see: `src/utils/__mocks__/auth0_clients.js`
 */
const TokensByUserId = {};

const { users } = StubData;
for (let i = 0; i < users.length; i++) {
  const user = users[i];
  TokensByUserId[user.id] = `${i}.${i}.${i}`;
}

export default TokensByUserId;
