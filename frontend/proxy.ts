import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (no Next.js 16, o antigo "middleware"): roda antes de cada requisição.
 * Faz duas coisas:
 *   1. Refresca a sessão do Supabase (renova o token nos cookies).
 *   2. Protege o site inteiro: sem login, redireciona para /login.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim().replace(/\/+$/, ""),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: getUser() valida o token e refresca a sessão.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path === "/login";
  const isTrocarSenha = path === "/trocar-senha";

  // Sem usuário e fora da tela de login → manda para o login.
  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Logado, mas ainda não trocou a senha inicial → obriga a trocar antes de usar.
  if (user && user.user_metadata?.senha_trocada === false && !isTrocarSenha) {
    const url = request.nextUrl.clone();
    url.pathname = "/trocar-senha";
    return NextResponse.redirect(url);
  }

  // Já logado e tentando ver o login → manda para o início.
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Roda em todas as rotas, EXCETO a API (FastAPI em /api), assets do Next e
  // arquivos estáticos (imagens, fontes, css/js). Os .html do guia continuam protegidos.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf)$).*)",
  ],
};
