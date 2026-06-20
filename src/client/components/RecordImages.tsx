import { Download, ExternalLink } from "lucide-react";
import { apiBase } from "../api";

function resolveImageUrl(url: string) {
  if (url.startsWith("data:") || url.startsWith("http")) return url;
  return `${apiBase}${url}`;
}

function filenameFromUrl(url: string, index: number) {
  if (url.startsWith("data:")) return `record-image-${index + 1}.jpg`;
  return url.split("/").pop() || `record-image-${index + 1}.jpg`;
}

export function RecordImages({ imageUrls }: { imageUrls?: string[] }) {
  if (!imageUrls?.length) return null;

  return (
    <div className="record-images">
      {imageUrls.map((url, index) => {
        const imageUrl = resolveImageUrl(url);
        return (
          <figure className="record-image" key={`${url}-${index}`}>
            <a href={imageUrl} target="_blank" rel="noreferrer" title="查看原图">
              <img src={imageUrl} alt={`记录图片 ${index + 1}`} />
            </a>
            <figcaption>
              <a href={imageUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={14} />
                查看
              </a>
              <a href={imageUrl} download={filenameFromUrl(url, index)}>
                <Download size={14} />
                下载
              </a>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
