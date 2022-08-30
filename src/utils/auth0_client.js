import "dotenv-defaults/config";
import { ManagementClient } from "auth0";

const auth0Client = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
});

export async function isAdmin(id) {
  const user = await auth0Client.getUser({ id });
  return !!user?.app_metadata?.roles?.includes("admin");
}

export default auth0Client;
