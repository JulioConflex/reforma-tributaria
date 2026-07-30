import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Simulador from "./components/Simulador";
import { ConfigOverridesProvider } from "./components/ConfigOverridesContext";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <ConfigOverridesProvider>
      <Simulador />
    </ConfigOverridesProvider>
  );
}
