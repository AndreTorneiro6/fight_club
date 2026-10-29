/** CSV quoting alone does not stop spreadsheet applications evaluating a cell. */
export function spreadsheetCell(value: string | number | null | undefined) {
  if (typeof value !== "string") return value ?? "";
  return /^[\s\u0000-\u001f]*[=+@-]/u.test(value) || /^[\t\r\n]/.test(value)
    ? `'${value}`
    : value;
}
