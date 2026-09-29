import { describe, expect, it } from "vitest";
import { can, isStaff } from "./rbac";

describe("rbac", () => {
  it("gives admins full access", () => {
    expect(can("ADMIN", "settings:manage")).toBe(true);
    expect(can("ADMIN", "payments:refund")).toBe(true);
  });

  it("limits reception to bookings, students and payments", () => {
    expect(can("RECEPTION", "bookings:manage")).toBe(true);
    expect(can("RECEPTION", "students:manage")).toBe(true);
    expect(can("RECEPTION", "payments:record")).toBe(true);
    expect(can("RECEPTION", "payments:refund")).toBe(false);
    expect(can("RECEPTION", "reports:view")).toBe(false);
  });

  it("lets coaches mark attendance but not manage payments", () => {
    expect(can("COACH", "attendance:mark")).toBe(true);
    expect(can("COACH", "performance:manage")).toBe(true);
    expect(can("COACH", "payments:view")).toBe(false);
  });

  it("denies customers every staff permission", () => {
    expect(isStaff("CUSTOMER")).toBe(false);
    expect(can("CUSTOMER", "students:view")).toBe(false);
    expect(can("CUSTOMER", "rentals:manage")).toBe(false);
    expect(can(null, "students:view")).toBe(false);
  });

  it("follows the facility permission matrix", () => {
    expect(can("MANAGER", "courts:manage")).toBe(true);
    expect(can("MANAGER", "equipment:manage")).toBe(true);
    expect(can("MANAGER", "users:manage")).toBe(true);
    expect(can("MANAGER", "sports:manage")).toBe(false);
    expect(can("RECEPTION", "rentals:manage")).toBe(true);
    expect(can("RECEPTION", "equipment:manage")).toBe(false);
    expect(can("RECEPTION", "users:view")).toBe(true);
    expect(can("COACH", "coaching-ads:manage")).toBe(true);
    expect(can("COACH", "gallery:manage")).toBe(false);
  });
});
