export function isConfiguredAdminEmail(
  email: string,
  configured = process.env.ADMIN_EMAIL,
): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !configured) return false;

  return configured
    .split(",")
    .some((candidate) => candidate.trim().toLowerCase() === normalizedEmail);
}
