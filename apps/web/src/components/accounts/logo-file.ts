export async function readAccountLogo(file: File): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 2_000_000
  )
    throw new Error(
      "Choose a PNG, JPEG or WebP image up to 2 MB. Your current logo has been kept.",
    );
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth > 4096 ||
      image.naturalHeight > 4096
    )
      throw new Error(
        "Choose an image no larger than 4096 × 4096 pixels. Your current logo has been kept.",
      );
    const scale = Math.min(
      1,
      128 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "Image conversion is unavailable. Choose an icon instead, or try another browser.",
      );
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/png");
    if (result.length > 100_000)
      throw new Error(
        "Choose a simpler or smaller image. Your current logo has been kept.",
      );
    return result;
  } catch (error) {
    if (error instanceof Error && !(error instanceof DOMException)) throw error;
    throw new Error(
      "This image could not be read. Choose another PNG, JPEG or WebP, or select an icon. Your current logo has been kept.",
      { cause: error },
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
