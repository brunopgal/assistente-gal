import { Calendar } from "lucide-react";
import EmbedCard from "@/components/EmbedCard";

// ✏️ CONFIGURE SUAS URLS AQUI
const CALENDAR_EMBED_URL = "https://calendar.google.com/calendar/embed?src=a108b14c60969a93be0b8dcf33b52d4c1c4aa4c421d14c52fb455ae9752bf4b8%40group.calendar.google.com&ctz=America/Sao_Paulo";
const CALENDAR_EXTERNAL_URL = "https://calendar.google.com/calendar/u/0?cid=YTEwOGIxNGM2MDk2OWE5M2JlMGI4ZGNmMzNiNTJkNGMxYzRhYTRjNDIxZDE0YzUyZmI0NTVhZTk3NTJiZjRiOEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t";

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
