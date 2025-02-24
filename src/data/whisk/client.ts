import "server-only";
import { GraphQLClient } from "graphql-request";

// TODO: Can allow from client, but might want to use a different key
// TODO: or should wrap getters in a route handler for client use (keeps it all server side)
export const whiskClient = new GraphQLClient(process.env.WHISK_API_URL!, {
  headers: { Authorization: `Bearer ${process.env.WHISK_API_KEY!}` },
});
