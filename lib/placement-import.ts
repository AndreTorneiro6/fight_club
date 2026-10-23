import {
  findPlacementTable,
  workbookTeamLookup,
  readWorkbookGame,
  type PlacementImportOptions,
} from "./placement-workbook";
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
  games.addRow(["Jogo", "Equipa A", "Equipa B", "Set 1", "Set 2", "Set 3"]);
  for (const index of [4, 5, 6]) games.getColumn(index).numFmt = "@";
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
    "Uma pontuação por set: 6-4, 3-6, 10-8. Mantém a ordem Equipa A / Equipa B. Os totais são calculados a partir dos sets.",
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
  options: PlacementImportOptions = {},
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
  const tables = book.worksheets
    .map(findPlacementTable)
    .filter((t) => t !== undefined);
  ensure(
    tables.length,
    "Não foi encontrada uma folha de resultados. Usa o modelo Jogos ou uma folha com Dupla A/B e Set 1/Set 2.",
  );
  const sheetNames = tables.map((t) => t.sheet.name);
  ensure(
    !options.sheetName || sheetNames.includes(options.sheetName),
    "A folha selecionada não contém uma tabela de resultados reconhecida.",
  );
  const table = options.sheetName
    ? tables.find((t) => t.sheet.name === options.sheetName)!
    : tables.length === 1
      ? tables[0]
      : undefined;
  const metadata = {
    sheets: sheetNames,
    allSheets: book.worksheets.map((s) => s.name),
    sheetName: table?.sheet.name ?? "",
    needsSheetSelection: !table,
  };
  if (!table)
    return {
      ...metadata,
      games: [] as PlacementGame[],
      duplicates: 0,
      errors: [] as { row: number; message: string }[],
      skippedDivision: 0,
      skippedUnplayed: 0,
      convertedDates: 0,
    };
  ensure(
    table.sheet.rowCount - table.row <= 500,
    "Importa até 500 jogos de cada vez.",
  );
  const lookup = workbookTeamLookup(book, event);
  const games: PlacementGame[] = [],
    errors: { row: number; message: string }[] = [];
  let duplicates = 0;
  const seen = new Map(
    event.games.map((g) => [g.id, placementGameFingerprint(g)]),
  );
  let skippedDivision = 0,
    skippedUnplayed = 0,
    convertedDates = 0;
  for (let row = table.row + 1; row <= table.sheet.rowCount; row++) {
    try {
      const result = readWorkbookGame(table, row, lookup, options);
      if (result.skipped) {
        if (result.skipped === "division") skippedDivision++;
        if (result.skipped === "unplayed") skippedUnplayed++;
        continue;
      }
      const draft = result.draft;
      const game = placementGameSchema.parse({
        ...draft,
        id: draft.id || `auto-${placementGameFingerprint(draft)}`,
      });
      convertedDates += result.dateCount;
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
  return {
    ...metadata,
    games,
    duplicates,
    errors,
    skippedDivision,
    skippedUnplayed,
    convertedDates,
  };
}
