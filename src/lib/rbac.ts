/**
 * Role-based access control. Pure and isomorphic so the UI can hide what the server
 * would reject anyway — the server always re-checks (see src/server/auth/guards.ts).
 */
export const ROLES = ["ADMIN", "MANAGER", "COACH", "RECEPTION", "CUSTOMER"] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES: Role[] = ["ADMIN", "MANAGER", "COACH", "RECEPTION"];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin / Owner",
  MANAGER: "Manager",
  COACH: "Coach",
  RECEPTION: "Reception",
  CUSTOMER: "Customer",
};

const P = {
  "users:view": ["ADMIN", "MANAGER", "RECEPTION"],
  "users:manage": ["ADMIN", "MANAGER"],
  "sports:manage": ["ADMIN"],
  "equipment:view": ["ADMIN", "MANAGER", "RECEPTION"],
  "equipment:manage": ["ADMIN", "MANAGER"],
  "rentals:manage": ["ADMIN", "MANAGER", "RECEPTION"],
  "facilities:manage": ["ADMIN", "MANAGER"],
  "food:manage": ["ADMIN", "MANAGER"],
  "gallery:manage": ["ADMIN", "MANAGER"],
  /** Coaches may manage adverts that name them as the coach. */
  "coaching-ads:manage": ["ADMIN", "MANAGER", "COACH"],
  "students:view": ["ADMIN", "MANAGER", "COACH", "RECEPTION"],
  "students:manage": ["ADMIN", "MANAGER", "RECEPTION"],
  "students:delete": ["ADMIN", "MANAGER"],
  "courts:view": ["ADMIN", "MANAGER", "RECEPTION"],
  "courts:manage": ["ADMIN", "MANAGER"],
  "bookings:manage": ["ADMIN", "MANAGER", "RECEPTION"],
  "coaches:view": ["ADMIN", "MANAGER"],
  "coaches:manage": ["ADMIN"],
  "batches:view": ["ADMIN", "MANAGER", "COACH", "RECEPTION"],
  "batches:manage": ["ADMIN", "MANAGER"],
  "attendance:view": ["ADMIN", "MANAGER", "COACH", "RECEPTION"],
  "attendance:mark": ["ADMIN", "MANAGER", "COACH"],
  "attendance:scan": ["ADMIN", "MANAGER", "COACH", "RECEPTION"],
  "performance:manage": ["ADMIN", "MANAGER", "COACH"],
  "memberships:view": ["ADMIN", "MANAGER", "RECEPTION"],
  "memberships:manage": ["ADMIN", "MANAGER"],
  "payments:view": ["ADMIN", "MANAGER", "RECEPTION"],
  "payments:record": ["ADMIN", "MANAGER", "RECEPTION"],
  "payments:refund": ["ADMIN", "MANAGER"],
  "events:manage": ["ADMIN", "MANAGER"],
  "announcements:manage": ["ADMIN", "MANAGER"],
  "reports:view": ["ADMIN", "MANAGER"],
  "settings:manage": ["ADMIN"],
  "staff:manage": ["ADMIN"],
  "enquiries:view": ["ADMIN", "MANAGER", "RECEPTION"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof P;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (P[permission] as readonly Role[]).includes(role);
}

export function isStaff(role: Role | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

/** Coaches only see the batches and students assigned to them. */
export function isScopedToCoach(role: Role | null | undefined): boolean {
  return role === "COACH";
}
