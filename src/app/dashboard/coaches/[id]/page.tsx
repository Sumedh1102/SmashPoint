import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ActionButton } from "@/components/forms/confirm-action";
import { CoachPortrait } from "@/components/marketing/cards";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form";
import { KeyValue, PageHeader } from "@/components/ui/misc";
import { can } from "@/lib/rbac";
import { setCoachActive, updateCoach, uploadCoachPhoto } from "@/server/actions/coaches";
import { requirePermission } from "@/server/auth/guards";
import { getCoachDetail } from "@/server/queries/coaches";
import { CoachForm } from "../_components/coach-form";

export const metadata = { title: "Coach" };

export default async function CoachDetailPage({ params, searchParams }: PageProps<"/dashboard/coaches/[id]">) {
  const user = await requirePermission("coaches:view");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getCoachDetail(id);
  if (!detail) notFound();
  const { coach } = detail;
  const manage = can(user.role, "coaches:manage");

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Coaches", href: "/dashboard/coaches" }, { label: detail.name }]}
        title={detail.name}
        description={coach.title}
        eyebrow={detail.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>}
        actions={
          manage ? (
            <ActionButton
              action={setCoachActive.bind(null, id, !detail.isActive)}
              variant={detail.isActive ? "danger" : "primary"}
              confirm={{ title: detail.isActive ? "Deactivate this coach?" : "Reactivate this coach?", description: detail.isActive ? "They won't be able to sign in and will be hidden from the website." : undefined, danger: detail.isActive }}
            >
              {detail.isActive ? "Deactivate" : "Reactivate"}
            </ActionButton>
          ) : null
        }
      />
      {sp.created ? (
        <div className="mb-6">
          <FormMessage tone="success">Coach created. They can sign in with the email and temporary password you set.</FormMessage>
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader title={manage ? "Edit profile" : "Profile"} />
            <CardBody className="p-6">
              {manage ? (
                <CoachForm
                  action={updateCoach.bind(null, id)}
                  submitLabel="Save profile"
                  defaults={{ name: detail.name, phone: detail.phone, title: coach.title, experienceYears: coach.experienceYears, specialization: coach.specialization, certifications: coach.certifications, achievements: coach.achievements, bio: coach.bio, isPublic: coach.isPublic, sortOrder: coach.sortOrder }}
                />
              ) : (
                <KeyValue items={[{ label: "Specialization", value: coach.specialization }, { label: "Experience", value: `${coach.experienceYears} years` }, { label: "Certifications", value: coach.certifications.join(", ") }]} />
              )}
            </CardBody>
          </Card>
        </div>
        <div className="grid content-start gap-6">
          <Card className="overflow-hidden">
            <CoachPortrait coach={{ name: detail.name, photoUrl: coach.photoUrl }} />
            {manage ? (
              <CardBody>
                <ActionForm action={uploadCoachPhoto.bind(null, id)} className="grid gap-3">
                  <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:font-medium" />
                  <SubmitButton size="sm" variant="dark">
                    Upload photograph
                  </SubmitButton>
                </ActionForm>
              </CardBody>
            ) : null}
          </Card>
          <Card>
            <CardHeader title="Account" />
            <CardBody>
              <KeyValue items={[{ label: "Login", value: detail.email }, { label: "Phone", value: detail.phone ?? "—" }, { label: "Public profile", value: coach.isPublic ? `/coaches#${coach.slug}` : "Hidden" }]} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
