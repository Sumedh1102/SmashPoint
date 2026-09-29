/** One-click accounts on the public demo (DEMO_MODE) and in local development. */
export const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@smashpoint.in" },
  { role: "Manager", email: "manager@smashpoint.in" },
  { role: "Coach", email: "coach@smashpoint.in" },
  { role: "Reception", email: "reception@smashpoint.in" },
  { role: "Customer", email: "customer@smashpoint.in" },
  { role: "Parent", email: "parent@smashpoint.in" },
] as const;

export const DEMO_EMAILS: readonly string[] = DEMO_ACCOUNTS.map((a) => a.email);
