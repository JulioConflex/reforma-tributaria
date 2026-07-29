"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type Papel = "basico" | "completo" | "master";

const TODOS_MODULOS = ["tributos", "markup", "comparador", "split_payment"];

interface AuthCtx {
  user: User | null;
  papel: Papel | null;
  modulos: string[];
  carregando: boolean;
  sair: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  papel: null,
  modulos: [],
  carregando: true,
  sair: async () => {},
});

export function useAuth() {
  return useContext(Ctx);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [papel, setPapel] = useState<Papel | null>(null);
  const [modulos, setModulos] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let ativo = true;

    async function carregar(u: User | null) {
      if (!ativo) return;
      setUser(u);
      if (u) {
        const { data } = await supabase
          .from("profiles")
          .select("papel")
          .eq("id", u.id)
          .single();
        const p = (data?.papel as Papel) ?? "basico";
        if (ativo) setPapel(p);

        if (p === "master") {
          if (ativo) setModulos(TODOS_MODULOS);
        } else {
          const { data: perms } = await supabase
            .from("profile_permissions")
            .select("modulo, permitido")
            .eq("papel", p);
          if (ativo) {
            const permitidos = (perms ?? [])
              .filter((r: { modulo: string; permitido: boolean }) => r.permitido)
              .map((r: { modulo: string; permitido: boolean }) => r.modulo);
            setModulos(permitidos);
          }
        }
      } else {
        setPapel(null);
        setModulos([]);
      }
      if (ativo) setCarregando(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, session) => {
      carregar(session?.user ?? null);
    });

    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const sair = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <Ctx.Provider value={{ user, papel, modulos, carregando, sair }}>{children}</Ctx.Provider>
  );
}
