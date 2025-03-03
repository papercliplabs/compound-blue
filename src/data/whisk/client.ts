import "server-only";
import { GraphQLClient } from "graphql-request";

export const whiskClient = new GraphQLClient(process.env.WHISK_API_URL!, {
  headers: { Authorization: `Bearer ${process.env.WHISK_API_KEY!}` },
});
