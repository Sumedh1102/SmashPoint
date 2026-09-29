import { ActionForm, SubmitButton, SwitchField, TextField } from "@/components/forms/action-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, PageHeader } from "@/components/ui/misc";
import { ROLE_LABELS } from "@/lib/rbac";
import { changePassword, updateAvatar, updatePreferences, updateProfile } from "@/server/actions/profile";
import { requireUser } from "@/server/auth/guards";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const prefs = user.preferences ?? { emailNotifications: true, smsNotifications: false, whatsappNotifications: true, bookingReminders: true, classReminders: true, marketing: false };
  return (
    <>
      <PageHeader title="Profile & preferences" description={`${ROLE_LABELS[user.role]} account`} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Personal details" />
            <CardBody>
              <ActionForm action={updateProfile} className="grid gap-4 md:grid-cols-2">
                <TextField name="name" label="Full name" required defaultValue={user.name} autoComplete="name" />
                <TextField name="phone" label="Phone" type="tel" defaultValue={user.phone} autoComplete="tel" />
                <TextField name="email" label="Email" type="email" required defaultValue={user.email} autoComplete="email" className="md:col-span-2" />
                <TextField name="emergencyContactName" label="Emergency contact name" defaultValue={user.emergencyContactName} />
                <TextField name="emergencyContactPhone" label="Emergency contact phone" type="tel" defaultValue={user.emergencyContactPhone} />
                <div className="md:col-span-2">
                  <SubmitButton>Save details</SubmitButton>
                </div>
              </ActionForm>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Change password" description="Other devices are signed out after a change." />
            <CardBody>
              <ActionForm action={changePassword} className="grid gap-4 md:grid-cols-3" resetOnSuccess>
                <TextField name="current" label="Current password" type="password" autoComplete="current-password" />
                <TextField name="next" label="New password" type="password" autoComplete="new-password" hint="8+ characters, include a number" />
                <TextField name="confirm" label="Confirm new password" type="password" autoComplete="new-password" />
                <div className="md:col-span-3">
                  <SubmitButton variant="dark">Update password</SubmitButton>
                </div>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader title="Profile photo" />
            <CardBody className="grid justify-items-center gap-4">
              <Avatar name={user.name} src={user.avatarUrl} size={112} className="rounded-2xl border" />
              <ActionForm action={updateAvatar} className="grid w-full gap-3">
                <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:font-medium" aria-label="Choose a profile photo" />
                <SubmitButton variant="outline" size="sm">
                  Upload photo
                </SubmitButton>
              </ActionForm>
              <p className="text-center text-xs text-muted">JPG, PNG or WebP up to 2 MB.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Notification preferences" />
            <CardBody>
              <ActionForm action={updatePreferences} className="grid gap-4">
                <SwitchField name="emailNotifications" label="Email" description="Receipts and confirmations" defaultChecked={prefs.emailNotifications} />
                <SwitchField name="whatsappNotifications" label="WhatsApp" description="Booking confirmations & reminders" defaultChecked={prefs.whatsappNotifications} />
                <SwitchField name="smsNotifications" label="SMS" description="Fallback when WhatsApp isn't available" defaultChecked={prefs.smsNotifications} />
                <SwitchField name="bookingReminders" label="Booking reminders" defaultChecked={prefs.bookingReminders} />
                <SwitchField name="classReminders" label="Class reminders" defaultChecked={prefs.classReminders} />
                <SwitchField name="marketing" label="Events & offers" defaultChecked={prefs.marketing} />
                <SubmitButton variant="dark">Save preferences</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
