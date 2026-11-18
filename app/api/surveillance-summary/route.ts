import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  PDF_ICD10_ITEMS,
  SURVEILLANCE_HOSPITALS,
  matchPdfIcd10Item,
} from "@/lib/surveillance-config";
import { buildSurveillanceWhere } from "@/lib/surveillance-query";

export const dynamic = "force-dynamic";

export interface HospitalGroupBreakdown {
  groupname: string;
  totalCases: number;
}

export interface HospitalIcd10Breakdown {
  order: number;
  category: string;
  name: string;
  icd10Label: string;
  totalCases: number;
  matchedCodes: string[];
}

export interface HospitalSummaryRow {
  order: number;
  hospcode: string;
  name: string;
  district: string;
  provcode: string;
  provname: string;
  totalCases: number;
  recordCount: number;
  byGroup: HospitalGroupBreakdown[];
  byIcd10: HospitalIcd10Breakdown[];
}

export interface Icd10HospitalBreakdown {
  order: number;
  hospcode: string;
  name: string;
  district: string;
  provname: string;
  totalCases: number;
  matchedCodes: string[];
}

export interface PdfIcd10SummaryRow {
  order: number;
  category: string;
  name: string;
  icd10Label: string;
  totalCases: number;
  matchedCodes: string[];
  byHospital: Icd10HospitalBreakdown[];
}

export interface SurveillanceSummaryResponse {
  hospitals: HospitalSummaryRow[];
  icd10Summary: PdfIcd10SummaryRow[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const where = buildSurveillanceWhere(searchParams);

    const groupedRows = await prisma.maekok_summary_aggregated.groupBy({
      by: ["hospcode", "hosname", "diagcode", "groupname"],
      where,
      _sum: { total_count: true },
      _count: { hospcode: true },
      orderBy: [{ hospcode: "asc" }, { diagcode: "asc" }],
    });

    // Per-hospital accumulators
    const hospitalStatsMap = new Map<
      string,
      {
        hosname: string | null;
        totalCases: number;
        recordCount: number;
        groupMap: Map<string, number>;
        icdMap: Map<number, { totalCases: number; matchedCodes: Set<string> }>;
      }
    >();

    // Per-ICD10 accumulators (with nested per-hospital counts)
    const icdAccumulator = new Map<
      number,
      {
        totalCases: number;
        matchedCodes: Set<string>;
        hospitalMap: Map<string, { totalCases: number; matchedCodes: Set<string> }>;
      }
    >();

    for (const row of groupedRows) {
      const count = Number(row._sum?.total_count) || 0;
      const rowsCount =
        typeof row._count === "object" && row._count !== null
          ? row._count.hospcode || 0
          : 0;
      const groupLabel = row.groupname || "ไม่ระบุกลุ่มอาการ";
      const matchedIcd = matchPdfIcd10Item(row.diagcode);

      // Update hospital stats
      let hospEntry = hospitalStatsMap.get(row.hospcode);
      if (!hospEntry) {
        hospEntry = {
          hosname: row.hosname,
          totalCases: 0,
          recordCount: 0,
          groupMap: new Map(),
          icdMap: new Map(),
        };
        hospitalStatsMap.set(row.hospcode, hospEntry);
      }
      if (!hospEntry.hosname && row.hosname) {
        hospEntry.hosname = row.hosname;
      }
      hospEntry.totalCases += count;
      hospEntry.recordCount += rowsCount;
      hospEntry.groupMap.set(
        groupLabel,
        (hospEntry.groupMap.get(groupLabel) || 0) + count
      );

      if (matchedIcd) {
        const hospIcd = hospEntry.icdMap.get(matchedIcd.order) || {
          totalCases: 0,
          matchedCodes: new Set<string>(),
        };
        hospIcd.totalCases += count;
        hospIcd.matchedCodes.add(row.diagcode);
        hospEntry.icdMap.set(matchedIcd.order, hospIcd);

        // Update global ICD-10 stats
        let icdEntry = icdAccumulator.get(matchedIcd.order);
        if (!icdEntry) {
          icdEntry = {
            totalCases: 0,
            matchedCodes: new Set<string>(),
            hospitalMap: new Map(),
          };
          icdAccumulator.set(matchedIcd.order, icdEntry);
        }
        icdEntry.totalCases += count;
        icdEntry.matchedCodes.add(row.diagcode);

        const perHosp = icdEntry.hospitalMap.get(row.hospcode) || {
          totalCases: 0,
          matchedCodes: new Set<string>(),
        };
        perHosp.totalCases += count;
        perHosp.matchedCodes.add(row.diagcode);
        icdEntry.hospitalMap.set(row.hospcode, perHosp);
      }
    }

    const resolvedHospitalName = (hospcode: string, fallback: string) =>
      hospitalStatsMap.get(hospcode)?.hosname || fallback;

    const hospitals: HospitalSummaryRow[] = SURVEILLANCE_HOSPITALS.map((h) => {
      const stats = hospitalStatsMap.get(h.hospcode);
      const byGroup: HospitalGroupBreakdown[] = stats
        ? Array.from(stats.groupMap.entries())
            .map(([groupname, totalCases]) => ({ groupname, totalCases }))
            .sort((a, b) => b.totalCases - a.totalCases)
        : [];

      const byIcd10: HospitalIcd10Breakdown[] = PDF_ICD10_ITEMS.map((item) => {
        const icdStats = stats?.icdMap.get(item.order);
        return {
          order: item.order,
          category: item.category,
          name: item.name,
          icd10Label: item.icd10Label,
          totalCases: icdStats?.totalCases || 0,
          matchedCodes: icdStats ? Array.from(icdStats.matchedCodes).sort() : [],
        };
      });

      return {
        order: h.order,
        hospcode: h.hospcode,
        name: stats?.hosname || h.name,
        district: h.district,
        provcode: h.provcode,
        provname: h.provname,
        totalCases: stats?.totalCases || 0,
        recordCount: stats?.recordCount || 0,
        byGroup,
        byIcd10,
      };
    });

    const icd10Summary: PdfIcd10SummaryRow[] = PDF_ICD10_ITEMS.map((item) => {
      const acc = icdAccumulator.get(item.order);
      const byHospital: Icd10HospitalBreakdown[] = SURVEILLANCE_HOSPITALS.map(
        (h) => {
          const perHosp = acc?.hospitalMap.get(h.hospcode);
          return {
            order: h.order,
            hospcode: h.hospcode,
            name: resolvedHospitalName(h.hospcode, h.name),
            district: h.district,
            provname: h.provname,
            totalCases: perHosp?.totalCases || 0,
            matchedCodes: perHosp ? Array.from(perHosp.matchedCodes).sort() : [],
          };
        }
      );

      return {
        order: item.order,
        category: item.category,
        name: item.name,
        icd10Label: item.icd10Label,
        totalCases: acc?.totalCases || 0,
        matchedCodes: acc ? Array.from(acc.matchedCodes).sort() : [],
        byHospital,
      };
    });

    return NextResponse.json({ hospitals, icd10Summary });
  } catch (error) {
    console.error("API Error fetching surveillance summary:", error);
    return NextResponse.json(
      { message: "Failed to fetch surveillance summary" },
      { status: 500 }
    );
  }
}
