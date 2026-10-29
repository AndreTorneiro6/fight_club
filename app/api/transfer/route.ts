import { spreadsheetCell } from "@/lib/spreadsheet";
import { readLimitedBody } from "@/lib/request-body";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireActor } from "@/lib/auth";
import { mutate, view } from "@/lib/db";
import { failure, sameOrigin } from "@/lib/http";
import { ensure } from "@/lib/rules";

const headers = [
  "Nome",
  "Email",
  "Telefone",
  "Divisão",
  "Posição",
  "Parceiro",
  "Estado",
];
function value(cell: ExcelJS.Cell) {
  const v = cell.value;
  if (v && typeof v === "object" && "text" in v) return String(v.text);
  return String(v ?? "");
}
export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    ensure(actor.role === "admin", "Apenas administradores.", 403);
    const s = await view(actor),
      book = new ExcelJS.Workbook(),
      sheet = book.addWorksheet("Jogadores");
    sheet.addRow(headers);
    for (const p of s.players)
      sheet.addRow(
        [
          p.name,
          p.email,
          p.phone,
          s.divisions.find((d) => d._id === p.divisionId)?.name,
          p.position,
          p.partner,
          p.status,
        ].map(spreadsheetCell),
      );
    const csv = new URL(request.url).searchParams.get("format") === "csv";
    const buffer = csv
      ? await book.csv.writeBuffer()
      : await book.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": csv
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="jogadores.${csv ? "csv" : "xlsx"}"`,
      },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await requireActor();
    ensure(actor.role === "admin", "Apenas administradores.", 403);
    const bytesForm = await readLimitedBody(request, 6 * 1024 * 1024);
    const form = await new Response(bytesForm, {
        headers: { "Content-Type": request.headers.get("content-type") ?? "" },
      }).formData(),
      file = form.get("file");
    ensure(
      file instanceof File && file.size <= 5 * 1024 * 1024,
      "Envia um CSV ou Excel até 5 MB.",
    );
    const book = new ExcelJS.Workbook();
    if (file.name.toLowerCase().endsWith(".xlsx"))
      await book.xlsx.load(await file.arrayBuffer());
    else {
      const { Readable } = await import("node:stream");
      const text = await file.text();
      await book.csv.read(Readable.from([text]), {
        parserOptions: {
          delimiter: text.split("\n")[0].includes(";") ? ";" : ",",
        },
      });
    }
    const sheet = book.worksheets[0];
    ensure(sheet && sheet.rowCount >= 2, "O ficheiro está vazio.");
    ensure(sheet.rowCount <= 1001, "Importa até 1000 jogadores de cada vez.");
    const s = await view(actor);
    const first = sheet.getRow(1);
    ensure(
      headers.every(
        (h, i) =>
          value(first.getCell(i + 1))
            .replace(/^\uFEFF/, "")
            .trim()
            .toLowerCase() === h.toLowerCase(),
      ),
      "Colunas esperadas: " + headers.join(", "),
    );
    const counts = new Map(
      s.divisions.map((d) => [
        d._id,
        s.players.filter(
          (p) => p.divisionId === d._id && p.status !== "removed",
        ).length,
      ]),
    );
    const rows = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i),
        cells = Array.from({ length: 7 }, (_, i) =>
          value(row.getCell(i + 1)).trim(),
        );
      if (!cells[0]) continue;
      const division = s.divisions.find(
        (d) =>
          d.name.toLowerCase() === cells[3].toLowerCase() ||
          d.code === cells[3].toLowerCase(),
      );
      ensure(division, `Divisão inválida na linha ${i}.`);
      const existing = s.players.find(
        (p) => cells[1] && p.email === cells[1].toLowerCase(),
      );
      if (!existing)
        counts.set(division._id, (counts.get(division._id) ?? 0) + 1);
      const aliases: Record<string, string> = {
        ativo: "active",
        inativo: "inactive",
        suspenso: "suspended",
        removido: "removed",
      };
      rows.push({
        name: cells[0],
        email: cells[1].toLowerCase(),
        phone: cells[2],
        divisionId: division._id,
        position:
          Number(cells[4]) || existing?.position || counts.get(division._id),
        partner: cells[5],
        status:
          aliases[cells[6].toLowerCase()] || cells[6].toLowerCase() || "active",
        photo: existing?.photo ?? "",
      });
    }
    await mutate(actor, { type: "admin.players.import", rows });
    return NextResponse.json({ ok: true, count: rows.length });
  } catch (e) {
    return failure(e);
  }
}
