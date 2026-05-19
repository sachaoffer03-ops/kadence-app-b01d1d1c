export function toCsv<T extends Record<string, any>>(
  rows: T[],
  columns: { key: keyof T | string; label: string; format?: (v: any, row: T) => any }[],
): string {
  const esc = (v: any) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map((c) => esc(c.label)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => {
      const raw = (row as any)[c.key];
      const v = c.format ? c.format(raw, row) : raw;
      return esc(v);
    }).join(","),
  ).join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
