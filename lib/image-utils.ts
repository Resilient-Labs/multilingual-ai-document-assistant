const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx", "heis", "heim", "mif1", "msf1"];

/**
 * Reads an image file into a Uint8Array suitable for Tesseract.
 * HEIC/HEIF files are decoded via libheif-js and re-encoded as JPEG.
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
