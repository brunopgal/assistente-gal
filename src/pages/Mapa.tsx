import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { listarObras, type Obra } from "@/services/obrasService";
import { supabase } from "@/integrations/supabase/client";
import { normalizeText } from "@/lib/normalize";
import { Loader2, MapPin, RefreshCw, Navigation, X, Sparkles, ExternalLink } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface GeoObra extends Obra {
  lat: number;
  lng: number;
}

interface CoordRow {
  obra_id: string;
  query_normalizada: string;
  lat: number | null;
  lng: number | null;
  not_found: boolean;
}

type GeocodeResult =
  | { status: "ok"; lat: number; lng: number }
  | { status: "not_found" }
  | { status: "error" };

async function geocode(query: string): Promise<GeocodeResult> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
    );
    if (!res.ok) return { status: "error" };
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { status: "ok", lat, lng };
    }
    return { status: "not_found" };
  } catch {
    return { status: "error" };
  }
}

const isUrl = (s: string) => /^https?:\/\//i.test((s || "").trim());

export function cleanEnderecoParaGeocode(loc: string): string {
  if (!loc) return "";
  
  // corta tudo a partir do primeiro " - " (descarta bairro/CEP)
  let clean = loc.split(" - ")[0];
  
  // remove "CEP 00000-000", "nº"/"n°", "s/nº"
  clean = clean.replace(/cep\s*:?\s*\d{5}-?\d{3}/gi, "");
  clean = clean.replace(/\b\d{5}-?\d{3}\b/g, "");
  clean = clean.replace(/\bcep\b/gi, "");
  clean = clean.replace(/s\/n[º°]?/gi, "");
  clean = clean.replace(/n[º°]/gi, "");
  
  // normaliza espaços e vírgulas
  clean = clean.replace(/,+/g, ",");
  clean = clean.replace(/\s*,\s*/g, ", ");
  clean = clean.replace(/\s+/g, " ");
  
  // remove vírgulas ou espaços no início e fim
  clean = clean.trim()
    .replace(/^,+/, "")
    .replace(/,+$/, "")
    .trim();
    
  return clean;
}

function buildQuery(obra: Obra): string {
  const locTxt = isUrl(obra.localizacao) ? "" : (obra.localizacao || "").trim();
  const logradouro = cleanEnderecoParaGeocode(locTxt);
  const cidade = (obra.cidade || "").trim();
  
  if (!logradouro && !cidade) {
    return "";
  }
  
  return [logradouro, cidade, "Brasil"].filter(Boolean).join(", ");
}

function statusColor(status: string): string {
  const s = (status || "").toLowerCase();
  if (s.includes("ganho") || s.includes("fechado")) return "hsl(142, 76%, 36%)";
  if (s.includes("perdido")) return "hsl(0, 84%, 60%)";
  if (s.includes("negociação") || s.includes("negociacao")) return "hsl(45, 93%, 47%)";
  return "hsl(221, 83%, 53%)";
}

function createColorIcon(color: string, orderNumber?: number) {
  if (orderNumber) {
    return L.divIcon({
      className: "custom-marker",
      html: `<div style="
        background-color: hsl(142, 76%, 36%);
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        display:flex;align-items:center;justify-content:center;
        font-weight:bold;font-size:14px;font-family:sans-serif;
      ">${orderNumber}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });
  }
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
}

// Haversine distance (km)
function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const TODOS = "__todos__";

export default function Mapa() {
  const [obras, setObras] = useState<GeoObra[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const cancelRef = useRef(false);

  const [filterCidade, setFilterCidade] = useState<string>(TODOS);
  const [filterStatus, setFilterStatus] = useState<string>(TODOS);
  const [filterProduto, setFilterProduto] = useState<string>(TODOS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [otimizando, setOtimizando] = useState(false);


  // expose toggle to popup buttons
  useEffect(() => {
    (window as any).__toggleRotaObra = (id: string) => {
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };
    return () => {
      delete (window as any).__toggleRotaObra;
    };
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    mapRef.current = L.map(mapContainerRef.current).setView([-22.7288, -47.009], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const carregar = useCallback(async (refreshNotFound: boolean) => {
    setLoading(true);
    setObras([]);
    setProgress({ done: 0, total: 0 });
    try { localStorage.removeItem("obras-geocode-cache"); } catch { /* ignore */ }

    try {
      const [allObras, coordsRes] = await Promise.all([
        listarObras(),
        supabase.from("obras_coordenadas").select("*"),
      ]);

      const coordsByObra = new Map<string, CoordRow>();
      if (!coordsRes.error && coordsRes.data) {
        for (const row of coordsRes.data as CoordRow[]) coordsByObra.set(row.obra_id, row);
      }

      const ready: GeoObra[] = [];
      const pending: { obra: Obra; query: string }[] = [];

      for (const obra of allObras) {
        const query = buildQuery(obra);
        if (!query) continue;
        const queryNorm = normalizeText(query);
        const row = obra.id ? coordsByObra.get(obra.id) : undefined;

        const isValid = !!row && !row.not_found && row.lat != null && row.lng != null
          && row.query_normalizada === queryNorm;
        const isKnownNotFound = !!row && row.not_found && row.query_normalizada === queryNorm;

        if (isValid) {
          ready.push({ ...obra, lat: row!.lat as number, lng: row!.lng as number });
        } else if (!isKnownNotFound || refreshNotFound) {
          pending.push({ obra, query });
        }
      }

      setObras(ready);
      setLoading(false);

      if (pending.length === 0) return;

      setGeocoding(true);
      setProgress({ done: 0, total: pending.length });

      for (let i = 0; i < pending.length; i++) {
        if (cancelRef.current) return;
        const { obra, query } = pending[i];
        const queryNorm = normalizeText(query);

        let result = await geocode(query);
        if (result.status === "not_found" && (obra.cidade || "").trim()) {
          await new Promise((r) => setTimeout(r, 1100));
          if (cancelRef.current) return;
          result = await geocode((obra.cidade || "").trim());
        }

        if (result.status === "ok") {
          const { lat, lng } = result;
          setObras((prev) => [...prev, { ...obra, lat, lng }]);
          if (obra.id) {
            try {
              await supabase.from("obras_coordenadas").upsert(
                { obra_id: obra.id, query_normalizada: queryNorm, lat, lng, not_found: false },
                { onConflict: "obra_id" }
              );
            } catch { /* ignore */ }
          }
        } else if (result.status === "not_found" && obra.id) {
          try {
            await supabase.from("obras_coordenadas").upsert(
              { obra_id: obra.id, query_normalizada: queryNorm, lat: null, lng: null, not_found: true },
              { onConflict: "obra_id" }
            );
          } catch { /* ignore */ }
        }

        setProgress({ done: i + 1, total: pending.length });
        if (i < pending.length - 1) {
          await new Promise((r) => setTimeout(r, 1100));
        }
      }
    } catch {
      // ignore
    } finally {
      if (!cancelRef.current) {
        setLoading(false);
        setGeocoding(false);
      }
    }
  }, []);

  useEffect(() => {
    cancelRef.current = false;
    carregar(false);
    return () => { cancelRef.current = true; };
  }, [carregar]);

  // distinct filter options
  const { cidades, statuses, produtos } = useMemo(() => {
    const c = new Set<string>();
    const s = new Set<string>();
    const p = new Set<string>();
    for (const o of obras) {
      if (o.cidade) c.add(o.cidade.trim());
      if (o.statusProspeccao) s.add(o.statusProspeccao.trim());
      if (o.produtoOferecido) {
        for (const pr of o.produtoOferecido.split(",")) {
          const t = pr.trim();
          if (t) p.add(t);
        }
      }
    }
    return {
      cidades: [...c].sort(),
      statuses: [...s].sort(),
      produtos: [...p].sort(),
    };
  }, [obras]);

  const filteredObras = useMemo(() => {
    return obras.filter((o) => {
      if (filterCidade !== TODOS && (o.cidade || "").trim() !== filterCidade) return false;
      if (filterStatus !== TODOS && (o.statusProspeccao || "").trim() !== filterStatus) return false;
      if (filterProduto !== TODOS) {
        const list = (o.produtoOferecido || "").split(",").map((x) => x.trim());
        if (!list.includes(filterProduto)) return false;
      }
      return true;
    });
  }, [obras, filterCidade, filterStatus, filterProduto]);

  // markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers: L.Marker[] = [];

    filteredObras.forEach((obra) => {
      const id = obra.id || "";
      const orderIdx = selectedIds.indexOf(id);
      const isSelected = orderIdx >= 0;

      const phone = obra.telefone?.replace(/\D/g, "") || "";
      const whatsappUrl = phone ? `https://wa.me/55${phone}` : "";
      const locRaw = (obra.localizacao || "").trim();
      const locIsUrl = isUrl(locRaw);
      const mapsQuery = [locRaw, obra.cidade].filter(Boolean).join(", ");
      const mapsUrl = locIsUrl
        ? locRaw
        : mapsQuery
          ? `https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}`
          : "";

      const safeId = id.replace(/'/g, "\\'");
      const btnLabel = isSelected ? `✓ Na rota (#${orderIdx + 1}) — remover` : "➕ Adicionar à rota";
      const btnStyle = isSelected
        ? "background:#16a34a;color:white"
        : "background:#2563eb;color:white";

      const popupContent = `
        <div style="min-width:220px">
          <h3 style="font-weight:bold;font-size:14px;margin:0 0 4px">${obra.nome || "Sem nome"}</h3>
          <p style="font-size:12px;color:#888;margin:0">${obra.construtora || "—"}</p>
          <p style="font-size:12px;margin:4px 0">${[locIsUrl ? "" : locRaw, obra.cidade].filter(Boolean).join(", ")}</p>
          <div style="font-size:11px;margin:4px 0;display:flex;flex-wrap:wrap;gap:4px">
            ${obra.estagioObra ? `<span style="padding:2px 6px;border-radius:8px;background:#f3f4f6;color:#374151">Estágio: ${obra.estagioObra}</span>` : ""}
            ${obra.produtoOferecido ? `<span style="padding:2px 6px;border-radius:8px;background:#fef3c7;color:#92400e">${obra.produtoOferecido}</span>` : ""}
            ${obra.statusProspeccao ? `<span style="padding:2px 6px;border-radius:8px;background:#dbeafe;color:#1e40af">${obra.statusProspeccao}</span>` : ""}
          </div>
          ${id ? `<button onclick="window.__toggleRotaObra && window.__toggleRotaObra('${safeId}')" style="margin-top:6px;width:100%;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;${btnStyle}">${btnLabel}</button>` : ""}
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
            ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:#2563eb">📍 Maps</a>` : ""}
            ${whatsappUrl ? `<a href="${whatsappUrl}" target="_blank" style="font-size:12px;color:#16a34a">💬 WhatsApp</a>` : ""}
            ${id ? `<a href="/atividades/${id}" style="font-size:12px;color:#9333ea">📋 Detalhes</a>` : ""}
          </div>
        </div>
      `;

      const marker = L.marker([obra.lat, obra.lng], {
        icon: isSelected
          ? createColorIcon("", orderIdx + 1)
          : createColorIcon(statusColor(obra.statusProspeccao)),
      })
        .bindPopup(popupContent)
        .addTo(map);

      markers.push(marker);
    });

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [filteredObras, selectedIds]);

  // fit bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map || filteredObras.length === 0 || loading || geocoding) return;
    const bounds = L.latLngBounds(filteredObras.map((o) => [o.lat, o.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [filteredObras, loading, geocoding]);

  const selectedObras = useMemo(() => {
    const byId = new Map(obras.map((o) => [o.id || "", o]));
    return selectedIds.map((id) => byId.get(id)).filter(Boolean) as GeoObra[];
  }, [obras, selectedIds]);

  const pedirLocalizacao = (): Promise<{ lat: number; lng: number } | null> =>
    new Promise((resolve) => {
      if (!("geolocation" in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
      );
    });

  const otimizarOrdem = async () => {
    if (selectedObras.length < 2) return;
    setOtimizando(true);
    try {
      const loc = userLoc ?? (await pedirLocalizacao());
      if (loc) setUserLoc(loc);
      const start = loc ?? { lat: selectedObras[0].lat, lng: selectedObras[0].lng };
      const remaining = [...selectedObras];
      const ordered: GeoObra[] = [];
      let cursor = start;
      while (remaining.length > 0) {
        let bestIdx = 0;
        let bestDist = Infinity;
        remaining.forEach((o, i) => {
          const d = distKm(cursor, o);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        });
        const next = remaining.splice(bestIdx, 1)[0];
        ordered.push(next);
        cursor = next;
      }
      setSelectedIds(ordered.map((o) => o.id || ""));
    } finally {
      setOtimizando(false);
    }
  };

  const abrirRota = () => {
    if (selectedObras.length === 0) return;
    const coords = selectedObras.map((o) => `${o.lat},${o.lng}`);
    const destination = coords[coords.length - 1];
    const waypoints = coords.slice(0, -1).join("|");
    const origin = userLoc ? `&origin=${encodeURIComponent(`${userLoc.lat},${userLoc.lng}`)}` : "";
    const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${encodeURIComponent(destination)}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}&travelmode=driving`;
    window.open(url, "_blank", "noopener,noreferrer");
  };


  const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            <MapPin className="h-6 w-6 text-[#EA4335] fill-[#EA4335]" />
            Maps de Obras
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize obras e monte rotas de visita
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => carregar(true)}
          disabled={loading || geocoding}
          title="Re-geocodifica apenas os endereços que falharam ou mudaram"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${geocoding ? "animate-spin" : ""}`} />
          Atualizar Coordenadas
        </Button>
      </div>

      {geocoding && progress.total > 0 && (
        <div className="space-y-1">
          <Progress value={progressPct} />
          <p className="text-xs text-muted-foreground">
            Geocodificando {progress.done} de {progress.total} obra(s) nova(s)...
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="relative rounded-lg overflow-hidden border border-border" style={{ height: "calc(100vh - 260px)", minHeight: 400 }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-[1000]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />

          {/* Filtros sobrepostos ao mapa */}
          <div className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-[640px] z-[1000] pointer-events-none">
            <div className="pointer-events-auto rounded-lg border border-border bg-card/95 backdrop-blur p-2 shadow-lg grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={filterCidade} onValueChange={setFilterCidade}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Cidade" /></SelectTrigger>
                <SelectContent className="z-[1500]">
                  <SelectItem value={TODOS}>Todas as cidades</SelectItem>
                  {cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent className="z-[1500]">
                  <SelectItem value={TODOS}>Todos os status</SelectItem>
                  {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterProduto} onValueChange={setFilterProduto}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Produto" /></SelectTrigger>
                <SelectContent className="z-[1500]">
                  <SelectItem value={TODOS}>Todos os produtos</SelectItem>
                  {produtos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!loading && !geocoding && filteredObras.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-[900] pointer-events-none">
              <div className="text-center space-y-2">
                <MapPin className="h-12 w-12 text-muted-foreground/50 mx-auto" />
                <p className="text-muted-foreground">Nenhuma obra com localização para os filtros atuais</p>
              </div>
            </div>
          )}
        </div>

        {/* Painel de rota */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3 flex flex-col" style={{ maxHeight: "calc(100vh - 260px)", minHeight: 400 }}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Navigation className="h-4 w-4" />
              Rota de visita
            </h2>
            <Badge variant="secondary">{selectedObras.length}</Badge>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="default" className="flex-1" onClick={abrirRota} disabled={selectedObras.length === 0}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Abrir no Maps
            </Button>
            <Button size="sm" variant="outline" onClick={otimizarOrdem} disabled={selectedObras.length < 2 || otimizando} title="Ordena pela sua localização atual">
              {otimizando ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Otimizar
            </Button>
          </div>


          {selectedObras.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])} className="text-xs">
              Limpar seleção
            </Button>
          )}

          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {selectedObras.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Clique nos pinos do mapa e use o botão "Adicionar à rota" para montar sua sequência de visitas.
              </p>
            ) : (
              <>
                {userLoc && (
                  <div className="flex items-start gap-2 p-2 rounded border border-dashed border-primary/40 bg-primary/5">
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                      <Navigation className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">Sua localização</p>
                      <p className="text-[10px] text-muted-foreground">Ponto de partida</p>
                    </div>
                  </div>
                )}
                {selectedObras.map((o, i) => (
                  <div key={o.id} className="flex items-start gap-2 p-2 rounded border border-border bg-background">
                    <div className="h-6 w-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{o.nome || "Sem nome"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{o.cidade}</p>
                    </div>
                    <button
                      onClick={() => setSelectedIds((prev) => prev.filter((id) => id !== o.id))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remover"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>

        </div>
      </div>

      {!loading && !geocoding && filteredObras.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {filteredObras.length} de {obras.length} obra(s) exibida(s) • Pinos verdes numerados são da sua rota
        </p>
      )}
    </div>
  );
}
