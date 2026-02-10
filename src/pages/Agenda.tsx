import { Calendar } from "lucide-react";
import EmbedCard from "@/components/EmbedCard";

// ✏️ CONFIGURE SUAS URLS AQUI
const CALENDAR_EMBED_URL = ""; // Cole a URL de incorporação do Google Calendar (Configurações > Integrar agenda > Código de incorporação, copie o src do iframe)
const CALENDAR_EXTERNAL_URL = "https://calendar.google.com"; // Cole o link direto do seu calendário

export default function Agenda() {
  return (
    <EmbedCard
      title="Agenda"
      description="Visualize visitas, follow-ups e compromissos"
      icon={<Calendar className="h-5 w-5" />}
      embedUrl={CALENDAR_EMBED_URL}
      externalUrl={CALENDAR_EXTERNAL_URL}
      externalLabel="Abrir Google Calendar"
      height="calc(100vh - 180px)"
      placeholder="Para incorporar sua agenda, vá no Google Calendar → Configurações → sua agenda → Integrar agenda → copie o 'URL público' do iframe e cole no código."
    />
  );
}
