import SuperadminGuard from "./SuperadminGuard";
import SuperadminNav from "./SuperadminNav";

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SuperadminGuard>
      <div className="min-h-screen bg-slate-50">
        <SuperadminNav />
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      </div>
    </SuperadminGuard>
  );
}
