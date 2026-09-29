"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { batchStudents, batches, parents, students } from "@/server/db/schema";
import { deleteAssets, imageFromForm } from "@/server/storage/media";
import { assertPermission, assertUser } from "@/server/auth/guards";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";
import { randomToken } from "@/server/security";
import { nextStudentCode } from "@/server/services/students";
import { can } from "@/lib/rbac";
import { todayInTz } from "@/lib/time";
import { isoDate, nameSchema, optionalEmail, optionalText, phoneSchema } from "@/lib/validation";
import { formObject, toActionError, type ActionResult } from "./result";

const optionalPhone = z.union([z.literal(""), phoneSchema]).optional().transform((v) => v || null);
const optionalDate = z.union([z.literal(""), isoDate]).optional().transform((v) => v || null);
const optionalUuid = z.union([z.literal(""), z.uuid()]).optional().transform((v) => v || null);

const studentSchema = z.object({
  name: nameSchema,
  dateOfBirth: optionalDate,
  gender: z.union([z.literal(""), z.enum(["MALE", "FEMALE", "OTHER"])]).optional().transform((v) => v || null),
  phone: optionalPhone,
  email: optionalEmail,
  address: optionalText(300),
  emergencyContactName: optionalText(120),
  emergencyContactPhone: optionalPhone,
  joiningDate: isoDate,
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).default("ACTIVE"),
  coachId: optionalUuid,
  batchId: optionalUuid,
  medicalNotes: optionalText(500),
  notes: optionalText(1000),
  parentName: optionalText(120),
  parentRelation: optionalText(40),
  parentPhone: optionalPhone,
  parentEmail: optionalEmail,
});

async function upsertParent(input: z.infer<typeof studentSchema>, existingParentId: string | null) {
  if (!input.parentName || !input.parentPhone) return existingParentId;
  if (existingParentId) {
    await db
      .update(parents)
      .set({ name: input.parentName, phone: input.parentPhone, email: input.parentEmail, relation: input.parentRelation ?? "Parent" })
      .where(eq(parents.id, existingParentId));
    return existingParentId;
  }
  const [byPhone] = await db.select({ id: parents.id }).from(parents).where(eq(parents.phone, input.parentPhone)).limit(1);
  if (byPhone) return byPhone.id;
  const [created] = await db
    .insert(parents)
    .values({ name: input.parentName, phone: input.parentPhone, email: input.parentEmail, relation: input.parentRelation ?? "Parent" })
    .returning({ id: parents.id });
  return created!.id;
}

async function enrol(studentId: string, batchId: string) {
  await db.transaction(async (tx) => {
    const [batch] = await tx.select().from(batches).where(eq(batches.id, batchId)).for("update");
    if (!batch) throw new DomainError("Batch not found.");
    const [{ n }] = (await tx
      .select({ n: count() })
      .from(batchStudents)
      .where(and(eq(batchStudents.batchId, batchId), eq(batchStudents.isActive, true)))) as [{ n: number }];
    const [existing] = await tx.select().from(batchStudents).where(and(eq(batchStudents.batchId, batchId), eq(batchStudents.studentId, studentId)));
    if (existing?.isActive) return;
    if (n >= batch.capacity) throw new DomainError(`${batch.name} is full (${batch.capacity}/${batch.capacity}).`, "CAPACITY_FULL");
    if (existing) await tx.update(batchStudents).set({ isActive: true, joinedOn: todayInTz() }).where(eq(batchStudents.id, existing.id));
    else await tx.insert(batchStudents).values({ batchId, studentId, joinedOn: todayInTz() });
  });
}

export async function createStudent(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const actor = await assertPermission("students:manage");
    const input = studentSchema.parse(formObject(formData));
    const parentId = await upsertParent(input, null);
    const created = await db.transaction(async (tx) => {
      const studentCode = await nextStudentCode(tx);
      const [row] = await tx
        .insert(students)
        .values({
          studentCode,
          name: input.name,
          dateOfBirth: input.dateOfBirth,
          gender: input.gender,
          phone: input.phone,
          email: input.email,
          address: input.address,
          emergencyContactName: input.emergencyContactName ?? input.parentName,
          emergencyContactPhone: input.emergencyContactPhone ?? input.parentPhone,
          joiningDate: input.joiningDate,
          level: input.level,
          status: input.status,
          coachId: input.coachId,
          parentId,
          medicalNotes: input.medicalNotes,
          notes: input.notes,
          qrToken: randomToken(18),
        })
        .returning({ id: students.id });
      return row!;
    });
    id = created.id;
    if (input.batchId) await enrol(id, input.batchId);
    await audit(actor.id, "student.create", "student", id, { name: input.name });
    revalidatePath("/dashboard/students");
  } catch (err) {
    return toActionError(err);
  }
  redirect(`/dashboard/students/${id}?created=1`);
}

export async function updateStudent(studentId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("students:manage");
    const input = studentSchema.parse(formObject(formData));
    const [existing] = await db.select({ parentId: students.parentId }).from(students).where(eq(students.id, studentId));
    if (!existing) throw new DomainError("Student not found.");
    const parentId = await upsertParent(input, existing.parentId);
    await db
      .update(students)
      .set({
        name: input.name,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
        phone: input.phone,
        email: input.email,
        address: input.address,
        emergencyContactName: input.emergencyContactName,
        emergencyContactPhone: input.emergencyContactPhone,
        joiningDate: input.joiningDate,
        level: input.level,
        status: input.status,
        coachId: input.coachId,
        parentId,
        medicalNotes: input.medicalNotes,
        notes: input.notes,
      })
      .where(eq(students.id, studentId));
    if (input.batchId) await enrol(studentId, input.batchId);
    await audit(actor.id, "student.update", "student", studentId);
    revalidatePath(`/dashboard/students/${studentId}`);
    return { ok: true, message: "Student updated" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function addToBatch(studentId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertPermission("students:manage");
    const batchId = z.uuid().parse(formData.get("batchId"));
    await enrol(studentId, batchId);
    revalidatePath(`/dashboard/students/${studentId}`);
    return { ok: true, message: "Added to batch" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function removeFromBatch(studentId: string, batchId: string): Promise<ActionResult> {
  try {
    const actor = await assertUser();
    if (!can(actor.role, "students:manage") && !can(actor.role, "batches:manage")) throw new DomainError("Not allowed.");
    await db.update(batchStudents).set({ isActive: false }).where(and(eq(batchStudents.studentId, studentId), eq(batchStudents.batchId, batchId)));
    revalidatePath(`/dashboard/students/${studentId}`);
    revalidatePath(`/dashboard/batches/${batchId}`);
    return { ok: true, message: "Removed from batch" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function regenerateQr(studentId: string): Promise<ActionResult> {
  try {
    const actor = await assertPermission("students:manage");
    await db.update(students).set({ qrToken: randomToken(18) }).where(eq(students.id, studentId));
    await audit(actor.id, "student.qr_rotate", "student", studentId);
    revalidatePath(`/dashboard/students/${studentId}`);
    return { ok: true, message: "New QR code issued — the old one no longer works" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteStudent(studentId: string): Promise<ActionResult> {
  try {
    const actor = await assertPermission("students:delete");
    await db.delete(students).where(eq(students.id, studentId));
    await audit(actor.id, "student.delete", "student", studentId);
    revalidatePath("/dashboard/students");
    return { ok: true, message: "Student deleted" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function uploadStudentPhoto(studentId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertPermission("students:manage");
    const [current] = await db.select({ photoUrl: students.photoUrl }).from(students).where(eq(students.id, studentId));
    if (!current) throw new DomainError("Student not found.", "NOT_FOUND", 404);
    const image = await imageFromForm(formData, "photo", { url: current.photoUrl });
    if (!image.changed) return { ok: true, message: "No changes" };
    await db.update(students).set({ photoUrl: image.url }).where(eq(students.id, studentId));
    await deleteAssets(image.stale);
    revalidatePath(`/dashboard/students/${studentId}`);
    return { ok: true, message: "Photo updated" };
  } catch (err) {
    return toActionError(err);
  }
}
