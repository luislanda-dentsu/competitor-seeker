import { describe, expect, it } from "vitest";
import { decidirAcceso, destinoSeguro, esHostLocal, modoAcceso, secretoValido, type PeticionAcceso } from "./acceso";

const SECRETO = "x".repeat(32);
const base: PeticionAcceso = { pathname: "/", search: "", modo: "google", email: null, permitido: false, viaPuerta: true, hostLocal: true };

describe("modoAcceso", () => {
  it("falla cerrado si falta cualquier pieza de Google", () => {
    expect(modoAcceso({ CS_AUTH: "on" })).toBe("sin-configurar");
    expect(modoAcceso({ CS_AUTH: "on", AUTH_SECRET: SECRETO, AUTH_GOOGLE_ID: "id" })).toBe("sin-configurar");
    expect(modoAcceso({ CS_AUTH: "on", AUTH_SECRET: SECRETO, AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "s" })).toBe("google");
    expect(modoAcceso({ CS_AUTH: "off" })).toBe("abierto-local");
  });
});

describe("decidirAcceso", () => {
  it("sin configurar no sirve nada, ni la entrada", () => {
    expect(decidirAcceso({ ...base, modo: "sin-configurar", pathname: "/entrar" })).toMatchObject({ tipo: "error", status: 503 });
  });

  it("modo abierto solo en local: lo que llega por la puerta se rechaza", () => {
    expect(decidirAcceso({ ...base, modo: "abierto-local", viaPuerta: false })).toEqual({ tipo: "pasar" });
    expect(decidirAcceso({ ...base, modo: "abierto-local", viaPuerta: true, pathname: "/api/corridas" })).toMatchObject({ status: 503 });
    // Desde la LAN (Host = IP de la Mac) o por DNS rebinding (Host = dominio ajeno): no se sirve.
    expect(decidirAcceso({ ...base, modo: "abierto-local", viaPuerta: false, hostLocal: false })).toMatchObject({ status: 403 });
  });

  it("sin sesión: páginas → /entrar con destino; API → 401; rutas públicas pasan", () => {
    expect(decidirAcceso({ ...base, pathname: "/corridas", search: "?x=1" })).toEqual({ tipo: "redirigir", a: "/entrar?desde=%2Fcorridas%3Fx%3D1" });
    expect(decidirAcceso(base)).toEqual({ tipo: "redirigir", a: "/entrar" });
    expect(decidirAcceso({ ...base, pathname: "/api/corridas" })).toMatchObject({ status: 401 });
    for (const p of ["/entrar", "/entrar/sin-acceso", "/api/auth/callback/google", "/api/salud"]) {
      expect(decidirAcceso({ ...base, pathname: p })).toEqual({ tipo: "pasar" });
    }
  });

  it("con sesión pero fuera de la lista: 403 / sin-acceso; dentro: pasa", () => {
    expect(decidirAcceso({ ...base, email: "x@y.com", pathname: "/api/asistente" })).toMatchObject({ status: 403 });
    expect(decidirAcceso({ ...base, email: "x@y.com", pathname: "/corridas" })).toEqual({ tipo: "redirigir", a: "/entrar/sin-acceso" });
    expect(decidirAcceso({ ...base, email: "x@y.com", permitido: true, pathname: "/api/corridas" })).toEqual({ tipo: "pasar" });
  });

  it("/api/authX no es pública", () => {
    expect(decidirAcceso({ ...base, pathname: "/api/authx" })).toMatchObject({ status: 401 });
    expect(decidirAcceso({ ...base, pathname: "/entrarx" })).toMatchObject({ tipo: "redirigir" });
  });
});

describe("destinoSeguro", () => {
  it("solo rutas internas", () => {
    expect(destinoSeguro("/corridas?p=1")).toBe("/corridas?p=1");
    expect(destinoSeguro("//evil.com")).toBe("/");
    expect(destinoSeguro("https://evil.com")).toBe("/");
    expect(destinoSeguro("/\\evil.com")).toBe("/");
    expect(destinoSeguro(null)).toBe("/");
  });
});

describe("consulta interna entre Macs", () => {
  it("el secreto solo abre el estado de corridas", () => {
    expect(decidirAcceso({ ...base, interno: true, pathname: "/api/corridas/estado" })).toEqual({ tipo: "pasar" });
    expect(decidirAcceso({ ...base, interno: true, pathname: "/api/corridas" })).toMatchObject({ status: 401 });
    expect(decidirAcceso({ ...base, interno: true, pathname: "/" })).toMatchObject({ tipo: "redirigir" });
  });
  it("secretoValido exige coincidencia exacta y un secreto configurado", () => {
    const s = "a".repeat(40);
    expect(secretoValido(s, s)).toBe(true);
    expect(secretoValido("b".repeat(40), s)).toBe(false);
    expect(secretoValido(s.slice(1), s)).toBe(false);
    expect(secretoValido(null, s)).toBe(false);
    expect(secretoValido("", undefined)).toBe(false);
  });
});

describe("esHostLocal", () => {
  it("solo localhost, 127.0.0.1 y [::1], con o sin puerto", () => {
    for (const h of ["localhost:3040", "127.0.0.1:3040", "[::1]:3040", "LOCALHOST"]) expect(esHostLocal(h), h).toBe(true);
    for (const h of ["192.168.16.51:3040", "evil.com", "localhost.evil.com", "127.0.0.1.nip.io", null]) expect(esHostLocal(h), String(h)).toBe(false);
  });
});
