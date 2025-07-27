import domtoimage from 'dom-to-image-more';
import html2canvas from 'html2canvas';

export async function captureElement(element: HTMLElement): Promise<Blob> {
  try {
    // Get device pixel ratio for better quality
    const pixelRatio = window.devicePixelRatio || 1;
    const scale = Math.max(2, pixelRatio);

    // Try dom-to-image-more first
    const dataUrl = await domtoimage.toPng(element, {
      quality: 1.0,
      pixelRatio: scale,
      width: element.offsetWidth * scale,
      height: element.offsetHeight * scale,
      style: {
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: element.offsetWidth + 'px',
        height: element.offsetHeight + 'px',
      },
    });

    const response = await fetch(dataUrl);
    return await response.blob();
  } catch (error) {
    console.warn('dom-to-image-more failed, trying html2canvas:', error);
    
    // Fallback to html2canvas
    const canvas = await html2canvas(element, {
      scale: window.devicePixelRatio || 1,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob || new Blob());
      }, 'image/png', 1.0);
    });
  }
}

export async function copyToClipboard(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob,
      }),
    ]);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}

export function downloadImage(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function shareOnTwitter(text: string, _imageBlob?: Blob) {
  // Twitter doesn't support direct image sharing through intent URL
  // So we just share the text and guide user to attach the image manually
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(twitterUrl, '_blank');
}

export async function captureAndShare(
  element: HTMLElement,
  shareText: string,
  filename: string
): Promise<{ success: boolean; blob?: Blob }> {
  try {
    const blob = await captureElement(element);
    
    // Try to copy to clipboard first
    const clipboardSuccess = await copyToClipboard(blob);
    
    if (clipboardSuccess) {
      // Open Twitter with text
      shareOnTwitter(shareText + '\n\n(Image copied to clipboard. Please paste it on Twitter!)');
    } else {
      // Fallback to download
      downloadImage(blob, filename);
      shareOnTwitter(shareText);
    }

    return { success: true, blob };
  } catch (error) {
    console.error('Capture and share failed:', error);
    return { success: false };
  }
} 