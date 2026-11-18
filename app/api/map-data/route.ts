// app/api/map-data/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSurveillanceWhere } from "@/lib/surveillance-query";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const where = buildSurveillanceWhere(searchParams);

    const provinceData = await prisma.maekok_summary_aggregated.groupBy({
      by: ["provname"],
      where: { ...where, provname: { not: null } },
      _sum: {
        total_count: true,
      },
    });

    const mapData = provinceData.map((p) => ({
      province: p.provname,
      count: Number(p._sum.total_count) || 0,
    }));

    return NextResponse.json(mapData);
  } catch (error) {
    console.error("API Error fetching map data:", error);
    return NextResponse.json(
      { message: "Failed to fetch map data" },
      { status: 500 }
    );
  }
}
