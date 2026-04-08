import type { Metadata } from "next";
import AdminGuard from "./AdminGuard";
import AdminNav from "./AdminNav";

export const metadata: Metadata = {
  title: "Admin — VotaYa",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-slate-50">
        <AdminNav />
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </div>
    </AdminGuard>
  );
}
