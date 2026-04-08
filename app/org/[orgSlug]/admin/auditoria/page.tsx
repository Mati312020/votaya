import AuditLog from "@/components/admin/AuditLog";

export default function AuditoriaPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Auditoría</h1>
        <p className="text-sm text-slate-500 mt-1">
          Registro completo de acciones del sistema. Las acciones de votantes se registran sin datos de identidad.
          Podés descargar el log completo en CSV, TXT o PDF.
        </p>
      </div>
      <AuditLog />
    </div>
  );
}
