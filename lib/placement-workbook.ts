import type ExcelJS from "exceljs";
import { ensure } from "./rules";
import { validateSetScores } from "./set-scores";
import type { PlacementEvent, PlacementGame } from "./placement-types";
export const normalizeSheetText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-PT");
export function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  ensure(
    !v || typeof v !== "object" || !("formula" in v || "sharedFormula" in v),
    "O ficheiro não pode conter fórmulas nos dados importados. Exporta os valores.",
  );
  if (v && typeof v === "object" && "richText" in v)
    return v.richText
      .map((t) => t.text)
      .join("")
      .trim();
  ensure(
    !(v instanceof Date),
    "A célula foi convertida numa data pelo Excel. Revê o formato.",
  );
  return String(v ?? "").trim();
}
const headerText = (cell: ExcelJS.Cell) =>
  typeof cell.value === "string" ? normalizeSheetText(cell.value) : "";
export type PlacementTable = {
  sheet: ExcelJS.Worksheet;
  row: number;
  columns: Map<string, number>;
  perSet: boolean;
};
export function findPlacementTable(
  sheet: ExcelJS.Worksheet,
): PlacementTable | undefined {
  for (let row = 1; row <= Math.min(25, sheet.rowCount); row++) {
    const columns = new Map<string, number>();
    let repeated = false;
    sheet.getRow(row).eachCell((c, i) => {
      const key = headerText(c);
      if (!key) return;
      if (columns.has(key)) repeated = true;
      columns.set(key, i);
    });
    const has = (...keys: string[]) => keys.some((k) => columns.has(k));
    const teams =
      has("equipa a", "dupla a", "id dupla a") &&
      has("equipa b", "dupla b", "id dupla b");
    const perSet = teams && has("set 1") && has("set 2");
    if (
      teams &&
      (perSet ||
        (has("sets a") &&
          has("sets b") &&
          has("pontos a", "jogos a") &&
          has("pontos b", "jogos b")))
    ) {
      ensure(!repeated, "Existem colunas repetidas.");
      return { sheet, row, columns, perSet };
    }
  }
}
const teamKey = (raw: string) =>
  normalizeSheetText(raw)
    .split(/\s*(?:\/|\+|&)\s*/)
    .sort()
    .join("|");
export function workbookTeamLookup(
  book: ExcelJS.Workbook,
  event: PlacementEvent,
) {
  const aliases = new Map<string, string[]>();
  for (const sheet of book.worksheets) {
    for (let row = 1; row <= Math.min(25, sheet.rowCount); row++) {
      const columns = new Map<string, number>();
      sheet.getRow(row).eachCell((c, i) => {
        const key = headerText(c);
        if (key) columns.set(key, i);
      });
      const idColumn = columns.get("id") ?? columns.get("id da equipa"),
        nameColumn = columns.get("dupla") ?? columns.get("nome");
      if (!idColumn || !nameColumn) continue;
      ensure(
        sheet.rowCount - row <= 500,
        "A folha de equipas excede 500 linhas.",
      );
      for (let n = row + 1; n <= sheet.rowCount; n++) {
        const id = cellText(sheet.getRow(n).getCell(idColumn)),
          name = cellText(sheet.getRow(n).getCell(nameColumn));
        if (id && name) aliases.set(id, [...(aliases.get(id) ?? []), name]);
      }
      break;
    }
  }
  return (raw: string, display?: string) => {
    const resolve = (name: string) =>
      event.teams.filter(
        (t) =>
          t.id === name ||
          teamKey(t.name) === teamKey(name) ||
          t.members
            .map((m) => normalizeSheetText(m.name))
            .sort()
            .join("|") === teamKey(name) ||
          t.members.some(
            (m) => normalizeSheetText(m.name) === normalizeSheetText(name),
          ),
      );
    const exact = event.teams.filter((t) => t.id === raw);
    const aliasNames = aliases.get(raw) ?? [];
    const candidates = exact.length
      ? exact
      : aliasNames.length
        ? aliasNames.flatMap(resolve)
        : resolve(raw);
    const unique = [...new Map(candidates.map((t) => [t.id, t])).values()];
    const named = display ? resolve(display) : [];
    ensure(
      unique.length <= 1 && named.length <= 1,
      `Equipa ambígua: ${raw}. Revê os nomes e IDs.`,
    );
    ensure(
      !unique.length || !named.length || unique[0].id === named[0].id,
      `O ID e o nome da dupla não correspondem: ${raw}.`,
    );
    const team = unique[0] ?? named[0];
    ensure(
      team,
      `Equipa desconhecida: ${display || raw}. Confirma os parceiros e os nomes no evento.`,
    );
    return team.id;
  };
}
export type PlacementImportOptions = {
  sheetName?: string;
  dateOrder?: "DAY_MONTH" | "MONTH_DAY";
  divisionNames?: string[];
};
export function readWorkbookGame(
  table: PlacementTable,
  row: number,
  lookup: ReturnType<typeof workbookTeamLookup>,
  options: PlacementImportOptions,
) {
  const { sheet, columns, perSet } = table,
    r = sheet.getRow(row);
  const cell = (...names: string[]) => {
    const index = names.map((n) => columns.get(n)).find(Boolean);
    ensure(index, "Coluna de resultado em falta.");
    return r.getCell(index);
  };
  const text = (...names: string[]) =>
    names.some((n) => columns.has(n)) ? cellText(cell(...names)) : "";
  const division = text("divisao");
  if (
    division &&
    options.divisionNames?.length &&
    !options.divisionNames.some(
      (n) => normalizeSheetText(n) === normalizeSheetText(division),
    )
  )
    return { skipped: "division" as const };
  const id = text("jogo", "id jogo");
  const rawSets = perSet
    ? ["set 1", "set 2", "set 3"].map((k) =>
        columns.has(k) ? cell(k).value : null,
      )
    : [];
  if (perSet && rawSets.every((v) => v === null || v === undefined || v === ""))
    return { skipped: "unplayed" as const };
  if (
    !perSet &&
    [
      "equipa a",
      "dupla a",
      "id dupla a",
      "equipa b",
      "dupla b",
      "id dupla b",
      "sets a",
      "sets b",
      "pontos a",
      "pontos b",
      "jogos a",
      "jogos b",
    ].every((k) => !columns.has(k) || !cell(k).value)
  )
    return { skipped: "empty" as const };
  const teamA = lookup(
    text("id dupla a", "equipa a", "dupla a"),
    columns.has("id dupla a") ? text("dupla a", "equipa a") : undefined,
  );
  const teamB = lookup(
    text("id dupla b", "equipa b", "dupla b"),
    columns.has("id dupla b") ? text("dupla b", "equipa b") : undefined,
  );
  let dateCount = 0;
  if (perSet) {
    const scores = rawSets.map((v, i) => {
      if (v === null || v === undefined || v === "") return undefined;
      if (v instanceof Date) {
        ensure(
          options.dateOrder,
          `O Set ${i + 1} foi convertido numa data pelo Excel. Escolhe a interpretação das datas dos sets e volta a pré-visualizar.`,
        );
        const a =
            options.dateOrder === "DAY_MONTH"
              ? v.getUTCDate()
              : v.getUTCMonth() + 1,
          b =
            options.dateOrder === "DAY_MONTH"
              ? v.getUTCMonth() + 1
              : v.getUTCDate();
        dateCount++;
        return { a, b };
      }
      const raw = cellText(cell(`set ${i + 1}`)),
        match = /^(\d{1,2})\s*[-–:]\s*(\d{1,2})$/.exec(raw);
      ensure(match, `Set ${i + 1} inválido: usa uma pontuação como 6-4.`);
      return { a: Number(match[1]), b: Number(match[2]) };
    });
    ensure(
      scores[0] && scores[1] && !(!scores[1] && scores[2]),
      "Preenche os dois primeiros sets antes do terceiro.",
    );
    const setScores = scores.filter((s) => s !== undefined),
      setsA = setScores.filter((s) => s.a > s.b).length,
      setsB = setScores.filter((s) => s.b > s.a).length;
    validateSetScores(
      setScores.map((s) => ({ attacker: s.a, defender: s.b })),
      teamA,
      teamB,
      setsA > setsB ? teamA : teamB,
    );
    const pointsA = setScores.reduce((n, s) => n + s.a, 0),
      pointsB = setScores.reduce((n, s) => n + s.b, 0);
    // Never evaluate formulas. Literal totals, if present, must agree with the individual sets.
    for (const [key, total] of [
      ["sets a", setsA],
      ["sets b", setsB],
      ["jogos a", pointsA],
      ["jogos b", pointsB],
      ["pontos a", pointsA],
      ["pontos b", pointsB],
    ] as const) {
      if (!columns.has(key)) continue;
      const v = cell(key).value;
      if (typeof v === "number")
        ensure(
          v === total,
          `Os ${key} (${v}) não correspondem aos sets (${total}). Revê a pontuação e a interpretação das datas.`,
        );
    }
    return {
      draft: {
        id,
        teamA,
        teamB,
        setsA,
        setsB,
        pointsA,
        pointsB,
        setScores,
      } satisfies PlacementGame,
      dateCount,
    };
  }
  const integer = (...keys: string[]) => {
    const raw = text(...keys);
    ensure(
      /^\d+$/.test(raw),
      "Os sets e pontos devem ser inteiros, sem campos vazios.",
    );
    return Number(raw);
  };
  return {
    draft: {
      id,
      teamA,
      teamB,
      setsA: integer("sets a"),
      setsB: integer("sets b"),
      pointsA: integer("pontos a", "jogos a"),
      pointsB: integer("pontos b", "jogos b"),
    } satisfies PlacementGame,
    dateCount,
  };
}
