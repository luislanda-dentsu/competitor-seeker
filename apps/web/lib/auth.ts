// Auth.js (next-auth v5) con Google: Google dice QUIÉN eres; `usuarios.json` decide si entras.
// Sin alias `@/`: lo importa proxy.ts.
import { buscarUsuario, cargarEnv } from "@competitor-seeker/core";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const env = cargarEnv();
// URL canónica (la del Worker): el callback de Google y las cookies seguras salen de aquí.
if (env.AUTH_URL && !process.env.AUTH_URL) process.env.AUTH_URL = env.AUTH_URL;

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  providers:
    env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: env.AUTH_GOOGLE_ID,
            clientSecret: env.AUTH_GOOGLE_SECRET,
            // Solo identidad (nombre, foto, correo): ningún permiso sobre datos de Google.
            authorization: { params: { scope: "openid email profile", prompt: "select_account" } },
          }),
        ]
      : [],
  // JWT firmado con AUTH_SECRET (igual en las dos Macs): la sesión sobrevive al cambio de Mac.
  // 30 días de inactividad, como Orbit. La lista de acceso se revalida en cada petición (proxy.ts).
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  trustHost: true,
  pages: { signIn: "/entrar", error: "/entrar/sin-acceso" },
  callbacks: {
    signIn({ user, profile }) {
      if (profile && profile.email_verified === false) return false;
      return buscarUsuario(user.email) !== null;
    },
  },
});
