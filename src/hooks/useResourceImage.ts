import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useResourceImageUpload() {
  const [uploading, setUploading] = useState(false);
  const { centerId } = useAuth();

  const uploadImage = async (file: File): Promise<string> => {
    if (!centerId) throw new Error("No center assigned");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${centerId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("resource-images")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("resource-images").getPublicUrl(path);
      return data.publicUrl;
    } finally {
      setUploading(false);
    }
  };

  return { uploadImage, uploading };
}
