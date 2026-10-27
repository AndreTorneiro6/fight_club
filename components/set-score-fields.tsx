"use client";
import type { Challenge } from "@/lib/types";
import { parseLegacySetScores, type SetScore } from "@/lib/set-scores";
export function setScoresFromForm(form: HTMLFormElement): SetScore[] {
  const data = new FormData(form);
  return [0, 1, 2]
    .filter(
      (i) =>
        String(data.get(`set-${i}-attacker`) ?? "") !== "" ||
        String(data.get(`set-${i}-defender`) ?? "") !== "",
    )
    .map((i) => ({
      attacker:
        String(data.get(`set-${i}-attacker`) ?? "") === ""
          ? NaN
          : Number(data.get(`set-${i}-attacker`)),
      defender:
        String(data.get(`set-${i}-defender`) ?? "") === ""
          ? NaN
          : Number(data.get(`set-${i}-defender`)),
    }));
}
export function SetScoreFields({ challenge: c }: { challenge: Challenge }) {
  const sets = c.setScores ?? parseLegacySetScores(c.score);
  return (
    <fieldset className="stack">
      <legend>Resultado por set</legend>
      <p>
        Preenche os jogos de cada dupla na ordem ATAQUE / DEFESA. O 3.º set só é
        necessário em caso de 1–1; aceita super tie-break.
      </p>
      <p>
        <strong>ATAQUE:</strong>{" "}
        {c.challengerTeam?.map((p) => p.name).join(" + ") ?? "Dupla atacante"}
        <br />
        <strong>DEFESA:</strong>{" "}
        {c.defenderTeam?.map((p) => p.name).join(" + ") ?? "Dupla defensora"}
      </p>
      {[0, 1, 2].map((i) => (
        <div className="form-grid" key={i}>
          <label>
            {i + 1}.º set · ATAQUE
            <input
              aria-label={`${i + 1}.º set ATAQUE`}
              type="number"
              name={`set-${i}-attacker`}
              min={0}
              max={99}
              required={i < 2}
              defaultValue={sets?.[i]?.attacker}
            />
          </label>
          <label>
            {i + 1}.º set · DEFESA
            <input
              aria-label={`${i + 1}.º set DEFESA`}
              type="number"
              name={`set-${i}-defender`}
              min={0}
              max={99}
              required={i < 2}
              defaultValue={sets?.[i]?.defender}
            />
          </label>
        </div>
      ))}
    </fieldset>
  );
}
export function SetScoreDisplay({ challenge: c }: { challenge: Challenge }) {
  if (!c.setScores?.length) return <p>{c.score || "Sets não indicados"}</p>;
  return (
    <div className="stack">
      <strong>Resultado por set · ATAQUE / DEFESA</strong>
      {c.setScores.map((s, i) => (
        <p key={i}>
          {i + 1}.º set:{" "}
          <strong>
            {s.attacker} – {s.defender}
          </strong>
        </p>
      ))}
    </div>
  );
}
