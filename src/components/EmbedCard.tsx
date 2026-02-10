import { ExternalLink } from "lucide-react";

interface EmbedCardProps {
  title: string;
  description?: string;
  embedUrl: string;
  externalUrl: string;
  externalLabel: string;
  height?: string;
  icon: React.ReactNode;
  placeholder?: string;
}

export default function EmbedCard({
  title,
  description,
  embedUrl,
  externalUrl,
  externalLabel,
  height = "600px",
  icon,
  placeholder,
}: EmbedCardProps) {
  const isPlaceholder = !embedUrl || embedUrl === "";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent text-accent-foreground">
            {icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity shadow-md w-fit"
        >
          <ExternalLink className="h-4 w-4" />
          {externalLabel}
        </a>
      </div>

      <div
        className="rounded-xl border border-embed-border bg-embed overflow-hidden shadow-sm"
        style={{ height }}
      >
        {isPlaceholder ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 p-8 text-center">
            {icon}
            <p className="text-sm max-w-md">
              {placeholder || "Configure a URL do embed para visualizar o conteúdo aqui."}
            </p>
          </div>
        ) : (
          <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            allowFullScreen
            loading="lazy"
          />
        )}
      </div>
    </div>
  );
}
