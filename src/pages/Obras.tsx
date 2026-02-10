import { Building2 } from "lucide-react";
import EmbedCard from "@/components/EmbedCard";

// ✏️ CONFIGURE SUAS URLS AQUI
const SHEETS_EMBED_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj4AlBo3824a0HmbV6tusrdz2n5parJjI9gk6TfdHgywOuWKdnr1v013W7cyMJAGqnyyGYr7TSj6sS/pubhtml?widget=true&headers=false";
const SHEETS_EXTERNAL_URL = "https://docs.google.com/spreadsheets"; // Cole o link direto da sua planilha

export default function Obras() {
  return (
    <EmbedCard
      title="Obras"
      description="Acompanhe todas as obras, construtoras e status"
      icon={<Building2 className="h-5 w-5" />}
      embedUrl={SHEETS_EMBED_URL}
      externalUrl={SHEETS_EXTERNAL_URL}
      externalLabel="Abrir planilha no Google Sheets"
      height="calc(100vh - 180px)"
      placeholder="Para incorporar sua planilha, publique-a no Google Sheets (Arquivo → Compartilhar → Publicar na web → Incorporar) e cole a URL no código."
    />
  );
}
