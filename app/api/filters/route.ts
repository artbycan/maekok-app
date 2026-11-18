import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSurveillanceHospitalCodes,
  SURVEILLANCE_PROVINCE_CODES,
} from "@/lib/surveillance-config";

export interface FilterData {
  hospitals: { id: string; name: string; province: string }[];
  provinces: { id: string; name: string }[];
  districts: { name: string; province: string }[];
  groups: { name: string }[];
  diagcodes: { code: string; group: string | null }[];
}

export const dynamic = "force-dynamic";

export async function GET() {
  const allowedHospitalCodes = getSurveillanceHospitalCodes();
  const allowedProvinceCodes = [...SURVEILLANCE_PROVINCE_CODES];

  try {
    const [hospitalData, provinceData, districtData, groupData, diagcodeData] =
      await Promise.all([
        prisma.maekok_summary_aggregated.findMany({
          select: {
            hospcode: true,
            hosname: true,
            provcode: true,
          },
          where: { hospcode: { in: allowedHospitalCodes } },
          distinct: ["hospcode", "hosname", "provcode"],
          orderBy: {
            hosname: "asc",
          },
        }),
        prisma.maekok_summary_aggregated.findMany({
          where: {
            provcode: { not: null, in: allowedProvinceCodes },
            provname: { not: null },
          },
          select: {
            provcode: true,
            provname: true,
          },
          distinct: ["provcode", "provname"],
          orderBy: {
            provname: "asc",
          },
        }),
        prisma.maekok_summary_aggregated.findMany({
          where: {
            hospcode: { in: allowedHospitalCodes },
            dist_name_th: { not: null },
          },
          select: {
            dist_name_th: true,
            provcode: true,
          },
          distinct: ["dist_name_th", "provcode"],
          orderBy: {
            dist_name_th: "asc",
          },
        }),
        prisma.maekok_summary_aggregated.findMany({
          where: {
            hospcode: { in: allowedHospitalCodes },
            groupname: { not: null },
          },
          select: { groupname: true },
          distinct: ["groupname"],
          orderBy: { groupname: "asc" },
        }),
        prisma.maekok_summary_aggregated.findMany({
          where: {
            hospcode: { in: allowedHospitalCodes },
          },
          select: {
            diagcode: true,
            groupname: true,
          },
          distinct: ["diagcode", "groupname"],
          orderBy: { diagcode: "asc" },
        }),
      ]);

    const hospitalMap = new Map<
      string,
      { id: string; name: string; province: string }
    >();
    hospitalData.forEach((h) => {
      if (!hospitalMap.has(h.hospcode)) {
        hospitalMap.set(h.hospcode, {
          id: h.hospcode,
          name: h.hosname || "N/A",
          province: h.provcode || "N/A",
        });
      }
    });
    const hospitals = Array.from(hospitalMap.values());

    const provinceMap = new Map<string, string>();
    provinceData.forEach((p) => {
      if (p.provcode && p.provname) {
        provinceMap.set(p.provcode, p.provname);
      }
    });
    const provinces = Array.from(provinceMap, ([id, name]) => ({ id, name }));

    const districtMap = new Map<string, { name: string; province: string }>();
    districtData.forEach((d) => {
      if (d.dist_name_th) {
        const key = `${d.provcode || ""}:${d.dist_name_th}`;
        if (!districtMap.has(key)) {
          districtMap.set(key, {
            name: d.dist_name_th,
            province: d.provcode || "",
          });
        }
      }
    });
    const districts = Array.from(districtMap.values());

    const groups = groupData.map((g) => ({ name: g.groupname! }));

    const diagcodeMap = new Map<
      string,
      { code: string; group: string | null }
    >();
    diagcodeData.forEach((d) => {
      if (!diagcodeMap.has(d.diagcode)) {
        diagcodeMap.set(d.diagcode, {
          code: d.diagcode,
          group: d.groupname,
        });
      }
    });
    const diagcodes = Array.from(diagcodeMap.values());

    const responseData: FilterData = {
      hospitals,
      provinces,
      districts,
      groups,
      diagcodes,
    };
    return NextResponse.json(responseData);
  } catch (error) {
    console.error("API Error fetching filters:", error);
    return NextResponse.json(
      { message: "Failed to fetch filters" },
      { status: 500 }
    );
  }
}
