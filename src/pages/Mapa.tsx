import { useEffect, useState, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { listarObras, type Obra } from "@/services/obrasService";
import { supabase } from "@/integrations/supabase/client";
import { normalizeText } from "@/lib/normalize";
import { Loader2, MapPin, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

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

// Distingue "não encontrado" (resposta vazia -> pode persistir not_found) de erro de
// requisição (rede/HTTP -> NÃO persiste nada; será tentado de novo no próximo acesso).
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

// Mesma regra do backend (_shared/geocode.ts): localizacao só quando é texto, nunca URL.
function buildQuery(obra: Obra): string {
  const locTxt = isUrl(obra.localizacao) ? "" : (obra.localizacao || "").trim();
  const cidade = (obra.cidade || "").trim();
  return [locTxt, cidade].filter(Boolean).join(", ");
}

function statusColor(status: string): string {
  const s = (status || "").toLowerCase();
  if (s.includes("ganho") || s.includes("fechado")) return "hsl(142, 76%, 36%)";
  if (s.includes("perdido")) return "hsl(0, 84%, 60%)";
  if (s.includes("negociação") || s.includes("negociacao")) return "hsl(45, 93%, 47%)";
  return "hsl(221, 83%, 53%)";
}

function createColorIcon(color: string) {
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

export default function Mapa() {
  const [obras, setObras] = useState<GeoObra[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const cancelRef = useRef(false);

  // Initialize map once
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

    // Limpeza única do cache antigo da Fase 1 (substituído pela tabela do Supabase)
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
          // sem registro, endereço mudou, ou usuário pediu para reprocessar falhas
          pending.push({ obra, query });
        }
      }

      // Plota imediatamente tudo que já tem coordenada válida
      setObras(ready);
      setLoading(false);

      if (pending.length === 0) return;

      // Backfill: geocodifica as pendentes em sequência e persiste no Supabase
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
            } catch { /* tabela ausente ou erro de rede: segue sem persistir */ }
          }
        } else if (result.status === "not_found" && obra.id) {
          try {
            await supabase.from("obras_coordenadas").upsert(
              { obra_id: obra.id, query_normalizada: queryNorm, lat: null, lng: null, not_found: true },
              { onConflict: "obra_id" }
            );
          } catch { /* ignore */ }
        }
        // status === "error": não persiste nada — tenta de novo no próximo carregamento

        setProgress({ done: i + 1, total: pending.length });
        if (i < pending.length - 1) {
          await new Promise((r) => setTimeout(r, 1100));
        }
      }
    } catch {
      // listarObras falhou — mantém estado vazio
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

  // Add markers to map when obras change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || obras.length === 0) return;

    const markers: L.Marker[] = [];

    obras.forEach((obra) => {
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

      const popupContent = `
        <div style="min-width:200px">
          <h3 style="font-weight:bold;font-size:14px;margin:0 0 4px">${obra.nome || "Sem nome"}</h3>
          <p style="font-size:12px;color:#888;margin:0">${obra.construtora || "—"}</p>
          <p style="font-size:12px;margin:4px 0">${[locIsUrl ? "" : locRaw, obra.cidade].filter(Boolean).join(", ")}</p>
          ${obra.statusProspeccao ? `<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:#dbeafe;color:#1e40af">${obra.statusProspeccao}</span>` : ""}
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
            ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:#2563eb">📍 Maps</a>` : ""}
            ${whatsappUrl ? `<a href="${whatsappUrl}" target="_blank" style="font-size:12px;color:#16a34a">💬 WhatsApp</a>` : ""}
            <a href="/atividades/${obra.id}" style="font-size:12px;color:#9333ea">📋 Detalhes</a>
          </div>
        </div>
      `;

      const marker = L.marker([obra.lat, obra.lng], {
        icon: createColorIcon(statusColor(obra.statusProspeccao)),
      })
        .bindPopup(popupContent)
        .addTo(map);

      markers.push(marker);
    });

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [obras]);

  // Ajusta o enquadramento após o lote inicial e novamente ao fim do backfill
  // (evita o mapa "pular" a cada novo marcador durante a geocodificação)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || obras.length === 0 || loading || geocoding) return;
    const bounds = L.latLngBounds(obras.map((o) => [o.lat, o.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [obras, loading, geocoding]);

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
            Visualize todas as obras cadastradas no mapa
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
            Geocodificando {progress.done} de {progress.total} obra(s) nova(s)... As demais já estão no mapa.
          </p>
        </div>
      )}

      <div className="relative rounded-lg overflow-hidden border border-border" style={{ height: "calc(100vh - 220px)" }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-[1000]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />

        {!loading && !geocoding && obras.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-[1000]">
            <div className="text-center space-y-2">
              <MapPin className="h-12 w-12 text-muted-foreground/50 mx-auto" />
              <p className="text-muted-foreground">Nenhuma obra com localização encontrada</p>
              <p className="text-sm text-muted-foreground/70">Preencha os campos Cidade e Localização nas obras</p>
            </div>
          </div>
        )}
      </div>

      {!loading && !geocoding && obras.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {obras.length} obra(s) exibida(s) no mapa • Marcadores coloridos por status
        </p>
      )}
    </div>
  );
}
