import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { useResourceImageUpload } from "@/hooks/useResourceImage";

interface ResourceImageUploadProps {
  imageUrl: string | null;
  onImageChange: (url: string | null) => void;
}

export function ResourceImageUpload({ imageUrl, onImageChange }: ResourceImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploadImage, uploading } = useResourceImageUpload();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      onImageChange(url);
    } catch (err: any) {
      console.error("Upload failed:", err.message);
    }
  };

  return (
    <div className="space-y-2">
      {imageUrl ? (
        <div className="relative w-full h-32 rounded-lg overflow-hidden border border-border bg-muted">
          <img src={imageUrl} alt="Resource" className="w-full h-full object-cover" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6"
            onClick={() => onImageChange(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full h-24 border-dashed flex flex-col gap-1"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Upload Image</span>
            </>
          )}
        </Button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
