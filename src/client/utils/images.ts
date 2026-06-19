export async function filesToDataUrls(files: FileList | null, limit: number) {
  if (!files || limit <= 0) return [];
  const selected = Array.from(files).slice(0, limit);

  return Promise.all(
    selected.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    )
  );
}
