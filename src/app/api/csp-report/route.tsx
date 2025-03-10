import { track } from "@vercel/analytics/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cspReport = body["csp-report"] || body;

    await track("csp-violation", {
      type: cspReport.type,
      url: cspReport.url,
      body: cspReport.body,
    });

    console.warn("CSP error: ", JSON.stringify(cspReport));

    return Response.json({ message: "CSP Report received" });
  } catch (error) {
    console.error("CSP Report Error:", error);
    return Response.json({ message: "Error processing CSP report" }, { status: 500 });
  }
}
