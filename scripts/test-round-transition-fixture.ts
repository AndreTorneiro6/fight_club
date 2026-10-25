/** Isolated Playwright fixture, invoked only by the --test demo runner. */
import { transaction } from "../lib/db";
import { clubWeek } from "../lib/calendar";
import { rankingEntries } from "../lib/ranking-groups";
export async function seedRoundTransitionTest() {
  await transaction((s) => {
    const now = Date.now(),
      week = clubWeek(now).start,
      season = s.seasons.find((e) => e.status === "active")!;
    season.firstCompetitionWeek = week;
    s.settings[0] = {
      ...s.settings[0],
      weeklyCompetition: true,
      weeklyMandatoryChallenges: true,
      weeklyDynamicRoles: false,
      autoWeeklyRanking: false,
      autoWeeklyRoles: false,
    };
    // A real paired player account can check its own calendar and published roles.
    const a = s.players.find((p) => p._id === "player-7")!,
      b = s.players.find((p) => p._id === "player-8")!;
    a.partnerId = b._id;
    a.partner = b.name;
    b.partnerId = a._id;
    b.partner = a.name;
    const teams = rankingEntries(s.players, a.divisionId),
      attacker = teams.find((t) => t.members.some((m) => m._id === a._id))!,
      defender = teams.at(-2)!;
    const save = (t: typeof attacker) =>
      t.members.map((m) => ({ playerId: m._id, name: m.name }));
    const start = new Date(now - 3 * 3600000).toISOString(),
      end = new Date(now - 90 * 60000).toISOString();
    s.challenges = [
      {
        _id: "test-transition-game",
        number: 987,
        seasonId: season._id,
        divisionId: a.divisionId,
        weekStart: week,
        challengerId: a._id,
        defenderId: defender.members[0]._id,
        challengerTeam: save(attacker),
        defenderTeam: save(defender),
        challengerPosition: teams.indexOf(attacker) + 1,
        defenderPosition: teams.indexOf(defender) + 1,
        status: "scheduled",
        mandatoryAssignment: true,
        createdAt: new Date(now - 86400000).toISOString(),
        respondBy: new Date(now + 86400000).toISOString(),
        scheduleBy: new Date(now + 86400000).toISOString(),
        playBy: clubWeek(now).endsAt,
        scheduledAt: start,
        courtId: "campo-1",
        durationMinutes: 90,
      },
    ];
    s.matches = [
      {
        _id: "test-transition-booking",
        challengeId: "test-transition-game",
        start,
        end,
        courtId: "campo-1",
        seasonId: season._id,
      },
    ];
    s.results = [];
    s.slots = [];
    s.messages = [];
    s.weeklyRounds = [
      {
        _id: week,
        weekStart: week,
        seasonId: season._id,
        version: 1,
        weekType: "OPEN_ATTACK",
        publishedAt: new Date(now - 86400000).toISOString(),
        assignments: s.divisions.flatMap((d) =>
          rankingEntries(s.players, d._id).flatMap((t, i) =>
            t.members.map((m) => ({
              playerId: m._id,
              role: i === 0 ? ("defense" as const) : ("attack" as const),
            })),
          ),
        ),
      },
    ];
  });
}
