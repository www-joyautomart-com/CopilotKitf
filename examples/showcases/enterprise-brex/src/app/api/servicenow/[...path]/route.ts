import { NextRequest } from "next/server";

// This route serves as a proxy route to reach the service-now endpoints

export const SERVICE_NOW_BASE_URL =
  "https://hexawaretechnologiesincdemo8.service-now.com/api/now";
const encodedCredentials = Buffer.from(
  `${process.env.SERVICENOW_USERNAME}:${process.env.SERVICENOW_PASSWORD}`,
).toString("base64");
export const serviceNowApiHeaders = {
  Authorization: `Basic ${encodedCredentials}`,
  "Content-Type": "application/json",
};

function sanitizeServiceNowPath(rawPath: string): string {
  const withoutPrefix = rawPath.replace(/^\/api\/servicenow\/?/, "");
  const segments = withoutPrefix.split("/").filter(Boolean);

  const sanitizedSegments = segments.map((segment) => {
    const decoded = decodeURIComponent(segment);

    if (
      decoded === "." ||
      decoded === ".." ||
      /%2f|%5c/i.test(segment) ||
      !/^[A-Za-z0-9._-]+$/.test(decoded)
    ) {
      throw new Error("Invalid path segment");
    }

    return encodeURIComponent(decoded);
  });

  return sanitizedSegments.join("/");
}

async function handler(req: NextRequest) {
  const { method, url: stringUrl } = req;
  const url = new URL(stringUrl);
  const query = Object.fromEntries(url.searchParams.entries());

  let safePath: string;
  try {
    safePath = sanitizeServiceNowPath(url.pathname);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid path" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const urlWithQuery = new URL(
    safePath ? `${SERVICE_NOW_BASE_URL}/${safePath}` : SERVICE_NOW_BASE_URL,
  );
  Object.entries(query).forEach(([key, value]) =>
    urlWithQuery.searchParams.append(key, value),
  );
  const response = await fetch(urlWithQuery.toString(), {
    method,
    headers: serviceNowApiHeaders,
  });

  if (!response.ok) {
    const error = await response.json();
    console.error(`Error with request: ${JSON.stringify(error)}`);
    return new Response(JSON.stringify(error), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const { result } = await response.json();

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export { handler as POST, handler as GET };
