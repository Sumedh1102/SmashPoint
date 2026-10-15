import { PageHeader, Panel } from "@/components/admin/page-header";
import { PasswordForm } from "@/components/admin/password-form";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Account" };

export default async function AdminAccountPage() {
  const admin = await requireAdmin();
  return (
    <>
      <PageHeader title="Account" description={`Signed in as ${admin.name} (${admin.email}).`} />
      <Panel title="Change password">
        <div className="p-5">
          <PasswordForm />
        </div>
      </Panel>
      <p className="mt-6 max-w-2xl text-sm text-muted">
        Administrator accounts are managed from the server: <code className="rounded bg-paper-2 px-1.5 py-0.5 text-xs">npm run admin -- create &lt;email&gt; &quot;Name&quot;</code>,{" "}
        <code className="rounded bg-paper-2 px-1.5 py-0.5 text-xs">password &lt;email&gt;</code> or <code className="rounded bg-paper-2 px-1.5 py-0.5 text-xs">deactivate &lt;email&gt;</code>. There is no public sign-up.
      </p>
    </>
  );
}
