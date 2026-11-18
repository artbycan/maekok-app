// app/api/trends/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSurveillanceWhere } from "@/lib/surveillance-query";
import { startOfWeek, format } from "date-fns";

export const dynamic = "force-dynamic";

export interface MultiSeriesTrendResponse {
  labels: string[];
  series: {
    key: string;
    label: string;
    data: number[];
    total: number;
  }[];
}

function toBucketKey(dateServ: Date, view: string): string {
  const dateStr = dateServ.toISOString().split("T")[0];
  if (view !== "weekly") {
    return dateStr;
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);
  return format(startOfWeek(localDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function buildMultiSeries(
  rows: { bucket: string; seriesKey: string; seriesLabel: string; count: number }[]
): MultiSeriesTrendResponse {
  const labelSet = new Set<string>();
  const seriesMap = new Map<
    string,
    { label: string; buckets: Map<string, number>; total: number }
  >();

  for (const row of rows) {
    labelSet.add(row.bucket);
    let entry = seriesMap.get(row.seriesKey);
    if (!entry) {
      entry = { label: row.seriesLabel, buckets: new Map(), total: 0 };
      seriesMap.set(row.seriesKey, entry);
    }
    entry.buckets.set(
      row.bucket,
      (entry.buckets.get(row.bucket) || 0) + row.count
    );
    entry.total += row.count;
  }

  const labels = Array.from(labelSet).sort();
  const series = Array.from(seriesMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([key, entry]) => ({
      key,
      label: entry.label,
      total: entry.total,
      data: labels.map((bucket) => entry.buckets.get(bucket) || 0),
    }));

  return { labels, series };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "daily";
    const groupBy = searchParams.get("groupBy") || "none";
    const where = buildSurveillanceWhere(searchParams);

    if (groupBy === "hospital") {
      const grouped = await prisma.maekok_summary_aggregated.groupBy({
        by: ["date_serv", "hospcode", "hosname"],
        where,
        _sum: { total_count: true },
        orderBy: { date_serv: "asc" },
      });

      const rows = grouped.map((item) => ({
        bucket: toBucketKey(item.date_serv, view),
        seriesKey: item.hospcode,
        seriesLabel: item.hosname || item.hospcode,
        count: Number(item._sum.total_count) || 0,
      }));

      return NextResponse.json(buildMultiSeries(rows));
    }

    if (groupBy === "group") {
      const grouped = await prisma.maekok_summary_aggregated.groupBy({
        by: ["date_serv", "groupname"],
        where: { ...where, groupname: { not: null } },
        _sum: { total_count: true },
        orderBy: { date_serv: "asc" },
      });

      const rows = grouped.map((item) => {
        const name = item.groupname || "ไม่ระบุกลุ่มอาการ";
        return {
          bucket: toBucketKey(item.date_serv, view),
          seriesKey: name,
          seriesLabel: name,
          count: Number(item._sum.total_count) || 0,
        };
      });

      return NextResponse.json(buildMultiSeries(rows));
    }

    const dailyData = await prisma.maekok_summary_aggregated.groupBy({
      by: ["date_serv"],
      where,
      _sum: {
        total_count: true,
      },
      orderBy: {
        date_serv: "asc",
      },
    });

    if (view === "weekly") {
      const weeklyTotals: Record<string, number> = {};
      dailyData.forEach((item) => {
        const weekKey = toBucketKey(item.date_serv, "weekly");
        weeklyTotals[weekKey] =
          (weeklyTotals[weekKey] || 0) + (Number(item._sum.total_count) || 0);
      });

      const formattedData = Object.keys(weeklyTotals)
        .sort()
        .map((weekKey) => ({
          date: weekKey,
          จำนวนผู้ป่วย: weeklyTotals[weekKey],
        }));
      return NextResponse.json(formattedData);
    }

    const formattedData = dailyData.map((item) => ({
      date: toBucketKey(item.date_serv, "daily"),
      จำนวนผู้ป่วย: Number(item._sum.total_count) || 0,
    }));
    return NextResponse.json(formattedData);
  } catch (error) {
    console.error("API Error fetching trends data:", error);
    return NextResponse.json(
      { message: "Failed to fetch trends data" },
      { status: 500 }
    );
  }
}
