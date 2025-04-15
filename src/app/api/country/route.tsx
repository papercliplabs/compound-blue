import { geolocation } from "@vercel/functions";

// Returns ISO 3166-2 Country Code for the user: https://en.wikipedia.org/wiki/ISO_3166-2
export function GET(request: Request) {
  const details = geolocation(request);
  return Response.json(process.env.NODE_ENV === "development" ? "CA" : details.country);
}
