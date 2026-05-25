import { supabase } from "@/integrations/supabase/client";

export const generateAndUploadOverlay = async (
  camera: {
    id: string;
    aspect_ratio: string;
    sponsor_logo_left?: string | null;
    sponsor_logo_center?: string | null;
    sponsor_logo_right?: string | null;
  }
) => {
  const is16x9 = camera.aspect_ratio === "16:9";
  const canvas = document.createElement("canvas");
  
  if (is16x9) {
    canvas.width = 1920;
    canvas.height = 1080;
  } else {
    canvas.width = 1080;
    canvas.height = 1920;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  // Helper to load image
  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  };

  // 1. Draw Template Base
  const baseUrl = is16x9 
    ? "https://jurwopyuxmhvtwzjxynm.supabase.co/storage/v1/object/public/overlays/overlay_base_16x9.png"
    : "https://jurwopyuxmhvtwzjxynm.supabase.co/storage/v1/object/public/overlays/overlay_base_9x16.png";
  
  const baseImg = await loadImage(baseUrl);
  ctx.drawImage(baseImg, 0, 0);

  // 2. Draw Sponsors
  const drawSponsor = async (url: string | null | undefined, x: number, y: number, w: number, h: number) => {
    if (!url) return;
    try {
      const img = await loadImage(url);
      // Center-fit logic
      const ratio = Math.min(w / img.width, h / img.height);
      const nw = img.width * ratio;
      const nh = img.height * ratio;
      const nx = x + (w - nw) / 2;
      const ny = y + (h - nh) / 2;
      ctx.drawImage(img, nx, ny, nw, nh);
    } catch (e) {
      console.error("Error drawing sponsor:", e);
    }
  };

  if (is16x9) {
    // 16:9 Coordinates
    await drawSponsor(camera.sponsor_logo_left, 220, 930, 250, 100);
    await drawSponsor(camera.sponsor_logo_center, 835, 930, 250, 100);
    await drawSponsor(camera.sponsor_logo_right, 1450, 930, 250, 100);
  } else {
    // 9:16 Coordinates
    await drawSponsor(camera.sponsor_logo_left, 70, 1760, 250, 100);
    await drawSponsor(camera.sponsor_logo_center, 415, 1760, 250, 100);
    await drawSponsor(camera.sponsor_logo_right, 760, 1760, 250, 100);
  }

  // 3. Export to Blob
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Canvas export failed");

  // 4. Upload to Supabase Storage
  const filePath = `generated/${camera.id}.png`;
  const { error: uploadError } = await supabase.storage
    .from("overlays")
    .upload(filePath, blob, { upsert: true });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from("overlays")
    .getPublicUrl(filePath);

  return publicUrl;
};
