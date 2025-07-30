import domtoimage from 'dom-to-image-more';
import html2canvas from 'html2canvas';

export async function captureElement(element: HTMLElement): Promise<Blob> {
  try {
    // Get computed styles
    const computedStyle = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    // Clone the element to avoid UI distortion during capture
    const clone = element.cloneNode(true) as HTMLElement;
    
    // Apply necessary styles to the clone
    clone.style.position = 'fixed';
    clone.style.left = '0';
    clone.style.top = '0';
    clone.style.width = rect.width + 'px';
    clone.style.height = 'auto';
    clone.style.margin = '0';
    clone.style.padding = computedStyle.padding;
    clone.style.backgroundColor = computedStyle.backgroundColor || '#ffffff';
    clone.style.zIndex = '-9999';
    clone.style.transform = 'none';
    
    // Add to document temporarily
    document.body.appendChild(clone);
    
    // Apply styles to buttons in the clone to prevent text wrapping
    const buttons = clone.querySelectorAll('.action-button, .period-button');
    buttons.forEach((button: any) => {
      button.style.whiteSpace = 'nowrap';
    });
    
    // Wait for images and fonts to load
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
      // Get device pixel ratio for better quality
      const pixelRatio = 2; // Fixed to 2 for consistent quality
      
      // Try dom-to-image-more first
      const dataUrl = await domtoimage.toPng(clone, {
        quality: 1.0,
        pixelRatio: pixelRatio,
        width: rect.width,
        height: clone.scrollHeight,
        style: {
          transform: 'none',
          margin: '0',
          padding: computedStyle.padding
        }
      });

      const response = await fetch(dataUrl);
      return await response.blob();
    } finally {
      // Always remove the clone
      document.body.removeChild(clone);
    }
  } catch (error) {
    console.warn('dom-to-image-more failed, trying html2canvas:', error);
    
    // Get rect again for fallback
    const rect = element.getBoundingClientRect();
    const computedStyle = getComputedStyle(element);
    
    // Create a fresh clone for html2canvas
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.position = 'fixed';
    clone.style.left = '0';
    clone.style.top = '0';
    clone.style.width = rect.width + 'px';
    clone.style.margin = '0';
    clone.style.padding = computedStyle.padding;
    clone.style.backgroundColor = computedStyle.backgroundColor || '#ffffff';
    clone.style.zIndex = '-9999';
    document.body.appendChild(clone);
    
    try {
      // Fallback to html2canvas
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: rect.width,
        height: clone.scrollHeight,
        windowWidth: rect.width,
        windowHeight: clone.scrollHeight
      });

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob || new Blob());
        }, 'image/png', 1.0);
      });
    } finally {
      document.body.removeChild(clone);
    }
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