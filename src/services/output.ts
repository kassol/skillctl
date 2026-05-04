import pc from "picocolors";

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printRows(
  headers: string[],
  rows: Array<Array<string | number | undefined>>,
): void {
  const stringRows = rows.map((row) => row.map((cell) => String(cell ?? "")));
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...stringRows.map((row) => row[index]?.length ?? 0)),
  );
  console.log(headers.map((header, index) => pc.bold(header.padEnd(widths[index]))).join("  "));
  for (const row of stringRows) {
    console.log(row.map((cell, index) => cell.padEnd(widths[index])).join("  "));
  }
}

export function printSection(title: string, items: string[]): void {
  console.log(pc.bold(title));
  if (items.length === 0) {
    console.log("  none");
    return;
  }
  for (const item of items) console.log(`  ${item}`);
}

export function statusColor(status: string): string {
  if (["SYNCED", "SYNCED_BY_DESIGN", "LINK_OK", "COPY_OK", "OK"].includes(status))
    return pc.green(status);
  if (["NOT_CHECKABLE", "GLOBAL_ONLY", "PROVIDER_ONLY"].includes(status)) return pc.yellow(status);
  return pc.red(status);
}

export function fail(message: string): never {
  console.error(pc.red(`Error: ${message}`));
  process.exit(1);
}
