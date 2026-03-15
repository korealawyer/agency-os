/**
 * Utility functions for file export (CSV, PDF, Excel)
 */

export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const bom = "\uFEFF";
  const csvContent = bom + [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => {
        const escaped = String(cell).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPdf(filename: string, title: string, content: string[][]): void {
  // Generate a simple HTML-based printable document
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: 'Malgun Gothic', sans-serif; padding: 40px; font-size: 12px; }
  h1 { font-size: 18px; margin-bottom: 20px; border-bottom: 2px solid #1E40AF; padding-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #f0f4ff; padding: 8px 12px; text-align: left; border: 1px solid #ddd; font-weight: 600; }
  td { padding: 6px 12px; border: 1px solid #ddd; }
  tr:nth-child(even) { background: #f9fafb; }
  .footer { margin-top: 24px; font-size: 10px; color: #888; text-align: center; }
</style></head><body>
<h1>${title}</h1>
<p>생성일: ${new Date().toLocaleDateString("ko-KR")} | Agency OS</p>
<table>
  <thead><tr>${content[0].map((h) => `<th>${h}</th>`).join("")}</tr></thead>
  <tbody>${content.slice(1).map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
</table>
<div class="footer">Agency OS - Confidential</div>
</body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) {
    win.onload = () => {
      win.print();
    };
  }
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadExcel(filename: string, headers: string[], rows: string[][]): void {
  // Generate a simple XML-based spreadsheet compatible with Excel
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Sheet1">
    <Table>
      <Row>${headers.map((h) => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join("")}</Row>
      ${rows.map((row) => `<Row>${row.map((c) => `<Cell><Data ss:Type="String">${c}</Data></Cell>`).join("")}</Row>`).join("\n      ")}
    </Table>
  </Worksheet>
</Workbook>`;
  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
