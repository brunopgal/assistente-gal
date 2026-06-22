import { useState } from "react";
import { Upload, FileText, ExternalLink, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { openFileSafe } from "@/lib/openFile";

interface Props {
  label: string;
  value: string; // comma-separated URLs
  onChange: (urls: string) => void;
  maxFiles?: number;
}

function parseUrls(value: string): string[] {
  return (value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function MultiFileUploadField({ label, value, onChange, maxFiles }: Props) {
  const [uploading, setUploading] = useState(false);
  const urls = parseUrls(value);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (maxFiles && urls.length + files.length > maxFiles) {
      alert(`Você só pode enviar no máximo ${maxFiles} arquivos.`);
      return;
    }

    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const filePath = `orcamentos/${fileName}`;
        const { error } = await supabase.storage.from("orcamentos").upload(filePath, file);
        if (error) throw error;
        const { data } = supabase.storage.from("orcamentos").getPublicUrl(filePath);
        newUrls.push(data.publicUrl);
      }
      onChange([...urls, ...newUrls].join(","));
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeAt = (idx: number) => {
    const next = urls.filter((_, i) => i !== idx);
    onChange(next.join(","));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {urls.map((url, idx) => (
          <div key={`${url}-${idx}`} className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <button
              type="button"
              onClick={() => openFileSafe(url)}
              className="text-sm text-primary underline truncate flex-1 text-left hover:opacity-80"
            >
              Arquivo {idx + 1}
            </button>
            <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => removeAt(idx)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <label className="flex items-center gap-2 p-3 border border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">
            {uploading ? "Enviando..." : (maxFiles && urls.length >= maxFiles) ? `Limite de ${maxFiles} atingido` : urls.length ? "Adicionar mais arquivos" : "Clique para enviar arquivo(s)"}
          </span>
          <input
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
            onChange={handleUpload}
            disabled={uploading || (!!maxFiles && urls.length >= maxFiles)}
          />
        </label>
      </div>
    </div>
  );
}
