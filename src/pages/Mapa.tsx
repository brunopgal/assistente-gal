import { Map } from "lucide-react";
import EmbedCard from "@/components/EmbedCard";

// ✏️ CONFIGURE SUAS URLS AQUI
const MAPS_EMBED_URL = ""; // Cole a URL de incorporação do Google Maps (My Maps > Compartilhar > Incorporar no site, copie o src do iframe)
const MAPS_EXTERNAL_URL = "https://www.google.com/maps"; // Cole o link direto do seu mapa

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
