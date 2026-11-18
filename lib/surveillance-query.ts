import type { Prisma } from "@/generated/prisma/client";
import { getSurveillanceHospitalCodes } from "@/lib/surveillance-config";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_TEXT_PARAM_LEN = 120;
const MAX_HOSPITAL_IDS = 50;

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined;
  const match = ISO_DATE_RE.exec(value.trim());
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return undefined;
  }

  return parsed;
}

function sanitizeTextParam(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_TEXT_PARAM_LEN) return undefined;
  return trimmed;
}

/**
 * Builds a Prisma `where` filter for `maekok_summary_aggregated` from URL search params.
 * Always scopes data to the configured surveillance hospitals while honoring user-selected `hospitalIds`.
 */
export function buildSurveillanceWhere(
  searchParams: URLSearchParams
): Prisma.maekok_summary_aggregatedWhereInput {
  const allowedHospitalCodes = getSurveillanceHospitalCodes();
  const allowedSet = new Set(allowedHospitalCodes);

  const startDate = parseDateParam(searchParams.get("startDate"));
  const endDate = parseDateParam(searchParams.get("endDate"));
  const province = sanitizeTextParam(searchParams.get("province"));
  const district = sanitizeTextParam(searchParams.get("district"));
  const group = sanitizeTextParam(searchParams.get("group"));
  const diagcode = sanitizeTextParam(searchParams.get("diagcode"));
  const requestedHospitalIds = searchParams
    .getAll("hospitalIds")
    .slice(0, MAX_HOSPITAL_IDS)
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id.length <= 20);

  const where: Prisma.maekok_summary_aggregatedWhereInput = {};

  if (startDate && endDate && startDate > endDate) {
    // Impossible date window safely yields empty results.
    where.hospcode = { in: [] };
    return where;
  }

  if (startDate || endDate) {
    where.date_serv = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {}),
    };
  }

  if (province) {
    where.provcode = province;
  }

  if (district) {
    where.dist_name_th = district;
  }

  if (group) {
    where.groupname = group;
  }

  if (diagcode) {
    where.diagcode = diagcode;
  }

  // Intersect requested hospitals with the surveillance allowlist so user filtering
  // narrows the query instead of being overwritten by the full allowlist.
  const effectiveHospitalIds =
    requestedHospitalIds.length > 0
      ? requestedHospitalIds.filter((id) => allowedSet.has(id))
      : allowedHospitalCodes;

  where.hospcode = { in: effectiveHospitalIds };

  return where;
}
