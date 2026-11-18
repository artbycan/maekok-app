// app/page.tsx
"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import axios from "axios";
import dynamic from "next/dynamic";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  CalendarIcon,
  Search,
  Filter,
  X,
  Check,
  ChevronsUpDown,
  Download,
  BarChart,
  Users,
  Hospital,
  Activity,
  MapPin,
  Building,
  ListChecks,
  FileSpreadsheet,
  Info,
  Eye,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { downloadCsv } from "@/lib/csv-export";
import type { FilterData } from "@/app/api/filters/route";
import type { MultiSeriesTrendData, TrendData } from "@/components/TrendsChart";
import type {
  HospitalSummaryRow,
  PdfIcd10SummaryRow,
  SurveillanceSummaryResponse,
} from "@/app/api/surveillance-summary/route";
import { SURVEILLANCE_DEFAULT_START_DATE } from "@/lib/surveillance-config";

const TrendsChart = dynamic(() => import("@/components/TrendsChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[400px] w-full" />,
});

// --- TYPE DEFINITIONS ---
interface HospitalOption {
  id: string;
  name: string;
  province: string;
}
interface ProvinceOption {
  id: string;
  name: string;
}
interface DistrictOption {
  name: string;
  province: string;
}
interface DiagcodeOption {
  code: string;
  group: string | null;
}
interface RawDataEntry {
  hospcode: string;
  hosname: string | null;
  provcode: string | null;
  provname: string | null;
  dist_name_th: string | null;
  date_serv: string;
  diagcode: string;
  groupname: string | null;
  total_count: string;
}
interface Metrics {
  totalCases: number;
  hospitalCount: number;
  topProvince: string;
  topGroup: string;
}
interface Top5Data {
  name: string;
  count: number;
}
interface Top5Response {
  topProvinces: Top5Data[];
  topHospitals: Top5Data[];
  topGroups: Top5Data[];
}

function getGuidelineStartDate(): Date {
  const [year, month, day] =
    SURVEILLANCE_DEFAULT_START_DATE.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateServ(dateValue: string): string {
  const datePart = dateValue.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return dateValue;
  return format(new Date(year, month - 1, day), "dd MMM yyyy", { locale: th });
}

// --- REFACTORED UI COMPONENTS ---

const MetricCard = ({
  title,
  value,
  subtitle,
  icon,
  loading,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  loading: boolean;
}) => (
  <Card className="shadow-md border-blue-100 transition-transform hover:scale-105">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-blue-800">
        {title}
      </CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      {loading ? (
        <Skeleton className="h-8 w-3/4" />
      ) : (
        <>
          <div className="text-2xl font-bold text-blue-900">
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          {subtitle && <p className="text-xs text-blue-600 mt-1">{subtitle}</p>}
        </>
      )}
    </CardContent>
  </Card>
);

const Top5List = ({
  title,
  data,
  icon,
  loading,
}: {
  title: string;
  data: Top5Data[];
  icon: React.ReactNode;
  loading: boolean;
}) => (
  <Card className="shadow-md border-blue-100 h-full">
    <CardHeader>
      <CardTitle className="text-md font-semibold text-blue-900 flex items-center gap-2">
        {icon}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {data.length > 0 ? (
            data.map((item, index) => (
              <li
                key={index}
                className="flex justify-between items-center text-sm"
              >
                <span className="text-blue-800 truncate pr-2">{item.name}</span>
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-800 flex-shrink-0"
                >
                  {item.count.toLocaleString()}
                </Badge>
              </li>
            ))
          ) : (
            <p className="text-sm text-gray-500">ไม่มีข้อมูล</p>
          )}
        </ul>
      )}
    </CardContent>
  </Card>
);

// --- MAIN PAGE COMPONENT ---
export default function ReportPage() {
  // Filter state (default startDate = 2023-01-01 per PDF page 4)
  const [rawData, setRawData] = useState<RawDataEntry[]>([]);
  const [loading, setLoading] = useState({ table: true, dashboard: true });
  const [startDate, setStartDate] = useState<Date | undefined>(() =>
    getGuidelineStartDate(),
  );
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedDiagcode, setSelectedDiagcode] = useState("");
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [groups, setGroups] = useState<{ name: string }[]>([]);
  const [diagcodes, setDiagcodes] = useState<DiagcodeOption[]>([]);
  const [selectedHosps, setSelectedHosps] = useState<HospitalOption[]>([]);
  const [openHospitalPopover, setOpenHospitalPopover] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Dashboard state
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [trendsData, setTrendsData] = useState<TrendData[]>([]);
  const [weeklyByHospital, setWeeklyByHospital] =
    useState<MultiSeriesTrendData | null>(null);
  const [weeklyByGroup, setWeeklyByGroup] =
    useState<MultiSeriesTrendData | null>(null);
  const [hospitalSummary, setHospitalSummary] = useState<HospitalSummaryRow[]>(
    [],
  );
  const [icd10Summary, setIcd10Summary] = useState<PdfIcd10SummaryRow[]>([]);
  const [top5Data, setTop5Data] = useState<Top5Response>({
    topProvinces: [],
    topHospitals: [],
    topGroups: [],
  });
  const [trendsView, setTrendsView] = useState<"daily" | "weekly">("weekly");
  const [showAllIcd10, setShowAllIcd10] = useState(false);
  const [selectedHospitalDetail, setSelectedHospitalDetail] =
    useState<HospitalSummaryRow | null>(null);
  const [selectedIcd10Detail, setSelectedIcd10Detail] =
    useState<PdfIcd10SummaryRow | null>(null);
  const [showAllHospitalIcd10, setShowAllHospitalIcd10] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const pageOptions = useMemo(
    () => Array.from({ length: totalPages }, (_, i) => i + 1),
    [totalPages],
  );

  const availableHospitals = useMemo(
    () =>
      selectedProvince
        ? hospitals.filter((h) => h.province === selectedProvince)
        : hospitals,
    [hospitals, selectedProvince],
  );

  const availableDistricts = useMemo(() => {
    const filtered = selectedProvince
      ? districts.filter((d) => d.province === selectedProvince)
      : districts;
    const seen = new Set<string>();
    return filtered.filter((d) => {
      if (seen.has(d.name)) return false;
      seen.add(d.name);
      return true;
    });
  }, [districts, selectedProvince]);

  const availableDiagcodes = useMemo(
    () =>
      selectedGroup
        ? diagcodes.filter((d) => d.group === selectedGroup)
        : diagcodes,
    [diagcodes, selectedGroup],
  );

  const isGuidelineStartDate = useMemo(
    () =>
      Boolean(
        startDate &&
        format(startDate, "yyyy-MM-dd") === SURVEILLANCE_DEFAULT_START_DATE,
      ),
    [startDate],
  );

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", format(startDate, "yyyy-MM-dd"));
    if (endDate) params.append("endDate", format(endDate, "yyyy-MM-dd"));
    if (selectedProvince) params.append("province", selectedProvince);
    if (selectedDistrict) params.append("district", selectedDistrict);
    if (selectedGroup) params.append("group", selectedGroup);
    if (selectedDiagcode) params.append("diagcode", selectedDiagcode);
    selectedHosps.forEach((h) => params.append("hospitalIds", h.id));
    return params;
  }, [
    startDate,
    endDate,
    selectedProvince,
    selectedDistrict,
    selectedGroup,
    selectedDiagcode,
    selectedHosps,
  ]);

  const fetchData = useCallback(
    async (page: number, params: URLSearchParams) => {
      setLoading((prev) => ({ ...prev, table: true }));
      try {
        const newParams = new URLSearchParams(params);
        newParams.append("page", page.toString());
        newParams.append("limit", itemsPerPage.toString());
        const res = await axios.get<{
          data: RawDataEntry[];
          totalCount: number;
        }>(`/api/raw-data?${newParams.toString()}`);
        setRawData(res.data.data);
        setTotalCount(res.data.totalCount);
      } catch (err) {
        console.error("Failed to fetch raw data:", err);
      } finally {
        setLoading((prev) => ({ ...prev, table: false }));
      }
    },
    [itemsPerPage],
  );

  const fetchDashboardData = useCallback(
    async (params: URLSearchParams) => {
      setLoading((prev) => ({ ...prev, dashboard: true }));
      try {
        const trendParams = new URLSearchParams(params);
        trendParams.append("view", trendsView);

        const hospitalTrendParams = new URLSearchParams(params);
        hospitalTrendParams.append("view", "weekly");
        hospitalTrendParams.append("groupBy", "hospital");

        const groupTrendParams = new URLSearchParams(params);
        groupTrendParams.append("view", "weekly");
        groupTrendParams.append("groupBy", "group");

        const [
          metricsRes,
          trendsRes,
          hospTrendsRes,
          groupTrendsRes,
          top5Res,
          summaryRes,
        ] = await Promise.all([
          axios.get<Metrics>(`/api/metrics?${params.toString()}`),
          axios.get<TrendData[]>(`/api/trends?${trendParams.toString()}`),
          axios.get<MultiSeriesTrendData>(
            `/api/trends?${hospitalTrendParams.toString()}`,
          ),
          axios.get<MultiSeriesTrendData>(
            `/api/trends?${groupTrendParams.toString()}`,
          ),
          axios.get<Top5Response>(`/api/top5?${params.toString()}`),
          axios.get<SurveillanceSummaryResponse>(
            `/api/surveillance-summary?${params.toString()}`,
          ),
        ]);
        setMetrics(metricsRes.data);
        setTrendsData(trendsRes.data);
        setWeeklyByHospital(hospTrendsRes.data);
        setWeeklyByGroup(groupTrendsRes.data);
        setTop5Data(top5Res.data);
        setHospitalSummary(summaryRes.data.hospitals);
        setIcd10Summary(summaryRes.data.icd10Summary);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setLoading((prev) => ({ ...prev, dashboard: false }));
      }
    },
    [trendsView],
  );

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const res = await axios.get<FilterData>("/api/filters");
        setHospitals(res.data.hospitals);
        setProvinces(res.data.provinces);
        setDistricts(res.data.districts);
        setGroups(res.data.groups);
        setDiagcodes(res.data.diagcodes);
      } catch (err) {
        console.error("Failed to load filter data:", err);
      }
    };
    loadFilters();
  }, []);

  const prevFilterKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const params = buildParams();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchDashboardData sets loading synchronously before its first await
    fetchDashboardData(params);
  }, [buildParams, fetchDashboardData]);

  useEffect(() => {
    const params = buildParams();
    const filterKey = params.toString();
    if (
      prevFilterKeyRef.current !== null &&
      prevFilterKeyRef.current !== filterKey
    ) {
      prevFilterKeyRef.current = filterKey;
      if (currentPage !== 1) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to page 1 when filters change; subsequent render triggers fetchData for page 1
        setCurrentPage(1);
        return;
      }
    }
    prevFilterKeyRef.current = filterKey;
    fetchData(currentPage, params);
  }, [buildParams, currentPage, fetchData]);

  const handleExport = async () => {
    try {
      const params = buildParams();
      params.append("export", "true");
      const res = await axios.get<{ data: RawDataEntry[] }>(
        `/api/raw-data?${params.toString()}`,
      );

      downloadCsv(
        res.data.data.map((row) => ({
          date_serv: row.date_serv,
          hospcode: row.hospcode,
          hosname: row.hosname || "",
          provname: row.provname || "",
          dist_name_th: row.dist_name_th || "",
          diagcode: row.diagcode,
          groupname: row.groupname || "",
          total_count: row.total_count,
        })),
        [
          "date_serv",
          "hospcode",
          "hosname",
          "provname",
          "dist_name_th",
          "diagcode",
          "groupname",
          "total_count",
        ],
        `maekok-raw-data_${format(new Date(), "yyyy-MM-dd")}.csv`,
      );
    } catch (err) {
      console.error("Failed to export data:", err);
    }
  };

  const handleExportHospitals = () => {
    if (hospitalSummary.length === 0) return;
    const rows = hospitalSummary.map((h) => ({
      ลำดับ: h.order,
      จังหวัด: h.provname,
      อำเภอ: h.district,
      โรงพยาบาล: h.name,
      รหัสสถานพยาบาล: h.hospcode,
      จำนวนผู้ป่วย: h.totalCases,
      กลุ่มอาการที่พบสูงสุด: h.byGroup[0]?.groupname || "-",
    }));
    downloadCsv(
      rows,
      [
        "ลำดับ",
        "จังหวัด",
        "อำเภอ",
        "โรงพยาบาล",
        "รหัสสถานพยาบาล",
        "จำนวนผู้ป่วย",
        "กลุ่มอาการที่พบสูงสุด",
      ],
      `maekok-hospitals-summary_${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
  };

  const handleExportHospitalDetail = (hospital: HospitalSummaryRow) => {
    const rows = hospital.byIcd10.map((item) => ({
      รหัสสถานพยาบาล: hospital.hospcode,
      โรงพยาบาล: hospital.name,
      จังหวัด: hospital.provname,
      อำเภอ: hospital.district,
      ลำดับ: item.order,
      "หมวดอาการ/โรค": item.category,
      "อาการ/โรค": item.name,
      "รหัส ICD-10 (แนวทาง)": item.icd10Label,
      "รหัสที่พบใน DB": item.matchedCodes.join(", "),
      จำนวนผู้ป่วย: item.totalCases,
    }));
    downloadCsv(
      rows,
      [
        "รหัสสถานพยาบาล",
        "โรงพยาบาล",
        "จังหวัด",
        "อำเภอ",
        "ลำดับ",
        "หมวดอาการ/โรค",
        "อาการ/โรค",
        "รหัส ICD-10 (แนวทาง)",
        "รหัสที่พบใน DB",
        "จำนวนผู้ป่วย",
      ],
      `maekok-hospital-${hospital.hospcode}_${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
  };

  const handleExportIcd10 = () => {
    if (icd10Summary.length === 0) return;
    const hospitalCols = hospitalSummary.map(
      (h) => `${h.name} (${h.hospcode})`,
    );
    const rows = icd10Summary.map((item) => {
      const base: Record<string, string | number> = {
        ลำดับ: item.order,
        "หมวดอาการ/โรค": item.category,
        "อาการ/โรค": item.name,
        "รหัส ICD-10 (แนวทาง)": item.icd10Label,
        "รหัสที่พบใน DB": item.matchedCodes.join(", "),
        จำนวนผู้ป่วยรวม: item.totalCases,
      };
      item.byHospital.forEach((bh) => {
        base[`${bh.name} (${bh.hospcode})`] = bh.totalCases;
      });
      return base;
    });
    downloadCsv(
      rows,
      [
        "ลำดับ",
        "หมวดอาการ/โรค",
        "อาการ/โรค",
        "รหัส ICD-10 (แนวทาง)",
        "รหัสที่พบใน DB",
        "จำนวนผู้ป่วยรวม",
        ...hospitalCols,
      ],
      `maekok-icd10-31-summary_${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
  };

  const handleExportIcd10Detail = (item: PdfIcd10SummaryRow) => {
    const rows = item.byHospital.map((bh, idx) => ({
      ลำดับ: idx + 1,
      รหัสสถานพยาบาล: bh.hospcode,
      โรงพยาบาล: bh.name,
      จังหวัด: bh.provname,
      อำเภอ: bh.district,
      "อาการ/โรค": item.name,
      "รหัส ICD-10 (แนวทาง)": item.icd10Label,
      "รหัสที่พบใน DB": bh.matchedCodes.join(", "),
      จำนวนผู้ป่วย: bh.totalCases,
    }));
    downloadCsv(
      rows,
      [
        "ลำดับ",
        "รหัสสถานพยาบาล",
        "โรงพยาบาล",
        "จังหวัด",
        "อำเภอ",
        "อาการ/โรค",
        "รหัส ICD-10 (แนวทาง)",
        "รหัสที่พบใน DB",
        "จำนวนผู้ป่วย",
      ],
      `maekok-icd10-${item.order}-by-hospital_${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
  };

  const handleStartDateSelect = (date: Date | undefined) => {
    setStartDate(date);
    if (!date || (endDate && endDate < date)) {
      setEndDate(undefined);
    }
  };

  const handleProvinceChange = (value: string) => {
    const nextProvince = value === "all" ? "" : value;
    setSelectedProvince(nextProvince);
    setSelectedDistrict("");
    if (nextProvince) {
      setSelectedHosps((prev) =>
        prev.filter((h) => h.province === nextProvince),
      );
    }
  };

  const handleGroupChange = (value: string) => {
    const nextGroup = value === "all" ? "" : value;
    setSelectedGroup(nextGroup);
    if (nextGroup) {
      const matchingCodes = new Set(
        diagcodes.filter((d) => d.group === nextGroup).map((d) => d.code),
      );
      if (selectedDiagcode && !matchingCodes.has(selectedDiagcode)) {
        setSelectedDiagcode("");
      }
    }
  };

  const clearFilters = () => {
    setStartDate(getGuidelineStartDate());
    setEndDate(undefined);
    setSelectedProvince("");
    setSelectedDistrict("");
    setSelectedGroup("");
    setSelectedDiagcode("");
    setSelectedHosps([]);
  };

  const visibleIcd10Rows = useMemo(
    () =>
      showAllIcd10
        ? icd10Summary
        : icd10Summary.filter((r) => r.totalCases > 0),
    [icd10Summary, showAllIcd10],
  );

  const reportedIcd10Count = useMemo(
    () => icd10Summary.filter((r) => r.totalCases > 0).length,
    [icd10Summary],
  );

  return (
    <main className="p-4 md:p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Section: Guideline Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm text-blue-900">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              <strong>แนวทางเฝ้าระวังกรณีปนเปื้อนสารหนูลำน้ำกก:</strong>{" "}
              สถานพยาบาลเฝ้าระวัง 8 แห่ง (เชียงราย 7, เชียงใหม่ 1) • รหัส ICD-10
              เฝ้าระวัง 31 รายการ • *
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isGuidelineStartDate ? "default" : "outline"}
              onClick={() => handleStartDateSelect(getGuidelineStartDate())}
            >
              ตั้งแต่ 1 ม.ค. 2566 *
            </Button>
            <Button
              size="sm"
              variant={!startDate ? "default" : "outline"}
              onClick={() => handleStartDateSelect(undefined)}
            >
              ดูข้อมูลทุกปี
            </Button>
          </div>
        </div>

        {/* Section: Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="ผู้ป่วยสะสมทั้งหมด"
            value={metrics?.totalCases ?? 0}
            subtitle={
              startDate
                ? `ตั้งแต่ ${format(startDate, "dd MMM yyyy", { locale: th })}`
                : "ข้อมูลทั้งหมดทุกปี"
            }
            icon={<Users className="h-5 w-5 text-blue-500" />}
            loading={loading.dashboard}
          />
          <MetricCard
            title="จำนวน รพ. ที่รายงาน"
            value={metrics?.hospitalCount ?? 0}
            subtitle="จากเป้าหมายเฝ้าระวัง 8 แห่ง"
            icon={<Hospital className="h-5 w-5 text-blue-500" />}
            loading={loading.dashboard}
          />
          <MetricCard
            title="จังหวัดที่พบสูงสุด"
            value={metrics?.topProvince ?? "N/A"}
            icon={<BarChart className="h-5 w-5 text-blue-500" />}
            loading={loading.dashboard}
          />
          <MetricCard
            title="กลุ่มอาการที่พบสูงสุด"
            value={metrics?.topGroup ?? "N/A"}
            icon={<Activity className="h-5 w-5 text-blue-500" />}
            loading={loading.dashboard}
          />
        </div>

        {/* Section: Filters */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-800 to-blue-600 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-cyan-50 flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  <span>ตัวกรองข้อมูล</span>
                </CardTitle>
                <CardDescription className="text-blue-200">
                  กรองข้อมูลตามช่วงเวลา จังหวัด อำเภอ โรงพยาบาล กลุ่มอาการ
                  และรหัส ICD-10
                </CardDescription>
              </div>
              <Button
                variant="destructive"
                onClick={clearFilters}
                disabled={loading.table}
              >
                <X className="w-4 h-4 mr-2" /> ล้างตัวกรอง
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label
                  htmlFor="start-date"
                  className="text-blue-900 font-medium"
                >
                  ช่วงเวลาเริ่มต้น
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="start-date"
                      variant="outline"
                      className="w-full justify-start text-left font-normal border-blue-300 hover:bg-blue-50 text-blue-900"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? (
                        format(startDate, "PPP", { locale: th })
                      ) : (
                        <span>เลือกวันที่ (ทั้งหมด)</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-blue-200 shadow-lg">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={handleStartDateSelect}
                      autoFocus
                      locale={th}
                      className="border-0"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date" className="text-blue-900 font-medium">
                  ช่วงเวลาสิ้นสุด
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="end-date"
                      variant="outline"
                      className="w-full justify-start text-left font-normal border-blue-300 hover:bg-blue-50 text-blue-900"
                      disabled={!startDate}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? (
                        format(endDate, "PPP", { locale: th })
                      ) : (
                        <span>เลือกวันที่</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-blue-200 shadow-lg">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      autoFocus
                      locale={th}
                      disabled={startDate ? { before: startDate } : undefined}
                      className="border-0"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="province" className="text-blue-900 font-medium">
                  จังหวัด
                </Label>
                <Select
                  value={selectedProvince || "all"}
                  onValueChange={handleProvinceChange}
                  disabled={provinces.length === 0}
                >
                  <SelectTrigger className="border-blue-300 hover:bg-blue-50 text-blue-900">
                    <SelectValue placeholder="เลือกจังหวัด..." />
                  </SelectTrigger>
                  <SelectContent className="border-blue-200 shadow-lg">
                    <SelectItem value="all" className="hover:bg-blue-50">
                      ทั้งหมด
                    </SelectItem>
                    {provinces.map((prov) => (
                      <SelectItem
                        key={prov.id}
                        value={prov.id}
                        className="hover:bg-blue-50"
                      >
                        {prov.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="district" className="text-blue-900 font-medium">
                  อำเภอ
                </Label>
                <Select
                  value={selectedDistrict || "all"}
                  onValueChange={(value) =>
                    setSelectedDistrict(value === "all" ? "" : value)
                  }
                  disabled={availableDistricts.length === 0}
                >
                  <SelectTrigger className="border-blue-300 hover:bg-blue-50 text-blue-900">
                    <SelectValue placeholder="เลือกอำเภอ..." />
                  </SelectTrigger>
                  <SelectContent className="border-blue-200 shadow-lg">
                    <SelectItem value="all" className="hover:bg-blue-50">
                      ทั้งหมด
                    </SelectItem>
                    {availableDistricts.map((d) => (
                      <SelectItem
                        key={d.name}
                        value={d.name}
                        className="hover:bg-blue-50"
                      >
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="group" className="text-blue-900 font-medium">
                  กลุ่มอาการ
                </Label>
                <Select
                  value={selectedGroup || "all"}
                  onValueChange={handleGroupChange}
                  disabled={groups.length === 0}
                >
                  <SelectTrigger className="border-blue-300 hover:bg-blue-50 text-blue-900">
                    <SelectValue placeholder="เลือกกลุ่มอาการ..." />
                  </SelectTrigger>
                  <SelectContent className="border-blue-200 shadow-lg">
                    <SelectItem value="all" className="hover:bg-blue-50">
                      ทั้งหมด
                    </SelectItem>
                    {groups.map((group) => (
                      <SelectItem
                        key={group.name}
                        value={group.name}
                        className="hover:bg-blue-50"
                      >
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="diagcode" className="text-blue-900 font-medium">
                  รหัสวินิจฉัยโรค (ICD-10)
                </Label>
                <Select
                  value={selectedDiagcode || "all"}
                  onValueChange={(value) =>
                    setSelectedDiagcode(value === "all" ? "" : value)
                  }
                  disabled={availableDiagcodes.length === 0}
                >
                  <SelectTrigger className="border-blue-300 hover:bg-blue-50 text-blue-900">
                    <SelectValue placeholder="เลือกรหัสโรค..." />
                  </SelectTrigger>
                  <SelectContent className="border-blue-200 shadow-lg max-h-[300px]">
                    <SelectItem value="all" className="hover:bg-blue-50">
                      ทั้งหมด
                    </SelectItem>
                    {availableDiagcodes.map((d) => (
                      <SelectItem
                        key={d.code}
                        value={d.code}
                        className="hover:bg-blue-50"
                      >
                        {d.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label
                  htmlFor="hospital-search"
                  className="text-blue-900 font-medium"
                >
                  ค้นหาโรงพยาบาล (8 แห่งเฝ้าระวัง)
                </Label>
                <Popover
                  open={openHospitalPopover}
                  onOpenChange={setOpenHospitalPopover}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openHospitalPopover}
                      className="w-full justify-between border-blue-300 hover:bg-blue-50 text-blue-900"
                      disabled={availableHospitals.length === 0}
                    >
                      {selectedHosps.length > 0
                        ? `เลือกแล้ว ${selectedHosps.length} แห่ง`
                        : "เลือกโรงพยาบาล..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 border-blue-200 shadow-lg">
                    <Command>
                      <CommandInput
                        placeholder="ค้นหาโรงพยาบาล..."
                        className="border-blue-100 focus:ring-2 focus:ring-cyan-500"
                      />
                      <CommandList className="max-h-[300px] overflow-y-auto">
                        <CommandEmpty className="text-blue-800 py-4 text-center">
                          ไม่พบโรงพยาบาล
                        </CommandEmpty>
                        <CommandGroup className="bg-white">
                          {availableHospitals.map((h) => {
                            const provinceName = provinces.find(
                              (p) => p.id === h.province,
                            )?.name;
                            const isSelected = selectedHosps.some(
                              (sh) => sh.id === h.id,
                            );
                            return (
                              <CommandItem
                                key={h.id}
                                value={`${h.id} ${h.name}`}
                                onSelect={() => {
                                  setSelectedHosps((prev) =>
                                    prev.some((sh) => sh.id === h.id)
                                      ? prev.filter((x) => x.id !== h.id)
                                      : [...prev, h],
                                  );
                                }}
                                className="aria-selected:bg-blue-50 hover:bg-blue-50 cursor-pointer"
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <div
                                    className={`w-4 h-4 flex items-center justify-center rounded border mr-2 ${
                                      isSelected
                                        ? "bg-blue-600 border-blue-600 text-white"
                                        : "border-blue-300"
                                    }`}
                                  >
                                    {isSelected && (
                                      <Check className="w-3 h-3" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-blue-900 truncate">
                                      {h.name}
                                    </div>
                                    <div className="flex justify-between text-xs text-blue-600">
                                      <span>รหัส: {h.id}</span>
                                      {provinceName && (
                                        <span>จ.{provinceName}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {selectedHosps.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedHosps.map((hosp) => (
                  <Badge
                    key={hosp.id}
                    variant="secondary"
                    className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 border-blue-200"
                  >
                    <span className="truncate max-w-xs">{hosp.name}</span>
                    <button
                      onClick={() =>
                        setSelectedHosps((prev) =>
                          prev.filter((h) => h.id !== hosp.id),
                        )
                      }
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section: Overall Trends Chart */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="text-blue-900">
                  แนวโน้มผู้ป่วยรวมตามช่วงเวลา
                </CardTitle>
                <CardDescription className="text-blue-700 mt-1">
                  กราฟเส้นแสดงจำนวนผู้ป่วยรวม
                  {trendsView === "daily" ? "รายวัน" : "รายสัปดาห์"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={trendsView === "daily" ? "default" : "outline"}
                  onClick={() => setTrendsView("daily")}
                >
                  รายวัน
                </Button>
                <Button
                  size="sm"
                  variant={trendsView === "weekly" ? "default" : "outline"}
                  onClick={() => setTrendsView("weekly")}
                >
                  รายสัปดาห์
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[360px] pt-4">
            <TrendsChart data={trendsData} loading={loading.dashboard} />
          </CardContent>
        </Card>

        {/* Section: Weekly Breakdown Charts (PDF Page 4 Requirement #3) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-blue-900">
                แนวโน้มผู้ป่วยรายสัปดาห์ แยกรายโรงพยาบาล
              </CardTitle>
              <CardDescription className="text-blue-700">
                รวมข้อมูลเป็นรายสัปดาห์ แยกตามสถานพยาบาลเฝ้าระวังทั้ง 8 แห่ง
                (คลิกชื่อ รพ. บนกราฟเพื่อเปิด/ปิดเส้น)
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[380px] pt-2">
              <TrendsChart
                multiSeries={weeklyByHospital}
                loading={loading.dashboard}
              />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-blue-900">
                แนวโน้มผู้ป่วยรายสัปดาห์ แยกรายกลุ่มโรค
              </CardTitle>
              <CardDescription className="text-blue-700">
                รวมข้อมูลเป็นรายสัปดาห์ แยกตามกลุ่มอาการและรหัสโรคที่เฝ้าระวัง
                (คลิกชื่อกลุ่มเพื่อเปิด/ปิดเส้น)
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[380px] pt-2">
              <TrendsChart
                multiSeries={weeklyByGroup}
                loading={loading.dashboard}
              />
            </CardContent>
          </Card>
        </div>

        {/* Section: Top 5 Rankings */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Top5List
            title="จังหวัดที่พบผู้ป่วยสูงสุด"
            data={top5Data.topProvinces}
            icon={<MapPin className="h-5 w-5 text-blue-600" />}
            loading={loading.dashboard}
          />
          <Top5List
            title="โรงพยาบาลที่พบผู้ป่วยสูงสุด"
            data={top5Data.topHospitals}
            icon={<Building className="h-5 w-5 text-blue-600" />}
            loading={loading.dashboard}
          />
          <Top5List
            title="กลุ่มอาการที่พบสูงสุด"
            data={top5Data.topGroups}
            icon={<ListChecks className="h-5 w-5 text-blue-600" />}
            loading={loading.dashboard}
          />
        </div>

        {/* Section: 8 Surveillance Hospitals Summary (PDF Page 3) */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-800 to-blue-600 rounded-t-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-cyan-50 flex items-center gap-2">
                  <Hospital className="w-5 h-5" />
                  <span>สถานพยาบาลที่เฝ้าระวังทั้ง 8 แห่ง </span>
                </CardTitle>
                <CardDescription className="text-blue-200 mt-1">
                  แสดงจำนวนผู้ป่วยรวมของโรงพยาบาลเฝ้าระวังในจังหวัดเชียงราย (7
                  แห่ง) และเชียงใหม่ (1 แห่ง) —
                  คลิกแถวเพื่อดูรายละเอียดแยกตามอาการโรค
                </CardDescription>
              </div>
              <Button
                onClick={handleExportHospitals}
                disabled={loading.dashboard || hospitalSummary.length === 0}
                className="bg-cyan-500 hover:bg-cyan-600 text-blue-900"
              >
                <Download className="w-4 h-4 mr-2" />
                Export to CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {loading.dashboard ? (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full bg-blue-100" />
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-blue-200 overflow-x-auto">
                <Table className="bg-white min-w-full">
                  <TableHeader className="bg-blue-100/50">
                    <TableRow>
                      <TableHead className="text-blue-900 font-medium w-16 text-center">
                        ลำดับ
                      </TableHead>
                      <TableHead className="text-blue-900 font-medium">
                        จังหวัด
                      </TableHead>
                      <TableHead className="text-blue-900 font-medium">
                        อำเภอ
                      </TableHead>
                      <TableHead className="text-blue-900 font-medium">
                        โรงพยาบาล
                      </TableHead>
                      <TableHead className="text-blue-900 font-medium">
                        รหัสสถานพยาบาล
                      </TableHead>
                      <TableHead className="text-blue-900 font-medium text-right">
                        จำนวนผู้ป่วย
                      </TableHead>
                      <TableHead className="text-blue-900 font-medium text-center">
                        รายละเอียด
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hospitalSummary.map((h) => (
                      <TableRow
                        key={h.hospcode}
                        onClick={() => {
                          setShowAllHospitalIcd10(false);
                          setSelectedHospitalDetail(h);
                        }}
                        className="hover:bg-blue-50/70 cursor-pointer"
                      >
                        <TableCell className="text-center font-medium">
                          {h.order}
                        </TableCell>
                        <TableCell>{h.provname}</TableCell>
                        <TableCell>{h.district}</TableCell>
                        <TableCell className="font-medium text-blue-900">
                          {h.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{h.hospcode}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-blue-900">
                          {h.totalCases.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-blue-300 text-blue-800 hover:bg-blue-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAllHospitalIcd10(false);
                              setSelectedHospitalDetail(h);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            ดูรายละเอียด
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section: PDF 31 ICD-10 Surveillance Summary (PDF Pages 1-2) */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-800 to-blue-600 rounded-t-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-cyan-50 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  <span>สรุปตามตารางรหัส ICD-10 เฝ้าระวัง 31 รายการ</span>
                </CardTitle>
                <CardDescription className="text-blue-200 mt-1">
                  พบข้อมูลในฐานข้อมูล {reportedIcd10Count} จากทั้งหมด 31
                  รายการตามตัวกรองที่เลือก — คลิกแถวเพื่อดูจำนวนผู้ป่วยแยกตาม
                  รพ.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowAllIcd10((prev) => !prev)}
                >
                  {showAllIcd10
                    ? "แสดงเฉพาะรหัสที่พบข้อมูล"
                    : "แสดงครบทั้ง 31 รายการ"}
                </Button>
                <Button
                  onClick={handleExportIcd10}
                  disabled={loading.dashboard || icd10Summary.length === 0}
                  className="bg-cyan-500 hover:bg-cyan-600 text-blue-900"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export to CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {loading.dashboard ? (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full bg-blue-100" />
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-blue-200 overflow-x-auto">
                <Table className="bg-white min-w-full">
                  <TableHeader className="bg-blue-100/50">
                    <TableRow>
                      <TableHead className="text-blue-900 font-medium w-16 text-center">
                        ลำดับ
                      </TableHead>
                      <TableHead className="text-blue-900 font-medium">
                        หมวดอาการ/โรค
                      </TableHead>
                      <TableHead className="text-blue-900 font-medium">
                        อาการ/โรค
                      </TableHead>
                      <TableHead className="text-blue-900 font-medium">
                        รหัส ICD-10 (แนวทาง)
                      </TableHead>
                      <TableHead className="text-blue-900 font-medium">
                        รหัสที่พบใน DB
                      </TableHead>
                      <TableHead className="text-blue-900 font-medium text-right">
                        จำนวนผู้ป่วย
                      </TableHead>
                      <TableHead className="text-blue-900 font-medium text-center">
                        แยกตาม รพ.
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleIcd10Rows.length > 0 ? (
                      visibleIcd10Rows.map((item) => (
                        <TableRow
                          key={item.order}
                          onClick={() => setSelectedIcd10Detail(item)}
                          className="hover:bg-blue-50/70 cursor-pointer"
                        >
                          <TableCell className="text-center font-medium">
                            {item.order}
                          </TableCell>
                          <TableCell className="text-xs text-blue-700">
                            {item.category}
                          </TableCell>
                          <TableCell className="text-blue-900">
                            {item.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.icd10Label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {item.matchedCodes.length > 0 ? (
                              item.matchedCodes.join(", ")
                            ) : (
                              <span className="text-slate-400">
                                ยังไม่มีข้อมูลจาก ETL
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-blue-900">
                            {item.totalCases.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-blue-300 text-blue-800 hover:bg-blue-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedIcd10Detail(item);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              รายละเอียด
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-6 text-slate-500"
                        >
                          ไม่พบข้อมูลรหัส ICD-10 ตามเงื่อนไขที่เลือก
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section: Data Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-800 to-blue-600 rounded-t-lg">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div className="space-y-1">
                <CardTitle className="text-cyan-50">
                  ตารางข้อมูลรายวัน
                </CardTitle>
                <CardDescription className="text-blue-200">
                  {!loading.table &&
                    `แสดง ${rawData.length} จากทั้งหมด ${totalCount.toLocaleString()} รายการ (ฐานข้อมูลสรุประดับจังหวัด/อำเภอ )`}
                </CardDescription>
              </div>
              <Button
                onClick={handleExport}
                disabled={loading.table || rawData.length === 0}
                className="bg-cyan-500 hover:bg-cyan-600 text-blue-900"
              >
                <Download className="w-4 h-4 mr-2" />
                Export to CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {loading.table ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-10 w-full rounded-md bg-blue-100"
                  />
                ))}
              </div>
            ) : rawData.length > 0 ? (
              <>
                <div className="rounded-md border border-blue-200 overflow-x-auto">
                  <Table className="bg-white min-w-full">
                    <TableHeader className="bg-blue-100/50">
                      <TableRow>
                        <TableHead className="text-blue-900 font-medium">
                          วันที่
                        </TableHead>
                        <TableHead className="text-blue-900 font-medium">
                          รหัส รพ.
                        </TableHead>
                        <TableHead className="text-blue-900 font-medium">
                          ชื่อ รพ.
                        </TableHead>
                        <TableHead className="text-blue-900 font-medium">
                          จังหวัด
                        </TableHead>
                        <TableHead className="text-blue-900 font-medium">
                          อำเภอ
                        </TableHead>
                        <TableHead className="text-blue-900 font-medium">
                          รหัสโรค
                        </TableHead>
                        <TableHead className="text-blue-900 font-medium">
                          กลุ่มอาการ
                        </TableHead>
                        <TableHead className="text-blue-900 font-medium text-right">
                          จำนวน
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rawData.map((row, index) => (
                        <TableRow
                          key={`${row.hospcode}-${row.date_serv}-${row.diagcode}-${index}`}
                          className="hover:bg-blue-50/50"
                        >
                          <TableCell className="whitespace-nowrap">
                            {formatDateServ(row.date_serv)}
                          </TableCell>
                          <TableCell>{row.hospcode}</TableCell>
                          <TableCell>{row.hosname}</TableCell>
                          <TableCell>{row.provname}</TableCell>
                          <TableCell>{row.dist_name_th}</TableCell>
                          <TableCell>{row.diagcode}</TableCell>
                          <TableCell>{row.groupname}</TableCell>
                          <TableCell className="text-right">
                            {row.total_count}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
                  <div className="flex flex-wrap items-center gap-4 text-sm text-blue-800">
                    <div className="flex items-center gap-2">
                      <span>แสดง</span>
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={(val) => {
                          setItemsPerPage(Number(val));
                          setCurrentPage(1);
                        }}
                        disabled={loading.table}
                      >
                        <SelectTrigger className="w-[84px] h-9 border-blue-300 text-blue-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[10, 20, 50, 100].map((size) => (
                            <SelectItem key={size} value={size.toString()}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span>รายการ/หน้า</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span>หน้า</span>
                      <Select
                        value={currentPage.toString()}
                        onValueChange={(val) => setCurrentPage(Number(val))}
                        disabled={loading.table}
                      >
                        <SelectTrigger className="w-[96px] h-9 border-blue-300 text-blue-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-[260px]">
                          {pageOptions.map((pageNum) => (
                            <SelectItem
                              key={pageNum}
                              value={pageNum.toString()}
                            >
                              {pageNum.toLocaleString()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span>จาก {totalPages.toLocaleString()} หน้า</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1 || loading.table}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages || loading.table}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-blue-50/50 rounded-lg">
                <Search className="w-12 h-12 text-blue-400 mb-4" />
                <h3 className="text-lg font-medium text-blue-900">
                  ไม่พบข้อมูล
                </h3>
                <p className="text-blue-600 mt-2">
                  ลองเปลี่ยนเงื่อนไขการค้นหาของคุณ
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Hospital Breakdown by Disease/Symptom */}
      <Dialog
        open={Boolean(selectedHospitalDetail)}
        onOpenChange={(open) => {
          if (!open) setSelectedHospitalDetail(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {selectedHospitalDetail && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-start justify-between gap-3 pr-6">
                  <div>
                    <DialogTitle className="text-blue-900 text-lg">
                      {selectedHospitalDetail.name} (รหัส:{" "}
                      {selectedHospitalDetail.hospcode})
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      อ.{selectedHospitalDetail.district} จ.
                      {selectedHospitalDetail.provname} • ผู้ป่วยรวม{" "}
                      <strong className="text-blue-900">
                        {selectedHospitalDetail.totalCases.toLocaleString()}
                      </strong>{" "}
                      ราย
                    </DialogDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      handleExportHospitalDetail(selectedHospitalDetail)
                    }
                    className="bg-cyan-500 hover:bg-cyan-600 text-blue-900"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export to CSV
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-2">
                {/* Summary by Group */}
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">
                    สรุปจำนวนผู้ป่วยแยกตามกลุ่มอาการ/โรค
                  </h4>
                  <div className="rounded-md border border-blue-200 overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-blue-50">
                        <TableRow>
                          <TableHead className="text-blue-900">
                            กลุ่มอาการ/โรค
                          </TableHead>
                          <TableHead className="text-blue-900 text-right">
                            จำนวนผู้ป่วย
                          </TableHead>
                          <TableHead className="text-blue-900 text-right">
                            สัดส่วน (%)
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedHospitalDetail.byGroup.length > 0 ? (
                          selectedHospitalDetail.byGroup.map((g) => {
                            const pct =
                              selectedHospitalDetail.totalCases > 0
                                ? (
                                    (g.totalCases /
                                      selectedHospitalDetail.totalCases) *
                                    100
                                  ).toFixed(1)
                                : "0.0";
                            return (
                              <TableRow key={g.groupname}>
                                <TableCell className="text-blue-900">
                                  {g.groupname}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-blue-900">
                                  {g.totalCases.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right text-slate-600">
                                  {pct}%
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={3}
                              className="text-center py-4 text-slate-500"
                            >
                              ไม่มีข้อมูลผู้ป่วยตามตัวกรองที่เลือก
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Breakdown by 31 ICD-10 items */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h4 className="text-sm font-semibold text-blue-900">
                      รายละเอียดแยกตามอาการโรค (ตารางรหัส ICD-10 เฝ้าระวัง 31
                      รายการ)
                    </h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAllHospitalIcd10((prev) => !prev)}
                    >
                      {showAllHospitalIcd10
                        ? "แสดงเฉพาะที่พบข้อมูล"
                        : "แสดงครบทั้ง 31 รายการ"}
                    </Button>
                  </div>
                  <div className="rounded-md border border-blue-200 overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-blue-50">
                        <TableRow>
                          <TableHead className="text-blue-900 w-14 text-center">
                            ลำดับ
                          </TableHead>
                          <TableHead className="text-blue-900">
                            หมวดอาการ/โรค
                          </TableHead>
                          <TableHead className="text-blue-900">
                            อาการ/โรค
                          </TableHead>
                          <TableHead className="text-blue-900">
                            รหัส ICD-10
                          </TableHead>
                          <TableHead className="text-blue-900">
                            รหัสใน DB
                          </TableHead>
                          <TableHead className="text-blue-900 text-right">
                            จำนวนผู้ป่วย
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(showAllHospitalIcd10
                          ? selectedHospitalDetail.byIcd10
                          : selectedHospitalDetail.byIcd10.filter(
                              (i) => i.totalCases > 0,
                            )
                        ).map((item) => (
                          <TableRow key={item.order}>
                            <TableCell className="text-center">
                              {item.order}
                            </TableCell>
                            <TableCell className="text-xs text-blue-700">
                              {item.category}
                            </TableCell>
                            <TableCell className="text-blue-900">
                              {item.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.icd10Label}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {item.matchedCodes.length > 0
                                ? item.matchedCodes.join(", ")
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-blue-900">
                              {item.totalCases.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                        {!showAllHospitalIcd10 &&
                          selectedHospitalDetail.byIcd10.every(
                            (i) => i.totalCases === 0,
                          ) && (
                            <TableRow>
                              <TableCell
                                colSpan={6}
                                className="text-center py-4 text-slate-500"
                              >
                                ไม่พบข้อมูลตามตัวกรองที่เลือก
                              </TableCell>
                            </TableRow>
                          )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: ICD-10 Breakdown by Hospital */}
      <Dialog
        open={Boolean(selectedIcd10Detail)}
        onOpenChange={(open) => {
          if (!open) setSelectedIcd10Detail(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {selectedIcd10Detail && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-start justify-between gap-3 pr-6">
                  <div>
                    <DialogTitle className="text-blue-900 text-lg">
                      ข้อที่ {selectedIcd10Detail.order}:{" "}
                      {selectedIcd10Detail.name} (
                      {selectedIcd10Detail.icd10Label})
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      หมวด: {selectedIcd10Detail.category} • ผู้ป่วยรวม{" "}
                      <strong className="text-blue-900">
                        {selectedIcd10Detail.totalCases.toLocaleString()}
                      </strong>{" "}
                      ราย
                      {selectedIcd10Detail.matchedCodes.length > 0 &&
                        ` • รหัสใน DB: ${selectedIcd10Detail.matchedCodes.join(", ")}`}
                    </DialogDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleExportIcd10Detail(selectedIcd10Detail)}
                    className="bg-cyan-500 hover:bg-cyan-600 text-blue-900"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export to CSV
                  </Button>
                </div>
              </DialogHeader>

              <div className="rounded-md border border-blue-200 overflow-x-auto mt-2">
                <Table>
                  <TableHeader className="bg-blue-50">
                    <TableRow>
                      <TableHead className="text-blue-900 w-14 text-center">
                        ลำดับ
                      </TableHead>
                      <TableHead className="text-blue-900">จังหวัด</TableHead>
                      <TableHead className="text-blue-900">อำเภอ</TableHead>
                      <TableHead className="text-blue-900">โรงพยาบาล</TableHead>
                      <TableHead className="text-blue-900">รหัส รพ.</TableHead>
                      <TableHead className="text-blue-900">รหัสใน DB</TableHead>
                      <TableHead className="text-blue-900 text-right">
                        จำนวนผู้ป่วย
                      </TableHead>
                      <TableHead className="text-blue-900 text-right">
                        สัดส่วน (%)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedIcd10Detail.byHospital.map((bh, idx) => {
                      const pct =
                        selectedIcd10Detail.totalCases > 0
                          ? (
                              (bh.totalCases / selectedIcd10Detail.totalCases) *
                              100
                            ).toFixed(1)
                          : "0.0";
                      return (
                        <TableRow key={bh.hospcode}>
                          <TableCell className="text-center">
                            {idx + 1}
                          </TableCell>
                          <TableCell>{bh.provname}</TableCell>
                          <TableCell>{bh.district}</TableCell>
                          <TableCell className="font-medium text-blue-900">
                            {bh.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{bh.hospcode}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {bh.matchedCodes.length > 0
                              ? bh.matchedCodes.join(", ")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-blue-900">
                            {bh.totalCases.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-slate-600">
                            {pct}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
