// app/api/metrics/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSurveillanceWhere } from "@/lib/surveillance-query";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const where = buildSurveillanceWhere(searchParams);

    const [totalCasesData, hospitalCount, topProvince, topGroup] =
      await Promise.all([
        prisma.maekok_summary_aggregated.aggregate({
          _sum: { total_count: true },
          where,
        }),
        prisma.maekok_summary_aggregated.findMany({
          where,
          select: { hospcode: true },
          distinct: ["hospcode"],
        }),
        prisma.maekok_summary_aggregated.groupBy({
          by: ["provname"],
          where: {
            ...where,
            provname: { not: null },
          },
          _sum: { total_count: true },
          orderBy: { _sum: { total_count: "desc" } },
          take: 1,
        }),
        prisma.maekok_summary_aggregated.groupBy({
          by: ["groupname"],
          where: {
            ...where,
            groupname: { not: null },
          },
          _sum: { total_count: true },
          orderBy: { _sum: { total_count: "desc" } },
          take: 1,
        }),
      ]);

    const metrics = {
      totalCases: Number(totalCasesData._sum.total_count) || 0,
      hospitalCount: hospitalCount.length || 0,
      topProvince: topProvince[0]?.provname || "N/A",
      topGroup: topGroup[0]?.groupname || "N/A",
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("API Error fetching metrics:", error);
    return NextResponse.json(
      { message: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
