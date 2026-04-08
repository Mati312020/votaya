"use client";

interface Props {
  votoHash: string;
  tituloEleccion: string;
  slug: string;
}

export default function VoteTicket({ votoHash, tituloEleccion, slug }: Props) {
  const fecha = new Date().toLocaleString("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Ícono de éxito */}
      <div className="relative">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
          <svg
            className="w-12 h-12 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">¡Voto emitido!</h1>
        <p className="text-slate-500 mt-1 text-sm">{tituloEleccion}</p>
      </div>

      {/* Ticket verificador */}
      <div className="w-full bg-slate-900 rounded-2xl p-5 text-center">
        <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">
          Código verificador
        </p>
        <div className="flex justify-center gap-3">
          <p className="text-green-400 font-mono text-xl font-bold tracking-widest">
            {votoHash.slice(0, 8)}
          </p>
          <p className="text-green-400 font-mono text-xl font-bold tracking-widest">
            {votoHash.slice(8)}
          </p>
        </div>
        <p className="text-slate-500 text-xs mt-3">{fecha}</p>
      </div>

      <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">¿Para qué sirve este código?</p>
        <p>
          Es un comprobante de que tu voto fue registrado. No revela tu identidad
          ni por quién votaste, pero confirma que participaste en la elección.
        </p>
      </div>

      <button
        onClick={() => {
          sessionStorage.clear();
          window.location.href = `/e/${slug}`;
        }}
        className="w-full py-3 rounded-xl border-2 border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        Cerrar
      </button>
    </div>
  );
}
