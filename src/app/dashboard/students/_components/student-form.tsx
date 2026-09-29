import { ActionForm, SelectField, SubmitButton, TextField, TextareaField } from "@/components/forms/action-form";
import type { ActionResult } from "@/server/actions/result";

type StudentDefaults = {
  name?: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  joiningDate?: string;
  level?: string;
  status?: string;
  coachId?: string | null;
  medicalNotes?: string | null;
  notes?: string | null;
  parentName?: string | null;
  parentRelation?: string | null;
  parentPhone?: string | null;
  parentEmail?: string | null;
};

export function StudentForm({
  action,
  defaults = {},
  coaches,
  batches,
  submitLabel,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  defaults?: StudentDefaults;
  coaches: { id: string; name: string }[];
  batches: { id: string; name: string }[];
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-6">
      <fieldset className="grid gap-4 md:grid-cols-2">
        <legend className="mb-3 font-display text-lg font-semibold">Student</legend>
        <TextField name="name" label="Full name" required defaultValue={defaults.name} className="md:col-span-2" />
        <TextField name="dateOfBirth" label="Date of birth" type="date" defaultValue={defaults.dateOfBirth} />
        <SelectField name="gender" label="Gender" defaultValue={defaults.gender} placeholder="Select" options={[{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }, { value: "OTHER", label: "Other" }]} />
        <TextField name="phone" label="Phone" type="tel" defaultValue={defaults.phone} hint="Leave blank for young children" />
        <TextField name="email" label="Email" type="email" defaultValue={defaults.email} />
        <TextareaField name="address" label="Address" rows={2} defaultValue={defaults.address} className="md:col-span-2" />
      </fieldset>

      <fieldset className="grid gap-4 border-t border-line pt-5 md:grid-cols-2">
        <legend className="mb-3 font-display text-lg font-semibold">Parent / guardian</legend>
        <TextField name="parentName" label="Parent name" defaultValue={defaults.parentName} />
        <SelectField name="parentRelation" label="Relation" defaultValue={defaults.parentRelation ?? "Mother"} options={["Mother", "Father", "Guardian", "Other"].map((v) => ({ value: v, label: v }))} />
        <TextField name="parentPhone" label="Parent phone" type="tel" defaultValue={defaults.parentPhone} />
        <TextField name="parentEmail" label="Parent email" type="email" defaultValue={defaults.parentEmail} />
        <TextField name="emergencyContactName" label="Emergency contact" defaultValue={defaults.emergencyContactName} hint="Defaults to the parent" />
        <TextField name="emergencyContactPhone" label="Emergency phone" type="tel" defaultValue={defaults.emergencyContactPhone} />
      </fieldset>

      <fieldset className="grid gap-4 border-t border-line pt-5 md:grid-cols-2">
        <legend className="mb-3 font-display text-lg font-semibold">Training</legend>
        <TextField name="joiningDate" label="Joining date" type="date" required defaultValue={defaults.joiningDate} />
        <SelectField name="level" label="Level" defaultValue={defaults.level ?? "BEGINNER"} options={[{ value: "BEGINNER", label: "Beginner" }, { value: "INTERMEDIATE", label: "Intermediate" }, { value: "ADVANCED", label: "Advanced" }]} />
        <SelectField name="coachId" label="Primary coach" defaultValue={defaults.coachId} placeholder="Unassigned" options={coaches.map((c) => ({ value: c.id, label: c.name }))} />
        <SelectField name="batchId" label="Add to batch" placeholder="—" options={batches.map((b) => ({ value: b.id, label: b.name }))} hint="Capacity is checked automatically" />
        <SelectField name="status" label="Status" defaultValue={defaults.status ?? "ACTIVE"} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }, { value: "SUSPENDED", label: "Suspended" }]} />
        <TextareaField name="medicalNotes" label="Medical notes" rows={2} defaultValue={defaults.medicalNotes} placeholder="Allergies, injuries, asthma…" />
        <TextareaField name="notes" label="Internal notes" rows={2} defaultValue={defaults.notes} className="md:col-span-2" />
      </fieldset>

      <div className="flex justify-end border-t border-line pt-5">
        <SubmitButton size="lg">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
