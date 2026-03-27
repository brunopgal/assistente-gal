import { useState } from "react";
import { Upload, FileText, ExternalLink, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface FileUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
}

export default function FileUploadField({ label, value, onChange }: FileUploadFieldProps) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = `orcamentos/${fileName}`;

      const { error } = await supabase.storage.from("orcamentos").upload(filePath, file);
      if (error) throw error;

      const { data } = supabase.storage.from("orcamentos").getPublicUrl(filePath);
      onChange(data.publicUrl);
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      {value ? (
        <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline truncate flex-1"
          >
            Ver arquivo
          </a>
          <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onChange("")}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <label className="flex items-center gap-2 p-3 border border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">
            {uploading ? "Enviando..." : "Clique para enviar arquivo"}
          </span>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      )}
      <FormMessage />
    </FormItem>
  );
}
