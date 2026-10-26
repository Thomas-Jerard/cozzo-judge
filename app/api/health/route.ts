import { connection } from "next/server";
import { healthReport } from "@/lib/health";

export const maxDuration = 15;

export async function GET() {
  await connection();
  const report = await healthReport();
  return Response.json(report, {
    status: report.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
