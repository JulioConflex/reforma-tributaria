"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Papel = "normal" | "master";

interface AuthCtx {
  user: User | null;
  papel: Papel | null;
  carregando: boolean;
  sair: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  papel: null,
  carregando: true,
  sair: async () => {},
});

export function useAuth() {
  return useContext(Ctx);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [papel, setPapel] = useState<Papel | null>(null);
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
        if (ativo) setPapel(((data?.papel as Papel) ?? "normal"));
      } else {
        setPapel(null);
      }
      if (ativo) setCarregando(false);
    }

    // onAuthStateChange dispara imediatamente com a sessão atual (INITIAL_SESSION).
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
    <Ctx.Provider value={{ user, papel, carregando, sair }}>{children}</Ctx.Provider>
  );
}
