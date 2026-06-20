export type PreparedImage = {
  url: string;
  thumbUrl: string;
};

export async function filesToDataUrls(files: FileList | null, limit: number) {
  if (!files || limit <= 0) return [];
  const selected = Array.from(files).slice(0, limit);

  return Promise.all(selected.map((file) => prepareImage(file)));
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function prepareImage(file: File): Promise<PreparedImage> {
  const source = await readFileAsDataUrl(file);
  if (!file.type.startsWith("image/")) return { url: source, thumbUrl: source };

  const image = await loadImage(source);
  return {
    url: drawImageToDataUrl(image, 1600, 0.82),
    thumbUrl: drawImageToDataUrl(image, 280, 0.72)
  };
}

function drawImageToDataUrl(image: HTMLImageElement, maxSide: number, quality: number) {
  const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return image.src;

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
