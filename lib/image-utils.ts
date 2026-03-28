/**
 * Browser-side image preparation utilities.
 * Handles HEIC/HEIF decoding and raw byte extraction for OCR pipelines.
 * Safe for client components only (uses browser APIs: canvas, FileReader).
 */

const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx", "heis", "heim", "mif1", "msf1"];

/**
 * Returns the raw bytes of a file ready for OCR.
 * HEIC/HEIF files are decoded and re-encoded as JPEG via canvas.
 * All other image types are returned as-is.
 */
export async function prepareImageBytes(
  file: File,
  onProgress: (msg: string) => void
): Promise<Uint8Array> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isFtyp =
    header[4] === 0x66 &&
    header[5] === 0x74 &&
    header[6] === 0x79 &&
    header[7] === 0x70;
  const brand = isFtyp
    ? String.fromCharCode(header[8], header[9], header[10], header[11])
    : "";

  if (
    !HEIC_BRANDS.includes(brand) &&
    file.type !== "image/heic" &&
    file.type !== "image/heif"
  ) {
    return new Uint8Array(await file.arrayBuffer());
  }

  onProgress("Decoding HEIC image…");
  const libheif = await import("libheif-js/wasm-bundle");
  const rawBytes = new Uint8Array(await file.arrayBuffer());
  const images = new libheif.HeifDecoder().decode(rawBytes);
  if (!images?.length) throw new Error("Could not decode HEIC file.");

  const image = images[0];
  const canvas = document.createElement("canvas");
  canvas.width = image.get_width();
  canvas.height = image.get_height();

  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(canvas.width, canvas.height);

  await new Promise<void>((resolve, reject) => {
    image.display(imageData, (result: ImageData | null) => {
      if (result) {
        resolve();
      } else {
        reject(new Error("HEIF display error"));
      }
    });
  });

  ctx.putImageData(imageData, 0, 0);
  return new Uint8Array(
    await new Promise<ArrayBuffer>((resolve, reject) => {
      canvas.toBlob(
        (b) =>
          b
            ? b.arrayBuffer().then(resolve)
            : reject(new Error("canvas export failed")),
        "image/jpeg",
        0.9
      );
    })
  );
}
