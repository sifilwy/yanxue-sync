import { useState } from "react";
import { X } from "lucide-react";
import { apiBase } from "../api";

function resolveImageUrl(url: string) {
  if (url.startsWith("data:") || url.startsWith("http")) return url;
  return `${apiBase}${url}`;
}

export function RecordImages({ imageUrls, thumbUrls }: { imageUrls?: string[]; thumbUrls?: string[] }) {
  const [previewUrl, setPreviewUrl] = useState("");
  if (!imageUrls?.length) return null;

  return (
    <>
      <div className="record-images">
        {imageUrls.map((url, index) => {
          const imageUrl = resolveImageUrl(url);
          const thumbUrl = resolveImageUrl(thumbUrls?.[index] ?? url);
          return (
            <button className="record-image" key={`${url}-${index}`} type="button" onClick={() => setPreviewUrl(imageUrl)}>
              <img src={thumbUrl} alt={`记录图片 ${index + 1}`} loading="lazy" />
            </button>
          );
        })}
      </div>

      {previewUrl && (
        <div className="image-viewer" role="dialog" aria-modal="true" onClick={() => setPreviewUrl("")}>
          <button className="image-viewer-close" type="button" aria-label="关闭预览" onClick={() => setPreviewUrl("")}>
            <X size={24} />
          </button>
          <img src={previewUrl} alt="记录原图" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </>
  );
}
