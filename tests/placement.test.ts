import ExcelJS from "exceljs";
import test from "node:test";
import assert from "node:assert/strict";
import { execute } from "../lib/engine";
import { placementStandings, placementTeams } from "../lib/placement";
import { defaultPlacementRules } from "../lib/placement-types";
import { filterFeatureView } from "../lib/feature-view";
import {
  collections,
  defaultSettings,
  type State,
  type Player,
  type Actor,
} from "../lib/types";
import {
  parsePlacementImport,
  placementTemplate,
} from "../lib/placement-import";
import { simulateAdmin } from "../lib/admin-simulation";
const admin: Actor = { userId: "admin", playerId: "p0", role: "admin" };
const player: Actor = { ...admin, role: "player" };
function fixture(count = 4): State {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [structuredClone(defaultSettings)];
  s.seasons = [
    {
      _id: "season",
      name: "Época",
      start: "2026-10-01",
      end: "2026-12-31",
      pauseStart: "",
      pauseEnd: "",
      status: "active",
    },
  ];
  s.divisions = [
    { _id: "gold", code: "ouro", name: "Ouro", tier: 1, capacity: 24 },
  ];
  s.players = Array.from({ length: count }, (_, i) => ({
    _id: `p${i}`,
    name: `Equipa ${i}`,
    divisionId: "gold",
    position: i + 1,
    previousPosition: i + 1,
    status: "active",
    partner: "",
    photo: "",
    wins: 0,
    losses: 0,
    number: i + 1,
    email: "",
    phone: "",
    createdAt: "2026-10-01T00:00:00Z",
  })) as Player[];
  return s;
}
function event(s: State) {
  execute(s, admin, {
    type: "admin.placement.create",
    seasonId: "season",
    divisionId: "gold",
    name: "Colocação",
    date: "2026-10-23",
    rules: defaultPlacementRules,
  });
  return s.placementEvents!.at(-1)!;
}
const games = [
  {
    id: "g1",
    teamA: "p3",
    teamB: "p0",
    setsA: 2,
    setsB: 0,
    pointsA: 12,
    pointsB: 5,
  },
  {
    id: "g2",
    teamA: "p2",
    teamB: "p1",
    setsA: 2,
    setsB: 1,
    pointsA: 18,
    pointsB: 17,
  },
];
test("placement orders set difference before total points and initializes once with player history", () => {
  const s = fixture(),
    e = event(s);
  const before = structuredClone(s.players);
  execute(s, admin, {
    type: "admin.placement.games",
    eventId: e._id,
    expectedVersion: 1,
    games,
  });
  assert.deepEqual(s.players, before);
  const rows = placementStandings([e]);
  assert.deepEqual(
    rows.map((r) => r.id),
    ["p3", "p2", "p1", "p0"],
  );
  assert.equal(rows[0].setDifference, 2);
  execute(s, admin, {
    type: "admin.placement.apply",
    events: [{ id: e._id, version: 2 }],
    tieOrder: rows.map((r) => r.id),
    confirmTies: false,
  });
  assert.equal(s.players.find((p) => p._id === "p3")!.position, 1);
  assert.equal(s.history.length, 4);
  assert.equal(e.status, "APPLIED");
  assert.equal(s.challenges.length, 0);
  assert.equal(s.results.length, 0);
  assert.throws(
    () =>
      execute(s, admin, {
        type: "admin.placement.games",
        eventId: e._id,
        expectedVersion: e.version,
        games,
      }),
    /fechado/,
  );
});
test("placement imports are idempotent and reject conflicting IDs, invalid scores, mixed teams and stale edits", () => {
  const s = fixture(),
    e = event(s);
  execute(s, admin, {
    type: "admin.placement.games",
    eventId: e._id,
    expectedVersion: 1,
    games,
  });
  const result = execute(s, admin, {
    type: "admin.placement.games",
    eventId: e._id,
    expectedVersion: 2,
    games,
  });
  assert.deepEqual(result, { added: 0, skipped: 2 });
  for (const game of [
    { ...games[0], pointsA: 13 },
    { ...games[0], id: "bad", setsA: 2, setsB: 2 },
    { ...games[0], id: "bad", teamB: "other-division" },
  ])
    assert.throws(() =>
      execute(s, admin, {
        type: "admin.placement.games",
        eventId: e._id,
        expectedVersion: 3,
        games: [game],
      }),
    );
  assert.throws(
    () =>
      execute(s, admin, {
        type: "admin.placement.games",
        eventId: e._id,
        expectedVersion: 1,
        games,
      }),
    /administrador/,
  );
  assert.equal(e.games.length, 2);
});
test("complete ties require explicit admin order and cannot bypass higher set differences", () => {
  const s = fixture(),
    e = event(s);
  execute(s, admin, {
    type: "admin.placement.games",
    eventId: e._id,
    expectedVersion: 1,
    games: [games[0], { ...games[1], setsB: 0, pointsA: 12, pointsB: 5 }],
  });
  const order = placementStandings([e]).map((r) => r.id);
  const cmd = {
    type: "admin.placement.apply",
    events: [{ id: e._id, version: 2 }],
    tieOrder: order,
    confirmTies: false,
  };
  assert.throws(() => execute(s, admin, cmd), /empates/);
  assert.throws(
    () =>
      execute(s, admin, {
        ...cmd,
        confirmTies: true,
        tieOrder: [...order].reverse(),
      }),
    /respeitar/,
  );
  execute(s, admin, { ...cmd, confirmTies: true });
  assert.equal(e.status, "APPLIED");
});
test("placement does not overwrite an existing league or a changed roster and is admin only", () => {
  const s = fixture(),
    e = event(s);
  execute(s, admin, {
    type: "admin.placement.games",
    eventId: e._id,
    expectedVersion: 1,
    games,
  });
  const cmd = {
    type: "admin.placement.apply",
    events: [{ id: e._id, version: 2 }],
    tieOrder: placementStandings([e]).map((r) => r.id),
    confirmTies: true,
  };
  s.challenges.push({
    seasonId: "season",
    divisionId: "gold",
    status: "completed",
  } as never);
  assert.throws(() => execute(s, admin, cmd), /desafios/);
  s.challenges = [];
  s.players[0].partnerId = "p1";
  s.players[1].partnerId = "p0";
  assert.throws(() => execute(s, admin, cmd), /parceiros/);
  assert.throws(
    () =>
      execute(s, player, {
        type: "admin.placement.games",
        eventId: e._id,
        expectedVersion: 2,
        games,
      }),
    /administradores/,
  );
  filterFeatureView(s, player);
  assert.deepEqual(s.placementEvents, []);
});
test("Excel template includes team IDs; CSV preview resolves teams, reports errors and deduplicates before any writes", async () => {
  const s = fixture(),
    e = event(s),
    before = structuredClone(s);
  const template = await placementTemplate(e);
  assert.ok(template.byteLength > 0);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(template as never);
  workbook
    .getWorksheet("Jogos")!
    .addRow(["xlsx-1", "p3", "p0", "6-4", "6-1", ""]);
  const xlsx = Buffer.from(await workbook.xlsx.writeBuffer());
  assert.equal(
    (await parsePlacementImport(xlsx, "jogos.xlsx", e)).games[0].id,
    "xlsx-1",
  );
  const valid = Buffer.from(
    "Jogo;Equipa A;Equipa B;Sets A;Sets B;Pontos A;Pontos B\ng1;p3;p0;2;0;12;5\ng1;p3;p0;2;0;12;5\nbad;unknown;p2;2;1;18;17",
  );
  const preview = await parsePlacementImport(valid, "jogos.csv", e);
  assert.equal(preview.games.length, 1);
  assert.equal(preview.duplicates, 1);
  assert.equal(preview.errors.length, 1);
  assert.deepEqual(s, before);
  const noId = Buffer.from(
    "Jogo,Equipa A,Equipa B,Sets A,Sets B,Pontos A,Pontos B\n,p3,p0,2,0,12,5\n,p0,p3,0,2,5,12",
  );
  assert.equal(
    (await parsePlacementImport(noId, "jogos.csv", e)).duplicates,
    1,
  );
  await assert.rejects(
    parsePlacementImport(Buffer.from("fake zip"), "jogos.xlsx", e),
  );
});
test("multiple placement events accumulate and configurable match points are independent of total points", () => {
  const s = fixture(),
    a = event(s),
    b = event(s);
  a.games = [games[0]];
  b.games = [games[1]];
  assert.equal(placementStandings([a, b])[0].id, "p3");
  a.rules = {
    pointsMode: "CLASSIFICATION_POINTS",
    winPoints: 5,
    lossPoints: 1,
  };
  const rows = placementStandings([a]);
  assert.equal(rows.find((r) => r.id === "p3")!.rankingPoints, 5);
  assert.equal(rows.find((r) => r.id === "p0")!.rankingPoints, 1);
});
test("admin simulator is deterministic, follows direct swaps and never mutates source state", () => {
  const s = fixture(12),
    before = structuredClone(s);
  const input = {
    mode: "matchmaking",
    divisionId: "gold",
    rounds: 10,
    distance: 2,
    outcome: "DEFENDERS_WIN",
    unavailable: [],
  };
  const report = simulateAdmin(s, admin, input);
  assert.equal(report.mode, "matchmaking");
  if (report.mode !== "matchmaking") return;
  assert.equal(report.rounds.length, 10);
  assert.equal(
    report.rounds.reduce((n, r) => n + r.errors.length, 0),
    0,
  );
  assert.deepEqual(s, before);
  assert.deepEqual(simulateAdmin(s, admin, input), report);
  const attack = simulateAdmin(s, admin, {
    ...input,
    rounds: 1,
    outcome: "ATTACKERS_WIN",
  });
  if (attack.mode === "matchmaking")
    for (const p of attack.rounds[0].pairs) {
      const a: { rank: number } = attack.rounds[0].before.find(
        (t) => t.id === p.attackerId,
      )!;
      assert.equal(
        attack.rounds[0].after.find((t) => t.id === p.defenderId)!.rank,
        a.rank,
      );
    }
  assert.deepEqual(s, before);
  assert.throws(() => simulateAdmin(s, player, input), /administradores/);
  const challenge = simulateAdmin(s, admin, {
    mode: "challenge",
    attackerId: "p0",
    defenderId: "p3",
  });
  assert.equal(challenge.mode, "challenge");
  if (challenge.mode === "challenge")
    assert.equal(challenge.steps[0].ok, false);
  assert.deepEqual(s, before);
});

test("placement uses points only after equal set differences and keeps partners together", () => {
  const s = fixture(8);
  for (let i = 0; i < 8; i += 2) {
    s.players[i].partnerId = s.players[i + 1]._id;
    s.players[i + 1].partnerId = s.players[i]._id;
  }
  const e = event(s),
    teams = placementTeams(s, "gold");
  execute(s, admin, {
    type: "admin.placement.games",
    eventId: e._id,
    expectedVersion: 1,
    games: [
      {
        id: "a",
        teamA: teams[3].id,
        teamB: teams[0].id,
        setsA: 2,
        setsB: 0,
        pointsA: 12,
        pointsB: 3,
      },
      {
        id: "b",
        teamA: teams[2].id,
        teamB: teams[1].id,
        setsA: 2,
        setsB: 0,
        pointsA: 13,
        pointsB: 4,
      },
    ],
  });
  const rows = placementStandings([e]);
  assert.equal(rows[0].id, teams[2].id);
  execute(s, admin, {
    type: "admin.placement.apply",
    events: [{ id: e._id, version: 2 }],
    tieOrder: rows.map((r) => r.id),
    confirmTies: false,
  });
  const ranking = placementTeams(s, "gold");
  assert.equal(ranking[0].id, teams[2].id);
  assert.deepEqual(
    ranking[0].members.map((m) => m.position),
    [1, 2],
  );
});
test("specific valid challenge submission and acceptance run only in a copied state", () => {
  const s = fixture(),
    before = structuredClone(s);
  s.settings[0].weeklyCompetition = false;
  const snapshot = structuredClone(s);
  const report = simulateAdmin(
    s,
    admin,
    { mode: "challenge", attackerId: "p3", defenderId: "p2" },
    Date.parse("2026-10-23T10:00:00Z"),
  );
  assert.equal(report.mode, "challenge");
  if (report.mode === "challenge") {
    assert.equal(report.steps.length, 2);
    assert.ok(
      report.steps.every((step) => step.ok),
      JSON.stringify(report.steps),
    );
  }
  assert.deepEqual(s, snapshot);
  assert.equal(s.challenges.length, before.challenges.length);
});

async function fullWorkbook() {
  const book = new ExcelJS.Workbook();
  book.addWorksheet("Export Summary").addRow(["Exportado do Numbers"]);
  const games = book.addWorksheet("Evento Colocação");
  games.addRow(["Evento de colocação"]);
  games.addRow([]);
  games.addRow([]);
  games.addRow([
    "ID Jogo",
    "Divisão",
    "Ronda",
    "ID Dupla A",
    "Dupla A",
    "ID Dupla B",
    "Dupla B",
    "Data",
    "Hora",
    "Set 1",
    "Set 2",
    "Set 3",
    "Sets A",
    "Sets B",
    "Jogos A",
    "Jogos B",
  ]);
  games.addRow([
    "O-1",
    "Ouro",
    1,
    "O04",
    "Equipa 3",
    "O01",
    "Equipa 0",
    "",
    "",
    "6-4",
    "3-6",
    "10-8",
    { formula: "IGNORED()" },
    null,
    null,
    null,
  ]);
  games.addRow([
    "P-1",
    "Prata",
    1,
    "P01",
    "Outra dupla",
    "P02",
    "Mais uma",
    "",
    "",
    "6-2",
    "6-1",
  ]);
  games.addRow(["O-2", "Ouro", 2, "O01", "Equipa 0", "O04", "Equipa 3"]);
  const teams = book.addWorksheet("Duplas");
  teams.addRow(["DUPLAS"]);
  teams.addRow([]);
  teams.addRow(["ID", "Divisão", "Dupla"]);
  teams.addRow(["O04", "Ouro", "Equipa 3"]);
  teams.addRow(["O01", "Ouro", "Equipa 0"]);
  book.addWorksheet("Ranking").addRow([{ formula: "IGNORED_TOO()" }]);
  return { book, games };
}
test("full Numbers workbook finds placement header below title, resolves external IDs and keeps each set", async () => {
  const s = fixture(),
    e = event(s),
    { book } = await fullWorkbook(),
    before = structuredClone(s);
  const parsed = await parsePlacementImport(
    Buffer.from(await book.xlsx.writeBuffer()),
    "full.xlsx",
    e,
    { divisionNames: ["Ouro"] },
  );
  assert.equal(parsed.allSheets.length, 4);
  assert.equal(parsed.sheetName, "Evento Colocação");
  assert.equal(parsed.games.length, 1);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.skippedDivision, 1);
  assert.equal(parsed.skippedUnplayed, 1);
  assert.deepEqual(parsed.games[0].setScores, [
    { a: 6, b: 4 },
    { a: 3, b: 6 },
    { a: 10, b: 8 },
  ]);
  assert.equal(parsed.games[0].pointsA, 19);
  assert.equal(parsed.games[0].pointsB, 18);
  assert.deepEqual(s, before);
});
test("Excel dates require explicit interpretation and literal totals must match recovered set scores", async () => {
  const s = fixture(),
    e = event(s),
    { book, games } = await fullWorkbook();
  games.getRow(5).getCell(10).value = new Date("2026-04-06T00:00:00Z");
  let bytes = Buffer.from(await book.xlsx.writeBuffer());
  let parsed = await parsePlacementImport(bytes, "full.xlsx", e, {
    divisionNames: ["ouro"],
  });
  assert.equal(parsed.games.length, 0);
  assert.match(parsed.errors[0].message, /convertido numa data/);
  parsed = await parsePlacementImport(bytes, "full.xlsx", e, {
    divisionNames: ["ouro"],
    dateOrder: "DAY_MONTH",
  });
  assert.equal(parsed.games.length, 1);
  assert.equal(parsed.convertedDates, 1);
  assert.deepEqual(parsed.games[0].setScores?.[0], { a: 6, b: 4 });
  games.getRow(5).getCell(15).value = 100;
  bytes = Buffer.from(await book.xlsx.writeBuffer());
  parsed = await parsePlacementImport(bytes, "full.xlsx", e, {
    divisionNames: ["ouro"],
    dateOrder: "DAY_MONTH",
  });
  assert.equal(parsed.games.length, 0);
  assert.match(parsed.errors[0].message, /não correspondem/);
});
test("multiple result sheets require selection and raw score formulas cannot be evaluated or imported", async () => {
  const s = fixture(),
    e = event(s),
    { book, games } = await fullWorkbook();
  const another = book.addWorksheet("Outra ronda");
  another.addRow(["Jogo", "Equipa A", "Equipa B", "Set 1", "Set 2", "Set 3"]);
  another.addRow(["g2", "p3", "p0", "6-1", "6-2"]);
  let bytes = Buffer.from(await book.xlsx.writeBuffer());
  let parsed = await parsePlacementImport(bytes, "full.xlsx", e, {
    divisionNames: ["Ouro"],
  });
  assert.equal(parsed.needsSheetSelection, true);
  assert.equal(parsed.games.length, 0);
  parsed = await parsePlacementImport(bytes, "full.xlsx", e, {
    sheetName: "Outra ronda",
    divisionNames: ["Ouro"],
  });
  assert.equal(parsed.games[0].id, "g2");
  games.getRow(5).getCell(10).value = { formula: "6+4", result: "6-4" };
  bytes = Buffer.from(await book.xlsx.writeBuffer());
  parsed = await parsePlacementImport(bytes, "full.xlsx", e, {
    sheetName: "Evento Colocação",
    divisionNames: ["Ouro"],
  });
  assert.equal(parsed.games.length, 0);
  assert.match(parsed.errors[0].message, /fórmulas/);
});
test("editing a placement result is versioned, audited and cannot alter applied events or another division", () => {
  const s = fixture(),
    e = event(s);
  execute(s, admin, {
    type: "admin.placement.games",
    eventId: e._id,
    expectedVersion: e.version,
    games: [games[0]],
  });
  const old = structuredClone(e.games[0]),
    corrected = {
      ...old,
      setsA: 0,
      setsB: 2,
      pointsA: 7,
      pointsB: 12,
      setScores: [
        { a: 4, b: 6 },
        { a: 3, b: 6 },
      ],
    };
  const cmd = {
    type: "admin.placement.game.update",
    eventId: e._id,
    expectedVersion: e.version,
    game: corrected,
    reason: "Resultado confirmado pelas duplas",
  };
  assert.throws(() => execute(s, player, cmd), /administradores/);
  assert.throws(
    () =>
      execute(s, admin, {
        ...cmd,
        game: { ...corrected, teamA: "another-league" },
      }),
    /evento\/divisão/,
  );
  execute(s, admin, cmd);
  assert.deepEqual(e.games[0], corrected);
  const audit = JSON.parse(s.audit.at(-1)!.details);
  assert.deepEqual(audit.before.games[0], old);
  assert.equal(audit.reason, cmd.reason);
  assert.throws(() => execute(s, admin, cmd), /Outro administrador/);
  e.status = "APPLIED";
  assert.throws(
    () => execute(s, admin, { ...cmd, expectedVersion: e.version }),
    /fechado/,
  );
  assert.equal(s.results.length, 0);
});
test("per-set placement totals and contradictory same-ID set corrections cannot bypass backend validation", () => {
  const s = fixture(),
    e = event(s),
    g = {
      ...games[0],
      setScores: [
        { a: 6, b: 4 },
        { a: 6, b: 2 },
      ],
    };
  g.setsA = 2;
  g.setsB = 0;
  g.pointsA = 12;
  g.pointsB = 6;
  execute(s, admin, {
    type: "admin.placement.games",
    eventId: e._id,
    expectedVersion: e.version,
    games: [g],
  });
  assert.throws(
    () =>
      execute(s, admin, {
        type: "admin.placement.game.update",
        eventId: e._id,
        expectedVersion: e.version,
        game: { ...g, pointsA: 20 },
        reason: "Teste de totais",
      }),
    /totais/,
  );
  assert.throws(
    () =>
      execute(s, admin, {
        type: "admin.placement.games",
        eventId: e._id,
        expectedVersion: e.version,
        games: [
          {
            ...g,
            setScores: [
              { a: 6, b: 3 },
              { a: 6, b: 3 },
            ],
          },
        ],
      }),
    /outro resultado/,
  );
  assert.deepEqual(e.games[0].setScores, g.setScores);
});
