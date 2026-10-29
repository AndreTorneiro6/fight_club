import { Snowflake } from "lucide-react";
import { matchFrozenUntil } from "@/lib/match-freeze";
import { fmtDate } from "@/lib/rules";
import type { Challenge, View } from "@/lib/types";
import styles from "./frozen-match.module.css";

export function FrozenMatchNotice({ s, c }: { s: View; c: Challenge }) {
  const until = matchFrozenUntil(s, c);
  if (!until) return null;
  return (
    <div className={styles.notice} role="status" data-frozen-match={c._id}>
      <span className={styles.badge}>
        <Snowflake size={22} aria-hidden="true" /> Jogo congelado
      </span>
      <small>
        Adiado por férias · disponível a partir de{" "}
        {fmtDate(`${until}T12:00:00Z`)}
      </small>
    </div>
  );
}
