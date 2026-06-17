import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminPanel from "../components/AdminPanel";

/**
 * Página de administração — protegida no servidor: só usuários "master" entram.
 */
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("papel")
    .eq("id", user.id)
    .single();

  if (perfil?.papel !== "master") redirect("/");

  return <AdminPanel meId={user.id} meEmail={user.email ?? ""} />;
}
