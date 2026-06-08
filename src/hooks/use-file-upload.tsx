import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useFileUpload(bucket: string) {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File, path?: string) => {
    try {
      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = path || `${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);
      
      return publicUrl;
    } catch (error: any) {
      toast.error(`Erro no upload: ${error.message}`);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading };
}
