import { connection } from "next/server";
import { judgeRuntime } from "@/lib/nebius";

export async function GET() {
  await connection();
  return Response.json(judgeRuntime());
}
