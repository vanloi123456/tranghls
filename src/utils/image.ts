/**
 * Helper to process, resize and compress uploaded avatar images
 * to ensure crisp quality while preventing localStorage overflow.
 */
export async function processImageFile(file: File, maxDimension = 600, quality = 0.88): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp hình ảnh'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Hình ảnh bị lỗi hoặc định dạng không hỗ trợ'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-preserving dimensions
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Draw image smoothly
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to webp if supported, or jpeg
        try {
          const dataUrl = canvas.toDataURL('image/webp', quality);
          if (dataUrl.startsWith('data:image/webp')) {
            resolve(dataUrl);
            return;
          }
        } catch {
          // fallback
        }
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
