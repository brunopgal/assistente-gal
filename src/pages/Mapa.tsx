import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { listarObras, type Obra } from "@/services/obrasService";
import { Loader2, Map, ExternalLink, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Fix leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

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
    // ignore geocoding errors
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
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const allObras = await listarObras();
        const withLocation = allObras.filter(
          (o) => o.cidade || o.localizacao
        );
        setProgress({ done: 0, total: withLocation.length });

        const geoObras: GeoObra[] = [];

        for (let i = 0; i < withLocation.length; i++) {
          if (cancelled) return;
          const o = withLocation[i];
          const query = [o.localizacao, o.cidade].filter(Boolean).join(", ");
          const coords = await geocode(query);
          if (coords) {
            geoObras.push({ ...o, ...coords });
          }
          setProgress({ done: i + 1, total: withLocation.length });
          // Rate limit nominatim (1 req/sec)
          if (i < withLocation.length - 1) {
            await new Promise((r) => setTimeout(r, 1100));
          }
        }

        if (!cancelled) {
          setObras(geoObras);
          setLoading(false);

          // Fit bounds
          if (geoObras.length > 0 && mapRef.current) {
            const bounds = L.latLngBounds(
              geoObras.map((o) => [o.lat, o.lng])
            );
            mapRef.current.fitBounds(bounds, { padding: [50, 50] });
          }
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

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

        <MapContainer
          center={[-22.7288, -47.009]}
          zoom={10}
          style={{ height: "100%", width: "100%" }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {obras.map((obra) => {
            const phone = obra.telefone?.replace(/\D/g, "") || "";
            const whatsappUrl = phone ? `https://wa.me/55${phone}` : "";
            const mapsQuery = [obra.localizacao, obra.cidade].filter(Boolean).join(", ");
            const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(mapsQuery)}`;

            return (
              <Marker
                key={obra.id}
                position={[obra.lat, obra.lng]}
                icon={createColorIcon(statusColor(obra.statusProspeccao))}
              >
                <Popup>
                  <div className="space-y-2 min-w-[200px]">
                    <h3 className="font-bold text-sm">{obra.nome || "Sem nome"}</h3>
                    <p className="text-xs text-gray-600">{obra.construtora || "—"}</p>
                    <p className="text-xs">{[obra.localizacao, obra.cidade].filter(Boolean).join(", ")}</p>
                    {obra.statusProspeccao && (
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        {obra.statusProspeccao}
                      </span>
                    )}
                    <div className="flex gap-1 pt-1">
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                      >
                        📍 Google Maps
                      </a>
                      {whatsappUrl && (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-green-600 hover:underline flex items-center gap-0.5 ml-2"
                        >
                          💬 WhatsApp
                        </a>
                      )}
                      <a
                        href={`/nova-obra?id=${obra.id}`}
                        className="text-xs text-purple-600 hover:underline flex items-center gap-0.5 ml-2"
                      >
                        📋 Detalhes
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

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
