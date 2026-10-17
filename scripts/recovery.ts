import { accountLink } from "../lib/auth";
import { database } from "../lib/db";
import type { User } from "../lib/types";
const email = process.argv[2]?.toLowerCase();
if (!email) throw new Error("Uso: npm run recovery -- email@dominio.pt");
const { db, client } = await database();
try {
  const user = await db.collection<User>("users").findOne({ email });
  if (!user) throw new Error("Regista primeiro a conta na aplicação.");
  console.log(await accountLink(email, "reset"));
} finally {
  await client.close();
}
