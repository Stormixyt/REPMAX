function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(reader.error || new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Could not load the selected image."));
    img.src = url;
  });
}

export async function optimizeImageForVision(file, options = {}) {
  const {
    maxDimension = 1280,
    maxDataUrlLength = 1_350_000,
    qualitySteps = [0.82, 0.72, 0.62],
  } = options;

  const fallbackDataUrl = await readFileAsDataUrl(file);

  if (typeof document === "undefined" || !file?.type?.startsWith("image/")) {
    return fallbackDataUrl;
  }

  let objectUrl = "";

  try {
    objectUrl = URL.createObjectURL(file);
    const image = await loadImage(objectUrl);
    const scale = Math.min(
      1,
      maxDimension / Math.max(image.width, image.height)
    );
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return fallbackDataUrl;

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    for (const quality of qualitySteps) {
      const optimized = canvas.toDataURL("image/jpeg", quality);
      if (
        optimized.length <= maxDataUrlLength ||
        quality === qualitySteps[qualitySteps.length - 1]
      ) {
        return optimized;
      }
    }
  } catch {
    return fallbackDataUrl;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }

  return fallbackDataUrl;
}
