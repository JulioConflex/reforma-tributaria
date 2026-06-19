"use client";

import { useEffect, useRef, useState, type ReactNode, type InputHTMLAttributes } from "react";

/* ── Format helpers ─────────────────────────────────────────────── */
export const brl = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
export const brlInt = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/* Converte texto no formato BR ("10.000,00") para número (10000). */
export function parseBRL(s: string): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

/* ── Conflex C mark (inline SVG for small uses) ────────────────── */
export function ConflexMark({ size = 28, color = "#01D1FF", className = "" }: { size?: number; color?: string; className?: string; }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" className={className} aria-hidden="true">
      <path d="M34 10 A17 17 0 1 0 34 38" stroke={color} strokeWidth="5.5" strokeLinecap="round" />
      <path d="M29 17 A8.5 8.5 0 1 0 29 31" stroke={color} strokeWidth="3.8" strokeLinecap="round" />
    </svg>
  );
}

/* ── Field label ────────────────────────────────────────────────── */
export function FieldLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <label className={`block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500 mb-1.5 ${className}`}>
      {children}
    </label>
  );
}

/* ── Text input with optional prefix/suffix ────────────────────── */
interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "prefix"> {
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
}
export function TextField({ value, onChange, prefix, suffix, type = "text", ...rest }: TextFieldProps) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm font-medium pointer-events-none">{prefix}</span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg bg-white text-ink-900 text-[15px] font-medium tab-num
                    py-2.5 ${prefix ? "pl-9" : "pl-3.5"} ${suffix ? "pr-9" : "pr-3.5"}
                    hairline-strong focus:outline-none focus:ring-2 focus:ring-brand-400/40
                    focus:shadow-[0_0_0_1px_rgba(1,209,255,.6)_inset] transition`}
        {...rest}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm font-medium pointer-events-none">{suffix}</span>
      )}
    </div>
  );
}

/* ── Currency input — exibe e edita no formato 10.000,00 ────────── */
export function CurrencyField({
  value, onChange, placeholder = "0,00",
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  function aoDigitar(raw: string) {
    let s = raw.replace(/[^\d,]/g, "");
    const i = s.indexOf(",");
    if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, "").slice(0, 2);
    const [intRaw, decRaw] = s.split(",");
    const intClean = (intRaw || "").replace(/^0+(?=\d)/, "");
    const intFmt = intClean ? Number(intClean).toLocaleString("pt-BR") : (s.startsWith(",") ? "0" : "");
    onChange(decRaw !== undefined ? `${intFmt || "0"},${decRaw}` : intFmt);
  }
  function aoSair() {
    if (!value) return;
    onChange(parseBRL(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm font-medium pointer-events-none">R$</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => aoDigitar(e.target.value)}
        onBlur={aoSair}
        placeholder={placeholder}
        className="w-full rounded-lg bg-white text-ink-900 text-[15px] font-medium tab-num
                   py-2.5 pl-9 pr-3.5 hairline-strong focus:outline-none focus:ring-2 focus:ring-brand-400/40
                   focus:shadow-[0_0_0_1px_rgba(1,209,255,.6)_inset] transition"
      />
    </div>
  );
}

/* ── Select ─────────────────────────────────────────────────────── */
export function SelectField({
  value, onChange, children,
}: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="field w-full rounded-lg bg-white text-ink-900 text-[15px] font-medium
                 py-2.5 pl-3.5 hairline-strong focus:outline-none focus:ring-2 focus:ring-brand-400/40 transition"
    >
      {children}
    </select>
  );
}

/* ── Number ticker (animates to new value) ─────────────────────── */
export function NumberTicker({
  value, formatter = brl, durationMs = 350,
}: { value: number; formatter?: (n: number) => string; durationMs?: number }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef<number>(0);

  useEffect(() => {
    fromRef.current = shown;
    startRef.current = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - startRef.current) / durationMs);
      const ease = 1 - Math.pow(1 - k, 3);
      setShown(fromRef.current + (value - fromRef.current) * ease);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className="tab-num">{formatter(shown)}</span>;
}

/* ── Sparkline (year x carga tributária) ───────────────────────── */
interface SparklineDatum { ano: number; percentual_sobre_valor: number; }
export function Sparkline({
  data, currentAno, w = 280, h = 60, stroke = "#01D1FF", area = true,
}: { data: SparklineDatum[]; currentAno: number; w?: number; h?: number; stroke?: string; area?: boolean }) {
  if (!data?.length) return null;
  const xs = data.map((d) => d.ano);
  const ys = data.map((d) => d.percentual_sobre_valor);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys) - 0.5;
  const yMax = Math.max(...ys) + 0.5;
  const padX = 8, padY = 8;
  const sx = (x: number) => padX + ((x - xMin) / (xMax - xMin || 1)) * (w - padX * 2);
  const sy = (y: number) => padY + (1 - (y - yMin) / (yMax - yMin || 1)) * (h - padY * 2);

  const pts = data.map((d) => [sx(d.ano), sy(d.percentual_sobre_valor)] as const);
  const linePath = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const areaPath = linePath + ` L ${pts[pts.length - 1][0]},${h - padY} L ${pts[0][0]},${h - padY} Z`;

  const cur = data.find((d) => d.ano === currentAno);
  const curPt = cur ? ([sx(cur.ano), sy(cur.percentual_sobre_valor)] as const) : null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto block" preserveAspectRatio="none">
      {area && (
        <>
          <defs>
            <linearGradient id="spark-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#spark-area)" />
        </>
      )}
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2" fill={stroke} opacity="0.5" />
      ))}
      {curPt && (
        <>
          <circle cx={curPt[0]} cy={curPt[1]} r="6" fill="#fff" stroke={stroke} strokeWidth="2" />
          <circle cx={curPt[0]} cy={curPt[1]} r="2.5" fill={stroke} />
        </>
      )}
    </svg>
  );
}

/* ── Horizontal value bar ─────────────────────────────────────── */
export function ValueBar({
  value, max, color = "#01D1FF", trackColor = "#EEF2F8",
}: { value: number; max: number; color?: string; trackColor?: string }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: trackColor }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

/* ── Chip (for dark hero meta row) ──────────────────────────────── */
export function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-ink-200 font-medium">
      <span className="text-ink-400">{label}</span>
      <span className="text-white capitalize">{value}</span>
    </span>
  );
}
