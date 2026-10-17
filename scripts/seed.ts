import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { database, transaction } from "../lib/db";
import { defaultSettings, type Player, type User } from "../lib/types";

export async function seed(demo = false) {
  const { db } = await database();
  await transaction(async (s, db, session) => {
    if (s.settings.length) return;
    s.settings = [{ ...defaultSettings }];
    s.divisions = [
      { _id: "ouro", code: "ouro", name: "Ouro", tier: 1, capacity: 24 },
      { _id: "prata", code: "prata", name: "Prata", tier: 2, capacity: 24 },
      { _id: "bronze", code: "bronze", name: "Bronze", tier: 3, capacity: 40 },
    ];
    s.courts = [1, 2, 3, 4].map((n) => ({
      _id: `campo-${n}`,
      name: `Campo ${n}`,
      active: true,
    }));
    const now = new Date(),
      end = new Date(now);
    end.setMonth(end.getMonth() + s.settings[0].seasonMonths);
    s.seasons = [
      {
        _id: "season-1",
        name: "Season 1",
        start: now.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
        pauseStart: "",
        pauseEnd: "",
        status: "active",
      },
    ];
    if (!demo) return;
    const names = [
      "João Silva",
      "Pedro Costa",
      "Rui Santos",
      "Tiago Oliveira",
      "Luís Costa",
      "Bruno Martins",
      "Carlos Pereira",
      "Miguel Silva",
      "André Rodrigues",
      "Diogo Ferreira",
      "Ricardo Lopes",
      "Nuno Almeida",
      "Francisco Rocha",
      "Tomás Ribeiro",
      "Gonçalo Sousa",
      "Vasco Pinto",
      "Daniel Neves",
      "Hugo Martins",
      "Afonso Lima",
      "Manuel Gomes",
      "José Carvalho",
      "David Fernandes",
      "Paulo Azevedo",
      "António Moreira",
    ];
    const passwordHash = await hash("FightClub2026!", 12);
    for (let i = 0; i < names.length; i++) {
      const divisionId = s.divisions[Math.floor(i / 8)]._id,
        position = (i % 8) + 1;
      const player: Player = {
        _id: `player-${i + 1}`,
        name: names[i],
        email:
          i === 0
            ? "admin@fightclub.local"
            : i === 6
              ? "jogador@fightclub.local"
              : i === 4
                ? "adversario@fightclub.local"
                : `demo${i + 1}@fightclub.local`,
        phone: "",
        photo: "",
        number: 100 + i + 1,
        divisionId,
        position,
        previousPosition: position,
        status: "active",
        partner: "",
        wins: 0,
        losses: 0,
        challengesWon: 0,
        challengesLost: 0,
        createdAt: now.toISOString(),
      };
      if ([0, 4, 6].includes(i)) {
        const user: User = {
          _id: randomUUID(),
          name: player.name,
          email: player.email,
          passwordHash,
          role: i === 0 ? "admin" : "player",
          createdAt: now.toISOString(),
          verified: true,
        };
        player.userId = user._id;
        await db.collection<User>("users").insertOne(user, { session });
      }
      s.players.push(player);
    }
    s.champions = s.divisions.map((d) => ({
      _id: randomUUID(),
      divisionId: d._id,
      playerId: s.players.find(
        (p) => p.divisionId === d._id && p.position === 1,
      )!._id,
      since: now.toISOString(),
      defenses: 0,
      seasonId: "season-1",
    }));
    const challengeId = randomUUID(),
      later = new Date(Date.now() + 3 * 86400000);
    later.setUTCHours(19, 30, 0, 0);
    s.challenges.push({
      _id: challengeId,
      number: 1,
      seasonId: "season-1",
      divisionId: "prata",
      challengerId: "player-15",
      defenderId: "player-12",
      challengerPosition: 7,
      defenderPosition: 4,
      status: "scheduled",
      createdAt: now.toISOString(),
      respondBy: new Date(Date.now() + 86400000).toISOString(),
      scheduleBy: new Date(Date.now() + 5 * 86400000).toISOString(),
      playBy: new Date(Date.now() + 14 * 86400000).toISOString(),
      scheduledAt: later.toISOString(),
      courtId: "campo-2",
      durationMinutes: 90,
    });
    s.matches.push({
      _id: randomUUID(),
      challengeId,
      courtId: "campo-2",
      start: later.toISOString(),
      end: new Date(later.getTime() + 90 * 60000).toISOString(),
      seasonId: "season-1",
    });
    for (const p of s.players)
      for (const weekday of [1, 2, 4, 5])
        s.availability.push({
          _id: randomUUID(),
          playerId: p._id,
          weekday,
          start: "18:00",
          end: "23:00",
        });
    s.notifications.push({
      _id: randomUUID(),
      playerId: "player-7",
      title: "Bem-vindo à arena 🥊",
      body: "A tua próxima conquista começa com um desafio. Consulta o ranking.",
      read: false,
      createdAt: now.toISOString(),
    });
  });
  return db;
}
if (process.argv[1]?.endsWith("seed.ts")) {
  seed(process.argv.includes("--demo"))
    .then(() => {
      console.log("Liga inicializada.");
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
