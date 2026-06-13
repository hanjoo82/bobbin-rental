import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import koreaGeo from "@/data/korea-provinces.json";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  color?: string;
  info?: string;
}

interface Hover {
  m: MapMarker;
  x: number;
  y: number;
}

export function KoreaMap({ markers, height = 600 }: { markers: MapMarker[]; height?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<Hover | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const { paths, project } = useMemo(() => {
    const projection = geoMercator().fitSize([width, height], koreaGeo as any);
    const pathGen = geoPath(projection);
    const features = (koreaGeo as any).features as any[];
    const paths = features.map((f, i) => ({ d: pathGen(f) || "", id: f.properties?.name ?? i }));
    const project = (lng: number, lat: number) => projection([lng, lat]) ?? [0, 0];
    return { paths, project };
  }, [width, height]);

  const points = useMemo(
    () =>
      markers
        .map((m) => {
          const [x, y] = project(m.lng, m.lat);
          return { m, x, y };
        })
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    [markers, project],
  );

  return (
    <div
      ref={wrapRef}
      className="relative w-full rounded-2xl border bg-gradient-to-br from-background via-background to-accent/40 overflow-hidden shadow-premium"
      style={{ height }}
    >
      {/* subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <svg width={width} height={height} className="block">
        <defs>
          <filter id="km-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="km-prov" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.97 0.015 277)" />
            <stop offset="100%" stopColor="oklch(0.94 0.02 260)" />
          </linearGradient>
        </defs>

        {/* provinces */}
        <g>
          {paths.map((p) => (
            <path
              key={p.id}
              d={p.d}
              fill="url(#km-prov)"
              stroke="oklch(0.85 0.02 260)"
              strokeWidth={0.6}
              strokeLinejoin="round"
            />
          ))}
        </g>

        {/* markers — outer pulse ring + solid dot */}
        <g>
          {points.map(({ m, x, y }) => {
            const c = m.color ?? "oklch(0.55 0.22 277)";
            return (
              <g
                key={m.id}
                transform={`translate(${x},${y})`}
                className="cursor-pointer"
                onMouseEnter={() => setHover({ m, x, y })}
                onMouseLeave={() => setHover((h) => (h?.m.id === m.id ? null : h))}
              >
                <circle r={10} fill={c} opacity={0.18} />
                <circle r={5.5} fill="white" />
                <circle r={4} fill={c} filter="url(#km-glow)" />
              </g>
            );
          })}
        </g>
      </svg>

      {/* tooltip */}
      {hover && (
        <div
          className="absolute pointer-events-none z-10 -translate-x-1/2 -translate-y-full"
          style={{ left: hover.x, top: hover.y - 14 }}
        >
          <div className="rounded-lg bg-foreground text-background text-xs px-3 py-2 shadow-lg whitespace-nowrap font-medium">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: hover.m.color ?? "white" }}
              />
              {hover.m.title}
            </div>
            {hover.m.info && (
              <div
                className="mt-1 opacity-75 font-normal"
                dangerouslySetInnerHTML={{ __html: hover.m.info }}
              />
            )}
          </div>
          <div
            className="mx-auto w-2 h-2 bg-foreground rotate-45 -mt-1"
            style={{ marginLeft: "calc(50% - 4px)" }}
          />
        </div>
      )}

      {/* corner label */}
      <div className="absolute top-4 left-4 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
        Korea · 보빈 분포
      </div>
    </div>
  );
}
