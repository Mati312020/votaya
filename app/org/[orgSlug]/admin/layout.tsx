import OrgAdminGuard from "./OrgAdminGuard";
import OrgAdminNav from "./OrgAdminNav";

export default function OrgAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrgAdminGuard>
      <div className="min-h-screen bg-slate-50">
        <OrgAdminNav />
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </div>
    </OrgAdminGuard>
  );
}
