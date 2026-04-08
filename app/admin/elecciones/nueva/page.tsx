import Link from "next/link";
import EleccionForm from "@/components/admin/EleccionForm";

export default function NuevaEleccionPage() {
  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/dashboard"
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Nueva elección</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <EleccionForm />
      </div>
    </div>
  );
}
