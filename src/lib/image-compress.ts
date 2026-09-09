// Client-side image compression. Phone camera photos are far too large to send
// through the server-action request body (a single photo can be 3-10 MB and
// stalls the upload), so images are resized and re-encoded to JPEG before they
// are added to the form. Keeps uploads small, fast, and reliable on mobile.

export const COMPRESSED_IMAGE_TYPE = "image/jpeg";
export const COMPRESSED_IMAGE_EXTENSION = "jpg";

export function compressImageFile(
  file: File,
  options?: { maxDim?: number; quality?: number },
): Promise<File> {
  const maxDim = options?.maxDim ?? 1600;
  const quality = options?.quality ?? 0.8;

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is not supported in this browser.");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) return reject(new Error("Could not compress the image."));
            const base = file.name.replace(/\.[^.]+$/, "") || "image";
            resolve(
              new File([blob], `${base}.${COMPRESSED_IMAGE_EXTENSION}`, { type: COMPRESSED_IMAGE_TYPE }),
            );
          },
          COMPRESSED_IMAGE_TYPE,
          quality,
        );
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the image."));
    };
    image.src = url;
  });
}
