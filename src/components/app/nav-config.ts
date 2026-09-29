import { can, type Permission, type Role } from "@/lib/rbac";

export type IconKey =
  | "dashboard"
  | "students"
  | "courts"
  | "sports"
  | "bookings"
  | "book"
  | "rentals"
  | "equipment"
  | "users"
  | "coaches"
  | "coaching"
  | "facilities"
  | "food"
  | "gallery"
  | "batches"
  | "attendance"
  | "performance"
  | "memberships"
  | "membership"
  | "payments"
  | "events"
  | "announcements"
  | "reports"
  | "settings"
  | "profile"
  | "notifications"
  | "scan"
  | "enquiries";

export type NavItem = { href: string; label: string; icon: IconKey; group?: string };

type Rule = NavItem & { permission?: Permission; roles?: Role[] };

const CUSTOMER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "dashboard" },
  { href: "/book", label: "Book a court", icon: "book" },
  { href: "/dashboard/bookings", label: "My bookings", icon: "bookings" },
  { href: "/dashboard/rentals", label: "Equipment rentals", icon: "rentals" },
  { href: "/dashboard/payments", label: "Payments", icon: "payments" },
  { href: "/dashboard/notifications", label: "Notifications", icon: "notifications" },
  { href: "/dashboard/profile", label: "Profile", icon: "profile" },
];

/** Shown to customers who are also enrolled academy students (or their parents). */
const TRAINING_NAV: NavItem[] = [{ href: "/dashboard/attendance", label: "Training", icon: "attendance", group: "Academy" }];

const STAFF_NAV: Rule[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", group: "Overview" },
  { href: "/dashboard/bookings", label: "Bookings", icon: "bookings", permission: "bookings:manage", group: "Operations" },
  { href: "/dashboard/rentals", label: "Rentals", icon: "rentals", permission: "rentals:manage", group: "Operations" },
  { href: "/dashboard/payments", label: "Payments", icon: "payments", permission: "payments:view", group: "Operations" },
  { href: "/dashboard/users", label: "Users", icon: "users", permission: "users:view", group: "Operations" },
  { href: "/dashboard/enquiries", label: "Enquiries", icon: "enquiries", permission: "enquiries:view", group: "Operations" },
  { href: "/dashboard/sports", label: "Sports", icon: "sports", permission: "sports:manage", group: "Facility" },
  { href: "/dashboard/courts", label: "Courts", icon: "courts", permission: "courts:view", group: "Facility" },
  { href: "/dashboard/equipment", label: "Equipment", icon: "equipment", permission: "equipment:view", group: "Facility" },
  { href: "/dashboard/facilities", label: "Facilities", icon: "facilities", permission: "facilities:manage", group: "Facility" },
  { href: "/dashboard/food", label: "Food & Beverages", icon: "food", permission: "food:manage", group: "Facility" },
  { href: "/dashboard/coaching-ads", label: "Coaching Ads", icon: "coaching", permission: "coaching-ads:manage", group: "Content" },
  { href: "/dashboard/gallery", label: "Gallery", icon: "gallery", permission: "gallery:manage", group: "Content" },
  { href: "/dashboard/events", label: "Events", icon: "events", permission: "events:manage", group: "Content" },
  { href: "/dashboard/announcements", label: "Announcements", icon: "announcements", permission: "announcements:manage", group: "Content" },
  { href: "/dashboard/coaches", label: "Coaches", icon: "coaches", permission: "coaches:view", group: "Academy" },
  { href: "/dashboard/students", label: "Students", icon: "students", permission: "students:view", group: "Academy" },
  { href: "/dashboard/batches", label: "Batches", icon: "batches", permission: "batches:view", group: "Academy" },
  { href: "/dashboard/attendance", label: "Attendance", icon: "attendance", permission: "attendance:view", group: "Academy" },
  { href: "/dashboard/performance", label: "Performance", icon: "performance", permission: "performance:manage", group: "Academy" },
  { href: "/dashboard/memberships", label: "Memberships", icon: "memberships", permission: "memberships:view", group: "Academy" },
  { href: "/dashboard/reports", label: "Reports", icon: "reports", permission: "reports:view", group: "Insights" },
  { href: "/dashboard/notifications", label: "Notifications", icon: "notifications", group: "Insights" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings", permission: "settings:manage", group: "System" },
  { href: "/dashboard/profile", label: "Profile", icon: "profile", group: "System" },
];

export function navFor(role: Role, opts: { hasTraining?: boolean } = {}): NavItem[] {
  if (role === "CUSTOMER") return opts.hasTraining ? [...CUSTOMER_NAV.slice(0, -1), ...TRAINING_NAV, CUSTOMER_NAV.at(-1)!] : CUSTOMER_NAV;
  return STAFF_NAV.filter((i) => (!i.permission || can(role, i.permission)) && (!i.roles || i.roles.includes(role))).map(({ permission: _p, roles: _r, ...rest }) => rest);
}

/** Up to four destinations for the mobile bottom bar (the rest live in the "More" drawer). */
export function mobileNavFor(role: Role, opts: { hasTraining?: boolean } = {}): NavItem[] {
  const items = navFor(role, opts);
  const priority =
    role === "CUSTOMER"
      ? ["/dashboard", "/book", "/dashboard/bookings", "/dashboard/profile"]
      : ["/dashboard", "/dashboard/bookings", "/dashboard/attendance", "/dashboard/rentals", "/dashboard/users", "/dashboard/students", "/dashboard/payments"];
  return priority.map((h) => items.find((i) => i.href === h)).filter((i): i is NavItem => !!i).slice(0, 4);
}
