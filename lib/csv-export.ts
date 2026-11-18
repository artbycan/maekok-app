import Papa from 'papaparse';

const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

function sanitizeCsvCell(value: string | number): string | number {
  if (typeof value !== 'string') return value;
  return FORMULA_PREFIX_RE.test(value) ? `'${value}` : value;
}

/**
 * Serializes rows to a UTF-8 BOM CSV file (with formula-injection neutralization)
 * and triggers a browser download.
 */
export function downloadCsv(
  rows: Record<string, string | number>[],
  columns: string[],
  filename: string
): void {
  const safeRows = rows.map((row) => {
    const safeRow: Record<string, string | number> = {};
    for (const col of columns) {
      safeRow[col] = col in row ? sanitizeCsvCell(row[col]) : '';
    }
    return safeRow;
  });

  const csv = Papa.unparse(safeRows, { header: true, columns });
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
