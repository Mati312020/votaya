export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="text-center max-w-sm w-full">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-700 rounded-2xl mb-6">
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-slate-900">VotaYa</h1>
        <p className="text-slate-500 mt-2">
          Sistema de votación digital seguro y transparente.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <a
            href="/admin/login"
            className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Acceder al panel de administración
          </a>
          <a
            href="/registro"
            className="w-full py-3 border-2 border-blue-200 hover:border-blue-400 text-blue-700 font-semibold rounded-xl transition-colors text-sm"
          >
            Crear nueva organización
          </a>
        </div>

        <p className="text-xs text-slate-400 mt-8">
          Para acceder a una elección como votante, usá el link o QR provisto por tu organización.
        </p>
      </div>
    </main>
  );
}
