"use client";

import { Trash2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtFecha } from "@/lib/format";
import { avisarError, avisarOk, llamarApi } from "@/lib/settings/cliente";

type Rol = "admin" | "miembro";
interface UsuarioUi {
  email: string;
  rol: Rol;
  invitadoPor: string | null;
  fecha: string;
  arranque: boolean;
}

const ROLES = [
  { value: "miembro", label: "Miembro" },
  { value: "admin", label: "Admin" },
];

/**
 * Ajustes → Usuarios (solo admin): quién entra con Google. Miembro: todo salvo usuarios, Apify,
 * presupuestos y Chrome. Revocar es inmediato en esta Mac y llega a la otra al sincronizar.
 */
export function UsersPanel(): React.ReactElement {
  const [usuarios, setUsuarios] = useState<UsuarioUi[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol>("miembro");
  const [ocupado, setOcupado] = useState(false);
  const idEmail = useId();

  const cargar = useCallback(() => {
    llamarApi<{ usuarios: UsuarioUi[] }>("/api/usuarios")
      .then((r) => setUsuarios(r.usuarios))
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(cargar, [cargar]);

  const enviar = async (cuerpo: { email: string; rol: Rol }, ok: string) => {
    setOcupado(true);
    try {
      const r = await llamarApi<{ usuarios: UsuarioUi[] }>("/api/usuarios", { method: "POST", body: cuerpo });
      setUsuarios(r.usuarios);
      avisarOk(ok);
      return true;
    } catch (e) {
      avisarError("No se pudo guardar", (e as Error).message);
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const revocar = async (u: UsuarioUi) => {
    setOcupado(true);
    try {
      const r = await llamarApi<{ usuarios: UsuarioUi[] }>(`/api/usuarios?email=${encodeURIComponent(u.email)}`, { method: "DELETE" });
      setUsuarios(r.usuarios);
      avisarOk("Acceso quitado", u.email);
    } catch (e) {
      avisarError("No se pudo quitar el acceso", (e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios</CardTitle>
        <CardDescription>
          Entran con su cuenta de Google. Los miembros pueden lanzar corridas, usar el chat y exportar; solo los admins gestionan usuarios, Apify,
          presupuestos y Chrome.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-5">
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await enviar({ email, rol }, `Invitada ${email.trim()}`)) setEmail("");
          }}
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm" htmlFor={idEmail}>
            <span className="t-label">Correo de Google</span>
            <Input autoComplete="off" id={idEmail} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@empresa.com" type="email" value={email} />
          </label>
          <Select items={ROLES} onValueChange={(v) => (v === "admin" || v === "miembro") && setRol(v)} value={rol}>
            <SelectTrigger aria-label="Rol" className="sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
          <Button disabled={!email.trim()} loading={ocupado} type="submit">
            <UserPlus aria-hidden="true" />
            Invitar
          </Button>
        </form>

        {error && <p className="text-sm text-s-no-funciona">{error}</p>}
        {usuarios && (
          <ul className="flex flex-col divide-y divide-border">
            {usuarios.map((u) => (
              <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5" key={u.email}>
                <span className="min-w-0 flex-1 truncate text-sm text-fg">{u.email}</span>
                {u.arranque ? (
                  <Badge variant="secondary">admin · .env.local</Badge>
                ) : (
                  <Select
                    items={ROLES}
                    onValueChange={(v) => (v === "admin" || v === "miembro") && v !== u.rol && void enviar({ email: u.email, rol: v }, `${u.email} ahora es ${v}`)}
                    value={u.rol}
                  >
                    <SelectTrigger aria-label={`Rol de ${u.email}`} className="w-32" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                )}
                {u.fecha && <span className="text-xs text-fg-dim">desde {fmtFecha(u.fecha.slice(0, 10))}</span>}
                {!u.arranque && (
                  <Button aria-label={`Quitar acceso a ${u.email}`} disabled={ocupado} onClick={() => void revocar(u)} size="icon-sm" variant="ghost">
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </li>
            ))}
            {usuarios.length === 0 && <li className="py-2.5 text-sm text-fg-muted">Nadie invitado todavía.</li>}
          </ul>
        )}
      </CardPanel>
    </Card>
  );
}
