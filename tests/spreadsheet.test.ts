import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { spreadsheetCell } from "../lib/spreadsheet";

test("spreadsheet exports neutralize formulas including leading whitespace and control characters", async () => {
  const payloads = [
    '=HYPERLINK("https://example.test","Click")',
    "+351912345678",
    "-1+2",
    "@SUM(1)",
    " \t=1+1",
    "\r=1",
    "\n=1",
  ];
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("test");
  sheet.addRow(payloads.map(spreadsheetCell));
  const csv = (await book.csv.writeBuffer()).toString();
  for (let i = 0; i < payloads.length; i++) {
    assert.equal(sheet.getCell(1, i + 1).type, ExcelJS.ValueType.String);
    assert.equal(sheet.getCell(1, i + 1).value, `'${payloads[i]}`);
  }
  assert.ok(csv.startsWith("\"'=HYPERLINK"));
  assert.equal(spreadsheetCell("André"), "André");
  assert.equal(spreadsheetCell(4), 4);
});
