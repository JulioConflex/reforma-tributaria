"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface ConfigOverrides {
  cronograma: Record<string, Record<string, unknown>>;
  setores: Record<string, Record<string, unknown>>;
  estados: Record<string, number>;
}

const empty: ConfigOverrides = { cronograma: {}, setores: {}, estados: {} };
const Ctx = createContext<ConfigOverrides>(empty);

export function ConfigOverridesProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<ConfigOverrides>(empty);

  useEffect(() => {
    fetch("/api/configuracoes/ativas")
      .then((r) => (r.ok ? r.json() : empty))
      .then((d) => setOverrides(d))
      .catch(() => {});
  }, []);

  return <Ctx.Provider value={overrides}>{children}</Ctx.Provider>;
}

export function useConfigOverrides(): ConfigOverrides {
  return useContext(Ctx);
}
