import { z } from "zod";

export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
export const EMAIL_IN_USE =
  "Este email já está registado. Inicia sessão ou recupera a palavra-passe.";

/** Also catch older stored addresses with capitalization or surrounding spaces. */
export const emailLookup = (email: string) => ({
  $expr: {
    $eq: [{ $toLower: { $trim: { input: "$email" } } }, normalizeEmail(email)],
  },
});
