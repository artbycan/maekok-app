import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSurveillanceWhere } from "@/lib/surveillance-query";

export const dynamic = "force-dynamic";

const EXPORT_MAX_ROWS = 50_000;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const rawLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
    const skip = (page - 1) * limit;

    const exportAll = searchParams.get("export") === "true";
    const where = buildSurveillanceWhere(searchParams);
    const take: number = exportAll ? EXPORT_MAX_ROWS : limit;

    const [data, totalCount] = await Promise.all([
      prisma.maekok_summary_aggregated.findMany({
        where,
        orderBy: { date_serv: "desc" },
        ...(exportAll ? {} : { skip }),
        take,
      }),
      prisma.maekok_summary_aggregated.count({ where }),
    ]);

    const serializedData = data.map((row) => ({
      ...row,
      total_count: row.total_count?.toString() || "0",
    }));

    return NextResponse.json({
      data: serializedData,
      totalCount,
      truncated: exportAll && totalCount > EXPORT_MAX_ROWS,
    });
  } catch (error) {
    console.error("API Error fetching raw data:", error);
    return NextResponse.json(
      { message: "Failed to fetch raw data" },
      { status: 500 }
    );
  }
}
