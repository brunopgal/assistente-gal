import { Map } from "lucide-react";
import EmbedCard from "@/components/EmbedCard";

// ✏️ CONFIGURE SUAS URLS AQUI
const MAPS_EMBED_URL = "https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d29439.881216446138!2d-47.008972799999995!3d-22.72879325!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1spt-BR!2sbr!4v1770741293761!5m2!1spt-BR!2sbr";
const MAPS_EXTERNAL_URL = "https://maps.app.goo.gl/zKDMDUUCH2Wq7pUL9";

export default function Mapa() {
  return (
    <EmbedCard
      title="Mapa"
      description="Localize obras e clientes com marcadores por status"
      icon={<Map className="h-5 w-5" />}
      embedUrl={MAPS_EMBED_URL}
      externalUrl={MAPS_EXTERNAL_URL}
      externalLabel="Abrir no Google Maps"
      height="calc(100vh - 180px)"
      placeholder="Para incorporar seu mapa, crie um mapa no Google My Maps, compartilhe-o e cole a URL de incorporação no código."
    />
  );
}
