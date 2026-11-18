import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeek } from "date-fns";
import { buildSurveillanceWhere } from "@/lib/surveillance-query";

interface Submission {
  id: string;
  weekNumber: number;
  year: number;
  hospital: {
    id: string;
    name: string;
    province: string;
  };
  icdEntries: {
    code: string;
    count: number;
  }[];
}

export const dynamic = "force-dynamic"; // Prevent static caching

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const where = buildSurveillanceWhere(searchParams);

  try {
    const result = await prisma.maekok_summary_aggregated.findMany({
      where,
      orderBy: [{ date_serv: "asc" }, { hospcode: "asc" }],
    });

    const groupedData: { [key: string]: Submission } = {};

    for (const row of result) {
      const [y, m, d] = row.date_serv
        .toISOString()
        .split("T")[0]
        .split("-")
        .map(Number);
      const localDate = new Date(y, m - 1, d);
      const year = y;
      const weekNumber = getWeek(localDate, { weekStartsOn: 1 });
      const groupKey = `${year}-${weekNumber}-${row.hospcode}`;

      if (!groupedData[groupKey]) {
        groupedData[groupKey] = {
          id: groupKey,
          year,
          weekNumber,
          hospital: {
            id: row.hospcode,
            name: row.hosname || "N/A",
            province: row.provcode || "N/A",
          },
          icdEntries: [],
        };
      }

      if (row.total_count !== null && row.total_count !== undefined) {
        groupedData[groupKey].icdEntries.push({
          code: row.diagcode,
          count: Number(row.total_count),
        });
      }
    }

    const finalData = Object.values(groupedData);
    return NextResponse.json(finalData);
  } catch (error) {
    console.error("API Error fetching report data:", error);
    return NextResponse.json(
      { message: "Failed to fetch report data" },
      { status: 500 }
    );
  }
}
