import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { listarObras, type Obra } from "@/services/obrasService";
import { Loader2, Map } from "lucide-react";

interface GeoObra extends Obra {
  lat: number;
  lng: number;
}

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      { headers: { "User-Agent": "PainelObras/1.0" } }
    );
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {
    // ignore
  }
  return null;
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
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

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

  // Load and geocode obras
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const allObras = await listarObras();
        const isUrl = (s: string) => /^https?:\/\//i.test((s || "").trim());

        // Para geocodificar, usamos somente texto válido (nunca URLs)
        const withLocation = allObras
          .map((o) => {
            const locTxt = isUrl(o.localizacao) ? "" : (o.localizacao || "").trim();
            const cidade = (o.cidade || "").trim();
            const query = [locTxt, cidade].filter(Boolean).join(", ");
            return { obra: o, query };
          })
          .filter((x) => x.query.length > 0);

        setProgress({ done: 0, total: withLocation.length });

        const geoObras: GeoObra[] = [];

        for (let i = 0; i < withLocation.length; i++) {
          if (cancelled) return;
          const { obra, query } = withLocation[i];
          let coords = await geocode(query);
          // fallback: tenta só pela cidade se a query completa falhou
          if (!coords && obra.cidade) {
            await new Promise((r) => setTimeout(r, 1100));
            coords = await geocode(obra.cidade);
          }
          if (coords) {
            geoObras.push({ ...obra, ...coords });
          }
          setProgress({ done: i + 1, total: withLocation.length });
          if (i < withLocation.length - 1) {
            await new Promise((r) => setTimeout(r, 1100));
          }
        }

        if (!cancelled) {
          setObras(geoObras);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Add markers to map when obras change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || obras.length === 0) return;

    const markers: L.Marker[] = [];

    obras.forEach((obra) => {
      const phone = obra.telefone?.replace(/\D/g, "") || "";
      const whatsappUrl = phone ? `https://wa.me/55${phone}` : "";
      const mapsQuery = [obra.localizacao, obra.cidade].filter(Boolean).join(", ");
      const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(mapsQuery)}`;

      const popupContent = `
        <div style="min-width:200px">
          <h3 style="font-weight:bold;font-size:14px;margin:0 0 4px">${obra.nome || "Sem nome"}</h3>
          <p style="font-size:12px;color:#888;margin:0">${obra.construtora || "—"}</p>
          <p style="font-size:12px;margin:4px 0">${[obra.localizacao, obra.cidade].filter(Boolean).join(", ")}</p>
          ${obra.statusProspeccao ? `<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:#dbeafe;color:#1e40af">${obra.statusProspeccao}</span>` : ""}
          <div style="display:flex;gap:8px;margin-top:8px">
            <a href="${mapsUrl}" target="_blank" style="font-size:12px;color:#2563eb">📍 Maps</a>
            ${whatsappUrl ? `<a href="${whatsappUrl}" target="_blank" style="font-size:12px;color:#16a34a">💬 WhatsApp</a>` : ""}
            <a href="/nova-obra?id=${obra.id}" style="font-size:12px;color:#9333ea">📋 Detalhes</a>
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

    const bounds = L.latLngBounds(obras.map((o) => [o.lat, o.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [50, 50] });

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [obras]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Mapa de Obras
        </h1>
        <p className="text-muted-foreground mt-1">
          Visualize todas as obras cadastradas no mapa
          {loading && progress.total > 0 && (
            <span className="ml-2 text-sm">
              — Geocodificando {progress.done}/{progress.total}...
            </span>
          )}
        </p>
      </div>

      <div className="relative rounded-lg overflow-hidden border border-border" style={{ height: "calc(100vh - 220px)" }}>
        {loading && progress.done === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-[1000]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />

        {!loading && obras.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-[1000]">
            <div className="text-center space-y-2">
              <Map className="h-12 w-12 text-muted-foreground/50 mx-auto" />
              <p className="text-muted-foreground">Nenhuma obra com localização encontrada</p>
              <p className="text-sm text-muted-foreground/70">Preencha os campos Cidade e Localização nas obras</p>
            </div>
          </div>
        )}
      </div>

      {!loading && obras.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {obras.length} obra(s) exibida(s) no mapa • Marcadores coloridos por status
        </p>
      )}
    </div>
  );
}
