"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import EleccionForm from "@/components/admin/EleccionForm";

export default function NuevaEleccionPage() {
  const params = useParams<{ orgSlug: string }>();
  const base = `/org/${params.orgSlug}/admin`;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`${base}/dashboard`}
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Nueva elección</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <EleccionForm redirectAfterCreate={(id) => `${base}/elecciones/${id}`} />
      </div>
    </div>
  );
}
