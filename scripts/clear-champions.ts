import { transaction } from "../lib/db";
import { execute } from "../lib/engine";

if (!process.argv.includes("--confirm-clear"))
  throw new Error("Para esvaziar o Hall of Champions, usa --confirm-clear.");

const result = await transaction((state) =>
  execute(
    state,
    {
      userId: "system:maintenance",
      playerId: "system:maintenance",
      role: "admin",
    },
    {
      type: "admin.champions.clear",
      confirmation: "ESVAZIAR",
      reason: "Limpeza do Hall of Champions a pedido do administrador",
    },
  ),
);
console.log(JSON.stringify(result));
process.exit(0);
