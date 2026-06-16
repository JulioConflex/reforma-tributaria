import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Libera o acesso de outros computadores da rede local ao servidor de
  // desenvolvimento (Next 16 bloqueia origens != localhost por padrão).
  allowedDevOrigins: ["192.168.25.19", "192.168.25.*", "192.168.*.*"],

  // Roteia as chamadas do front (/api/py/*) para o backend FastAPI:
  //  - em desenvolvimento: o uvicorn local na porta 8000;
  //  - em produção (Vercel): a função serverless Python (api/index.py).
  async rewrites() {
    return [
      {
        source: "/api/py/:path*",
        destination: isDev
          ? "http://127.0.0.1:8000/api/py/:path*"
          : "/api/",
      },
    ];
  },
};

export default nextConfig;
