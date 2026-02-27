import { useRef, useEffect } from "react";

interface CameraCaptureProps {
  onCapture: (base64: string, mode: 'product' | 'list') => void;
  productTriggerRef: React.RefObject<(() => void) | null>;
  listTriggerRef: React.RefObject<(() => void) | null>;
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1200;
      let { width, height } = img;
      if (width > height && width > MAX) {
        height = Math.round((height * MAX) / width);
        width = MAX;
      } else if (height > width && height > MAX) {
        width = Math.round((width * MAX) / height);
        height = MAX;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      resolve(dataUrl.replace("data:image/jpeg;base64,", ""));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function CameraCapture({ onCapture, productTriggerRef, listTriggerRef }: CameraCaptureProps) {
  const productInputRef = useRef<HTMLInputElement>(null);
  const listInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    productTriggerRef.current = () => productInputRef.current?.click();
    listTriggerRef.current = () => listInputRef.current?.click();
  }, [productTriggerRef, listTriggerRef]);

  const handleChange = (mode: 'product' | 'list') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const base64 = await compressImage(file);
      onCapture(base64, mode);
    } catch {
      // silently fail — parent will handle errors
    }
  };

  return (
    <>
      <input
        ref={productInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleChange('product')}
      />
      <input
        ref={listInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleChange('list')}
      />
    </>
  );
}
