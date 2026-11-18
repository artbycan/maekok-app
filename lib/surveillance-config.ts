export interface SurveillanceHospital {
  order: number;
  hospcode: string;
  name: string;
  district: string;
  provcode: string;
  provname: string;
}

export interface PdfIcd10Item {
  order: number;
  category:
    | "อาการทางระบบประสาท"
    | "อาการทางผิวหนัง"
    | "อาการทางระบบทางเดินอาหาร"
    | "รหัสที่กองโรคจากการประกอบอาชีพและสิ่งแวดล้อม แนะนำ";
  name: string;
  icd10Label: string;
  /** Normalized uppercase ICD-10 prefixes without dots (e.g. "R200", "L30") */
  matchPrefixes: readonly string[];
}

/**
 * Recommended surveillance start date from PDF page 4 (1 มกราคม 2566 / 2023-01-01).
 */
export const SURVEILLANCE_DEFAULT_START_DATE = "2023-01-01";

/**
 * Province codes under surveillance (Health Region 1: Chiang Mai & Chiang Rai).
 */
export const SURVEILLANCE_PROVINCE_CODES = ["50", "57"] as const;

/**
 * Official 8 surveillance hospitals from the epidemiological surveillance guideline (PDF page 3).
 * Codes follow the 5-digit MOPH health facility code (HCODE / hospcode).
 */
export const SURVEILLANCE_HOSPITALS: readonly SurveillanceHospital[] = [
  {
    order: 1,
    hospcode: "10674",
    name: "โรงพยาบาลเชียงรายประชานุเคราะห์",
    district: "เมืองเชียงราย",
    provcode: "57",
    provname: "เชียงราย",
  },
  {
    order: 2,
    hospcode: "15012",
    name: "โรงพยาบาลสมเด็จพระญาณสังวรณ์",
    district: "เวียงชัย",
    provcode: "57",
    provname: "เชียงราย",
  },
  {
    order: 3,
    hospcode: "11202",
    name: "โรงพยาบาลเวียงเชียงรุ้ง",
    district: "เวียงเชียงรุ้ง",
    provcode: "57",
    provname: "เชียงราย",
  },
  {
    order: 4,
    hospcode: "11192",
    name: "โรงพยาบาลแม่จัน",
    district: "แม่จัน",
    provcode: "57",
    provname: "เชียงราย",
  },
  {
    order: 5,
    hospcode: "28823",
    name: "โรงพยาบาลดอยหลวง",
    district: "ดอยหลวง",
    provcode: "57",
    provname: "เชียงราย",
  },
  {
    order: 6,
    hospcode: "11193",
    name: "โรงพยาบาลเชียงแสน",
    district: "เชียงแสน",
    provcode: "57",
    provname: "เชียงราย",
  },
  {
    order: 7,
    hospcode: "11194",
    name: "โรงพยาบาลแม่สาย",
    district: "แม่สาย",
    provcode: "57",
    provname: "เชียงราย",
  },
  {
    order: 8,
    hospcode: "11126",
    name: "โรงพยาบาลแม่อาย",
    district: "แม่อาย",
    provcode: "50",
    provname: "เชียงใหม่",
  },
];

export const DEFAULT_SURVEILLANCE_HOSPITAL_CODES: readonly string[] =
  SURVEILLANCE_HOSPITALS.map((hospital) => hospital.hospcode);

/**
 * Complete 31 ICD-10 surveillance entries defined in PDF pages 1-2.
 */
export const PDF_ICD10_ITEMS: readonly PdfIcd10Item[] = [
  // อาการทางระบบประสาท (1-7)
  {
    order: 1,
    category: "อาการทางระบบประสาท",
    name: "Anaesthesia of skin",
    icd10Label: "R20.0-R20.3",
    matchPrefixes: ["R200", "R201", "R202", "R203"],
  },
  {
    order: 2,
    category: "อาการทางระบบประสาท",
    name: "Other and unspecified disturbances of skin sensation",
    icd10Label: "R20.8",
    matchPrefixes: ["R208"],
  },
  {
    order: 3,
    category: "อาการทางระบบประสาท",
    name: "Dizziness and giddiness",
    icd10Label: "R42",
    matchPrefixes: ["R42"],
  },
  {
    order: 4,
    category: "อาการทางระบบประสาท",
    name: "Systemic atrophies primarily affecting the central nervous system",
    icd10Label: "G10-G13",
    matchPrefixes: ["G10", "G11", "G12", "G13"],
  },
  {
    order: 5,
    category: "อาการทางระบบประสาท",
    name: "Extrapiramidal and movement disorders",
    icd10Label: "G20-G26",
    matchPrefixes: ["G20", "G21", "G22", "G23", "G24", "G25", "G26"],
  },
  {
    order: 6,
    category: "อาการทางระบบประสาท",
    name: "Other headache syndromes",
    icd10Label: "G44",
    matchPrefixes: ["G44"],
  },
  {
    order: 7,
    category: "อาการทางระบบประสาท",
    name: "Myasthenia gravis and other myoneural disorders",
    icd10Label: "G70",
    matchPrefixes: ["G70"],
  },
  // อาการทางผิวหนัง (8-18)
  {
    order: 8,
    category: "อาการทางผิวหนัง",
    name: "Other acantholytic disorders",
    icd10Label: "L11",
    matchPrefixes: ["L11"],
  },
  {
    order: 9,
    category: "อาการทางผิวหนัง",
    name: "Allergic contact dermatitis due to other agents",
    icd10Label: "L23.8",
    matchPrefixes: ["L238"],
  },
  {
    order: 10,
    category: "อาการทางผิวหนัง",
    name: "Allergic contact dermatitis, unspecified cause",
    icd10Label: "L23.9",
    matchPrefixes: ["L239"],
  },
  {
    order: 11,
    category: "อาการทางผิวหนัง",
    name: "Irritant contact dermatitis due to other agents",
    icd10Label: "L24.8",
    matchPrefixes: ["L248"],
  },
  {
    order: 12,
    category: "อาการทางผิวหนัง",
    name: "Irritant contact dermatitis, unspecified cause",
    icd10Label: "L24.9",
    matchPrefixes: ["L249"],
  },
  {
    order: 13,
    category: "อาการทางผิวหนัง",
    name: "Unspecified contact dermatitis due to other agents",
    icd10Label: "L25.8",
    matchPrefixes: ["L258"],
  },
  {
    order: 14,
    category: "อาการทางผิวหนัง",
    name: "Unspecified contact dermatitis, unspecified cause",
    icd10Label: "L25.9",
    matchPrefixes: ["L259"],
  },
  {
    order: 15,
    category: "อาการทางผิวหนัง",
    name: "Other dermatitis",
    icd10Label: "L30",
    matchPrefixes: ["L30"],
  },
  {
    order: 16,
    category: "อาการทางผิวหนัง",
    name: "Cicatricial alopecia [scarring hair loss]",
    icd10Label: "L66",
    matchPrefixes: ["L66"],
  },
  {
    order: 17,
    category: "อาการทางผิวหนัง",
    name: "Other disorders of pigmentation",
    icd10Label: "L81",
    matchPrefixes: ["L81"],
  },
  {
    order: 18,
    category: "อาการทางผิวหนัง",
    name: "Other epidermal thickening",
    icd10Label: "L85",
    matchPrefixes: ["L85"],
  },
  // อาการทางระบบทางเดินอาหาร (19-21)
  {
    order: 19,
    category: "อาการทางระบบทางเดินอาหาร",
    name: "Nausea and vomiting",
    icd10Label: "R11",
    matchPrefixes: ["R11"],
  },
  {
    order: 20,
    category: "อาการทางระบบทางเดินอาหาร",
    name: "Other noninfective gastroenteritis and colitis",
    icd10Label: "K52",
    matchPrefixes: ["K52"],
  },
  {
    order: 21,
    category: "อาการทางระบบทางเดินอาหาร",
    name: "Anorexia",
    icd10Label: "R63.0",
    matchPrefixes: ["R630"],
  },
  // รหัสที่กองโรคจากการประกอบอาชีพและสิ่งแวดล้อม แนะนำ (22-31)
  {
    order: 22,
    category: "รหัสที่กองโรคจากการประกอบอาชีพและสิ่งแวดล้อม แนะนำ",
    name: "โรคพิษจากสารหนู",
    icd10Label: "T57.0",
    matchPrefixes: ["T570"],
  },
  {
    order: 23,
    category: "รหัสที่กองโรคจากการประกอบอาชีพและสิ่งแวดล้อม แนะนำ",
    name: "Abnormal urine levels of substances chiefly nonmedicinal as to source",
    icd10Label: "R82.6",
    matchPrefixes: ["R826"],
  },
  {
    order: 24,
    category: "รหัสที่กองโรคจากการประกอบอาชีพและสิ่งแวดล้อม แนะนำ",
    name: "มะเร็งผิวหนัง",
    icd10Label: "D04",
    matchPrefixes: ["D04"],
  },
  {
    order: 25,
    category: "รหัสที่กองโรคจากการประกอบอาชีพและสิ่งแวดล้อม แนะนำ",
    name: "มะเร็งผิวหนัง",
    icd10Label: "C44",
    matchPrefixes: ["C44"],
  },
  {
    order: 26,
    category: "รหัสที่กองโรคจากการประกอบอาชีพและสิ่งแวดล้อม แนะนำ",
    name: "ไตวายเฉียบพลัน",
    icd10Label: "N17",
    matchPrefixes: ["N17"],
  },
  {
    order: 27,
    category: "รหัสที่กองโรคจากการประกอบอาชีพและสิ่งแวดล้อม แนะนำ",
    name: "ไตวายเรื้อรัง",
    icd10Label: "N18",
    matchPrefixes: ["N18"],
  },
  {
    order: 28,
    category: "รหัสที่กองโรคจากการประกอบอาชีพและสิ่งแวดล้อม แนะนำ",
    name: "มะเร็งกระเพาะปัสสาวะ",
    icd10Label: "C67.9",
    matchPrefixes: ["C679"],
  },
  {
    order: 29,
    category: "รหัสที่กองโรคจากการประกอบอาชีพและสิ่งแวดล้อม แนะนำ",
    name: "Other nail disorder",
    icd10Label: "L60.8",
    matchPrefixes: ["L608"],
  },
  {
    order: 30,
    category: "รหัสที่กองโรคจากการประกอบอาชีพและสิ่งแวดล้อม แนะนำ",
    name: "Expose to water pollution",
    icd10Label: "Z58.2",
    matchPrefixes: ["Z582"],
  },
  {
    order: 31,
    category: "รหัสที่กองโรคจากการประกอบอาชีพและสิ่งแวดล้อม แนะนำ",
    name: "Environmental-pollution-related condition",
    icd10Label: "Y97",
    matchPrefixes: ["Y97"],
  },
];

export function normalizeIcd10Code(diagcode: string): string {
  return diagcode.trim().toUpperCase().replace(/\./g, "");
}

export function matchPdfIcd10Item(diagcode: string): PdfIcd10Item | undefined {
  const normalized = normalizeIcd10Code(diagcode);
  return PDF_ICD10_ITEMS.find((item) =>
    item.matchPrefixes.some((prefix) => normalized.startsWith(prefix))
  );
}

/**
 * Returns the active list of allowed surveillance hospital codes.
 * Can be overridden at runtime via SURVEILLANCE_HOSPITAL_CODES (comma-separated).
 */
export function getSurveillanceHospitalCodes(): string[] {
  const envCodes = process.env.SURVEILLANCE_HOSPITAL_CODES;
  if (!envCodes) {
    return [...DEFAULT_SURVEILLANCE_HOSPITAL_CODES];
  }

  const parsed = envCodes
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : [...DEFAULT_SURVEILLANCE_HOSPITAL_CODES];
}
