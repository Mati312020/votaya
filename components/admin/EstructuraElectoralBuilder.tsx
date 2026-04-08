"use client";

import { useState, useTransition, useCallback } from "react";
import {
  getEstructuraElectoral,
  crearNodoEstructura,
  actualizarNodoEstructura,
  eliminarNodoEstructura,
} from "@/lib/supabase/admin-queries";
import type { EstructuraNode, NivelEstructura } from "@/types/voting";
import { NIVEL_LABEL } from "@/types/voting";

// ── Paleta visual por nivel ────────────────────────────────
const NIVEL_COLOR: Record<NivelEstructura, { bg: string; border: string; text: string; dot: string }> = {
  distrito: { bg: "bg-blue-50",   border: "border-blue-200",  text: "text-blue-800",  dot: "bg-blue-500"   },
  seccion:  { bg: "bg-violet-50", border: "border-violet-200",text: "text-violet-800",dot: "bg-violet-500" },
  circuito: { bg: "bg-amber-50",  border: "border-amber-200", text: "text-amber-800", dot: "bg-amber-500"  },
  mesa:     { bg: "bg-green-50",  border: "border-green-200", text: "text-green-800", dot: "bg-green-500"  },
};

// Hijos válidos que se pueden agregar bajo un nivel
const SIGUIENTES: Record<NivelEstructura, NivelEstructura[]> = {
  distrito: ["seccion", "circuito", "mesa"],
  seccion:  ["circuito", "mesa"],
  circuito: ["mesa"],
  mesa:     [],
};

// Nodos que puede crear el admin al nivel raíz
const NIVELES_RAIZ: NivelEstructura[] = ["distrito", "seccion", "circuito", "mesa"];

// ── Construir árbol desde lista plana ─────────────────────
function buildTree(nodes: EstructuraNode[]): EstructuraNode[] {
  const map = new Map<number, EstructuraNode>();
  const roots: EstructuraNode[] = [];

  for (const n of nodes) {
    map.set(n.id, { ...n, hijos: [] });
  }
  for (const n of map.values()) {
    if (n.padre_id == null) {
      roots.push(n);
    } else {
      const parent = map.get(n.padre_id);
      if (parent) parent.hijos = [...(parent.hijos ?? []), n];
    }
  }
  return roots;
}

// ── Formulario inline para agregar nodo ──────────────────
function AddNodeForm({
  nivel,
  onAdd,
  onCancel,
}: {
  nivel: NivelEstructura;
  onAdd: (nombre: string, codigo: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    await onAdd(nombre.trim(), codigo.trim());
    setSaving(false);
  }

  const c = NIVEL_COLOR[nivel];
  return (
    <form onSubmit={submit} className={`flex items-center gap-2 mt-2 p-2 rounded-lg border ${c.border} ${c.bg}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
      <span className={`text-xs font-semibold ${c.text} w-14 flex-shrink-0`}>{NIVEL_LABEL[nivel]}</span>
      <input
        autoFocus
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder={`Nombre del ${NIVEL_LABEL[nivel].toLowerCase()}...`}
        className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
        required
      />
      <input
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        placeholder="Código (opcional)"
        className="w-24 text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
      />
      <button
        type="submit"
        disabled={saving || !nombre.trim()}
        className="px-3 py-1 bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 hover:bg-blue-800 transition-colors whitespace-nowrap"
      >
        {saving ? "..." : "Agregar"}
      </button>
      <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-lg leading-none px-1">×</button>
    </form>
  );
}

// ── Nodo del árbol (recursivo) ────────────────────────────
function NodoTree({
  node,
  depth,
  onRefresh,
}: {
  node: EstructuraNode;
  depth: number;
  onRefresh: () => void;
}) {
  const [expanded,    setExpanded]    = useState(true);
  const [addingNivel, setAddingNivel] = useState<NivelEstructura | null>(null);
  const [editing,     setEditing]     = useState(false);
  const [editNombre,  setEditNombre]  = useState(node.nombre);
  const [editCodigo,  setEditCodigo]  = useState(node.codigo ?? "");
  const [, startT] = useTransition();

  const c = NIVEL_COLOR[node.nivel];
  const hijos = node.hijos ?? [];
  const siguientes = SIGUIENTES[node.nivel];

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${node.nombre}"${hijos.length > 0 ? ` y sus ${hijos.length} sub-nodos` : ""}?`)) return;
    await eliminarNodoEstructura(node.id);
    onRefresh();
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    startT(async () => {
      await actualizarNodoEstructura(node.id, { nombre: editNombre.trim(), codigo: editCodigo.trim() || undefined });
      setEditing(false);
      onRefresh();
    });
  }

  async function handleAdd(nombre: string, codigo: string) {
    if (!addingNivel) return;
    await crearNodoEstructura(node.eleccion_id, addingNivel, nombre, node.id, codigo || undefined, hijos.length);
    setAddingNivel(null);
    onRefresh();
  }

  return (
    <div style={{ marginLeft: depth > 0 ? "1.5rem" : "0" }}>
      {/* Fila del nodo */}
      <div className={`flex items-center gap-2 py-1.5 px-3 rounded-xl border ${c.border} ${c.bg} mb-1 group`}>
        {/* Expandir/colapsar */}
        {hijos.length > 0 ? (
          <button onClick={() => setExpanded(!expanded)} className={`text-xs w-4 text-center ${c.text} font-bold`}>
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot} ml-1`} />
        )}

        {/* Etiqueta nivel */}
        <span className={`text-xs font-semibold uppercase tracking-wide ${c.text} w-16 flex-shrink-0`}>
          {NIVEL_LABEL[node.nivel]}
        </span>

        {/* Nombre (editable) */}
        {editing ? (
          <form onSubmit={handleEdit} className="flex items-center gap-1 flex-1">
            <input
              autoFocus
              value={editNombre}
              onChange={(e) => setEditNombre(e.target.value)}
              className="flex-1 text-sm border border-slate-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              required
            />
            <input
              value={editCodigo}
              onChange={(e) => setEditCodigo(e.target.value)}
              placeholder="Código"
              className="w-20 text-xs font-mono border border-slate-300 rounded px-2 py-0.5 focus:outline-none"
            />
            <button type="submit" className="text-xs text-blue-700 font-semibold hover:underline">Guardar</button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:underline">Cancelar</button>
          </form>
        ) : (
          <span className="flex-1 text-sm font-medium text-slate-800">
            {node.nombre}
            {node.codigo && (
              <span className="ml-2 text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                {node.codigo}
              </span>
            )}
          </span>
        )}

        {/* Acciones (solo visibles en hover) */}
        {!editing && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-slate-400 hover:text-slate-600 px-1"
              title="Editar"
            >✏️</button>
            <button
              onClick={handleDelete}
              className="text-xs text-red-400 hover:text-red-600 px-1"
              title="Eliminar"
            >🗑️</button>
          </div>
        )}

        {/* Botones agregar hijo */}
        {!editing && siguientes.length > 0 && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
            {siguientes.map((nv) => (
              <button
                key={nv}
                onClick={() => setAddingNivel(nv)}
                className={`text-xs px-2 py-0.5 rounded-lg border font-medium transition-colors ${NIVEL_COLOR[nv].border} ${NIVEL_COLOR[nv].text} hover:${NIVEL_COLOR[nv].bg}`}
                title={`Agregar ${NIVEL_LABEL[nv]}`}
              >
                + {NIVEL_LABEL[nv]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Formulario inline para agregar hijo */}
      {addingNivel && (
        <div style={{ marginLeft: "1.5rem" }}>
          <AddNodeForm
            nivel={addingNivel}
            onAdd={handleAdd}
            onCancel={() => setAddingNivel(null)}
          />
        </div>
      )}

      {/* Hijos */}
      {expanded && hijos.map((hijo) => (
        <NodoTree key={hijo.id} node={hijo} depth={depth + 1} onRefresh={onRefresh} />
      ))}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────
interface Props {
  eleccionId: number;
  nodos: EstructuraNode[];
}

export default function EstructuraElectoralBuilder({ eleccionId, nodos: nodosProp }: Props) {
  const [nodos, setNodos] = useState<EstructuraNode[]>(nodosProp);
  const [addingRaiz, setAddingRaiz] = useState<NivelEstructura | null>(null);
  const [, startT] = useTransition();

  const refresh = useCallback(() => {
    startT(async () => {
      const fresh = await getEstructuraElectoral(eleccionId);
      setNodos(fresh);
    });
  }, [eleccionId]);

  async function handleAddRaiz(nombre: string, codigo: string) {
    if (!addingRaiz) return;
    await crearNodoEstructura(eleccionId, addingRaiz, nombre, null, codigo || undefined, arbol.length);
    setAddingRaiz(null);
    refresh();
  }

  const arbol = buildTree(nodos);
  const totalMesas = nodos.filter((n) => n.nivel === "mesa").length;

  return (
    <div className="flex flex-col gap-4">
      {/* Header con stats */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {nodos.length === 0
              ? "Sin estructura definida — podés crear una jerarquía o directamente agregar mesas."
              : `${nodos.length} nodo${nodos.length !== 1 ? "s" : ""} · ${totalMesas} mesa${totalMesas !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button onClick={refresh} className="text-xs text-blue-600 hover:underline">↻ Actualizar</button>
      </div>

      {/* Leyenda de niveles */}
      <div className="flex gap-2 flex-wrap">
        {(["distrito","seccion","circuito","mesa"] as NivelEstructura[]).map((nv) => {
          const c = NIVEL_COLOR[nv];
          return (
            <span key={nv} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${c.border} ${c.bg} ${c.text} font-medium`}>
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
              {NIVEL_LABEL[nv]}
            </span>
          );
        })}
      </div>

      {/* Árbol */}
      {arbol.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          {arbol.map((nodo) => (
            <NodoTree key={nodo.id} node={nodo} depth={0} onRefresh={refresh} />
          ))}
        </div>
      )}

      {/* Agregar nodo raíz */}
      {addingRaiz ? (
        <AddNodeForm
          nivel={addingRaiz}
          onAdd={handleAddRaiz}
          onCancel={() => setAddingRaiz(null)}
        />
      ) : (
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-slate-400 self-center">Agregar al nivel raíz:</span>
          {NIVELES_RAIZ.map((nv) => {
            const c = NIVEL_COLOR[nv];
            return (
              <button
                key={nv}
                onClick={() => setAddingRaiz(nv)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors hover:shadow-sm ${c.border} ${c.text} ${c.bg}`}
              >
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                + {NIVEL_LABEL[nv]}
              </button>
            );
          })}
        </div>
      )}

      {/* Guía de uso */}
      {nodos.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-medium mb-1">¿Cómo armar la estructura?</p>
          <ul className="text-xs space-y-1 list-disc list-inside text-blue-700">
            <li>Si tu organización tiene sedes en distintos lugares → creá un <strong>Distrito</strong> por sede, y <strong>Mesas</strong> dentro de cada uno.</li>
            <li>Para elecciones simples → agregá <strong>Mesas</strong> directamente (sin jerarquía superior).</li>
            <li>Cada nodo tiene un <strong>código</strong> opcional (ej: M01, M02) — usalo en el CSV del padrón para asignar votantes.</li>
            <li>Al subir el padrón, la columna <code>mesa</code> debe coincidir con el nombre o código de una mesa.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
