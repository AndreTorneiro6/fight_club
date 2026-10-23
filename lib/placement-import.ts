import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { ensure } from "./rules";
import type { PlacementEvent, PlacementGame } from "./placement-types";
import { placementGameSchema, placementGameFingerprint } from "./placement";
export const placementHeaders = [
  "Jogo",
  "Equipa A",
  "Equipa B",
  "Sets A",
  "Sets B",
  "Pontos A",
  "Pontos B",
];
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-PT");
const value = (cell: ExcelJS.Cell) => {
  const v = cell.value;
  ensure(
    !v || typeof v !== "object" || !("formula" in v),
    "O ficheiro não pode conter fórmulas. Exporta os valores.",
  );
  if (v && typeof v === "object" && "richText" in v)
    return v.richText.map((t) => t.text).join("");
  return String(v ?? "").trim();
};
function checkZip(bytes: Buffer) {
  // Inspect declared expanded sizes before asking ExcelJS to decompress the workbook.
  const start = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  ensure(
    start >= 0 && start + 22 <= bytes.length,
    "Excel inválido. Usa .xlsx ou CSV.",
  );
  const count = bytes.readUInt16LE(start + 10),
    offset = bytes.readUInt32LE(start + 16);
  ensure(
    count > 0 && count < 2000 && offset < bytes.length,
    "Excel demasiado complexo.",
  );
  let at = offset,
    total = 0;
  for (let i = 0; i < count; i++) {
    ensure(
      at + 46 <= bytes.length && bytes.readUInt32LE(at) === 0x02014b50,
      "Excel inválido.",
    );
    const size = bytes.readUInt32LE(at + 24);
    total += size;
    ensure(
      size <= 16 * 1024 * 1024 && total <= 32 * 1024 * 1024,
      "Excel demasiado grande depois de descomprimido.",
    );
    at +=
      46 +
      bytes.readUInt16LE(at + 28) +
      bytes.readUInt16LE(at + 30) +
      bytes.readUInt16LE(at + 32);
  }
}
export async function placementTemplate(event: PlacementEvent) {
  const book = new ExcelJS.Workbook(),
    games = book.addWorksheet("Jogos");
  games.addRow(placementHeaders);
  games.columns.forEach((c) => (c.width = 28));
  const teams = book.addWorksheet("Equipas");
  teams.addRow(["ID da equipa", "Nome"]);
  event.teams.forEach((t) => teams.addRow([t.id, t.name]));
  teams.columns.forEach((c) => (c.width = 55));
  const instructions = book.addWorksheet("Instruções");
  instructions.addRow([
    "Usa IDs da folha Equipas ou os nomes exatos. Uma linha por jogo.",
  ]);
  instructions.addRow([
    "Jogo: identificador único do teu ficheiro; deixa vazio para identificar pelo resultado.",
  ]);
  instructions.addRow([
    "Sets: 2–0, 2–1, 0–2 ou 1–2. Pontos: total efetivamente marcado por cada equipa.",
  ]);
  instructions.addRow([
    "Não incluas fórmulas. A importação mostra uma pré-visualização antes de guardar.",
  ]);
  return book.xlsx.writeBuffer();
}
export async function parsePlacementImport(
  bytes: Buffer,
  name: string,
  event: PlacementEvent,
) {
  ensure(bytes.length <= 5 * 1024 * 1024, "Limite de 5 MB.");
  const book = new ExcelJS.Workbook();
  if (name.toLowerCase().endsWith(".xlsx")) {
    checkZip(bytes);
    await book.xlsx.load(bytes as never);
  } else {
    ensure(name.toLowerCase().endsWith(".csv"), "Usa Excel .xlsx ou CSV.");
    const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
    await book.csv.read(Readable.from([text]), {
      parserOptions: {
        delimiter: text.split("\n")[0].includes(";") ? ";" : ",",
      },
    });
  }
  const sheet = book.getWorksheet("Jogos") ?? book.worksheets[0];
  ensure(sheet && sheet.rowCount >= 2, "O ficheiro não tem jogos.");
  ensure(sheet.rowCount <= 501, "Importa até 500 jogos de cada vez.");
  const columns = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, index) => {
    const key = normalize(value(cell));
    ensure(!columns.has(key), "Existem colunas repetidas.");
    columns.set(key, index);
  });
  ensure(
    placementHeaders.every((h) => columns.has(normalize(h))),
    "Colunas esperadas: " + placementHeaders.join(", "),
  );
  const lookup = (raw: string) => {
    const key = normalize(raw);
    const matches = event.teams.filter(
      (t) =>
        t.id === raw ||
        normalize(t.name) === key ||
        t.members.some((m) => normalize(m.name) === key),
    );
    ensure(
      matches.length === 1,
      `Equipa desconhecida ou ambígua: ${raw}. Usa o ID da folha Equipas.`,
    );
    return matches[0].id;
  };
  const games: PlacementGame[] = [],
    errors: { row: number; message: string }[] = [];
  let duplicates = 0;
  const seen = new Map(
    event.games.map((g) => [g.id, placementGameFingerprint(g)]),
  );
  for (let row = 2; row <= sheet.rowCount; row++) {
    try {
      const cells = placementHeaders.map((h) =>
        value(sheet.getRow(row).getCell(columns.get(normalize(h))!)),
      );
      if (cells.every((c) => !c)) continue;
      const numeric = cells.slice(3).map((c) => {
        ensure(
          /^\d+$/.test(c),
          "Os sets e pontos devem ser inteiros, sem campos vazios.",
        );
        return Number(c);
      });
      const draft = {
        teamA: lookup(cells[1]),
        teamB: lookup(cells[2]),
        setsA: numeric[0],
        setsB: numeric[1],
        pointsA: numeric[2],
        pointsB: numeric[3],
      };
      const game = placementGameSchema.parse({
        ...draft,
        id: cells[0] || `auto-${placementGameFingerprint(draft)}`,
      });
      const fingerprint = placementGameFingerprint(game),
        old = seen.get(game.id);
      ensure(
        !old || old === fingerprint,
        `O jogo ${game.id} já tem outro resultado. Corrige o identificador ou remove o registo anterior.`,
      );
      if (old) {
        duplicates++;
        continue;
      }
      seen.set(game.id, fingerprint);
      games.push(game);
    } catch (error) {
      errors.push({
        row,
        message: error instanceof Error ? error.message : "Linha inválida.",
      });
    }
  }
  return { games, duplicates, errors };
}
