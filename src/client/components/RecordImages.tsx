export function RecordImages({ imageUrls }: { imageUrls?: string[] }) {
  if (!imageUrls?.length) return null;

  return (
    <div className="record-images">
      {imageUrls.map((url) => <img key={url} src={url} alt="记录图片" />)}
    </div>
  );
}
