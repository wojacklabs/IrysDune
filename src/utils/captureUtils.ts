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
    clone.style.height = rect.height + 'px'; // Use actual height instead of auto
    clone.style.margin = '0';
    clone.style.padding = computedStyle.padding;
    clone.style.backgroundColor = computedStyle.backgroundColor || '#ffffff';
    clone.style.zIndex = '-9999';
    clone.style.transform = 'none';
    clone.style.overflow = 'visible'; // Ensure content is visible
    
    // Handle canvas elements (for Chart.js)
    const originalCanvases = element.querySelectorAll('canvas');
    const clonedCanvases = clone.querySelectorAll('canvas');
    
    originalCanvases.forEach((originalCanvas, index) => {
      const clonedCanvas = clonedCanvases[index];
      if (clonedCanvas && originalCanvas instanceof HTMLCanvasElement && clonedCanvas instanceof HTMLCanvasElement) {
        // Copy canvas content
        const context = clonedCanvas.getContext('2d');
        if (context) {
          clonedCanvas.width = originalCanvas.width;
          clonedCanvas.height = originalCanvas.height;
          context.drawImage(originalCanvas, 0, 0);
          
          // Get Chart.js instance if exists
          const chartInstance = (originalCanvas as any).chart;
          if (chartInstance) {
            // Look for logoPlugin in registered plugins
            const Chart = (window as any).Chart;
            if (Chart && Chart.registry && Chart.registry.plugins) {
              const registeredPlugins = Chart.registry.plugins.items;
              const logoPlugin = registeredPlugins.find((p: any) => p.id === 'logoPlugin');
              
              if (logoPlugin && logoPlugin.afterDatasetsDraw) {
                // Execute the plugin drawing on the cloned canvas
                const clonedChart = {
                  ...chartInstance,
                  ctx: context,
                  canvas: clonedCanvas,
                  chartArea: chartInstance.chartArea,
                  data: chartInstance.data,
                  getDatasetMeta: chartInstance.getDatasetMeta.bind(chartInstance)
                };
                logoPlugin.afterDatasetsDraw(clonedChart);
              }
            }
          }
        }
      }
    });
    
    // Preserve styles for specific classes
    const preserveStyles = ['.ecosystem-card', '.card', '.chart-container', '.chart-wrapper'];
    preserveStyles.forEach(selector => {
      const elements = clone.querySelectorAll(selector);
      elements.forEach((el: any) => {
        const originalEl = element.querySelector(selector);
        if (originalEl) {
          const originalStyles = getComputedStyle(originalEl);
          el.style.height = originalStyles.height;
          el.style.maxHeight = originalStyles.maxHeight;
          el.style.minHeight = originalStyles.minHeight;
        }
      });
    });
    
    // Add to document temporarily
    document.body.appendChild(clone);
    
    // Apply styles to buttons in the clone to prevent text wrapping
    const buttons = clone.querySelectorAll('.action-button, .period-button');
    buttons.forEach((button: any) => {
      button.style.whiteSpace = 'nowrap';
    });
    
    // Wait for images and fonts to load
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      // Get device pixel ratio for better quality
      const devicePixelRatio = window.devicePixelRatio || 1;
      const scale = Math.max(3, devicePixelRatio * 2);
      
      // Try dom-to-image-more first
      const dataUrl = await domtoimage.toPng(clone, {
        quality: 1.0,
        pixelRatio: scale,
        width: clone.offsetWidth * scale,
        height: clone.offsetHeight * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: clone.offsetWidth + 'px',
          height: clone.offsetHeight + 'px',
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
    clone.style.height = rect.height + 'px'; // Use actual height instead of auto
    clone.style.margin = '0';
    clone.style.padding = computedStyle.padding;
    clone.style.backgroundColor = computedStyle.backgroundColor || '#ffffff';
    clone.style.zIndex = '-9999';
    clone.style.overflow = 'visible';
    
    // Handle canvas elements for fallback
    const originalCanvases = element.querySelectorAll('canvas');
    const clonedCanvases = clone.querySelectorAll('canvas');
    
    originalCanvases.forEach((originalCanvas, index) => {
      const clonedCanvas = clonedCanvases[index];
      if (clonedCanvas && originalCanvas instanceof HTMLCanvasElement && clonedCanvas instanceof HTMLCanvasElement) {
        const context = clonedCanvas.getContext('2d');
        if (context) {
          clonedCanvas.width = originalCanvas.width;
          clonedCanvas.height = originalCanvas.height;
          context.drawImage(originalCanvas, 0, 0);
          
          // Get Chart.js instance if exists
          const chartInstance = (originalCanvas as any).chart;
          if (chartInstance) {
            // Look for logoPlugin in registered plugins
            const Chart = (window as any).Chart;
            if (Chart && Chart.registry && Chart.registry.plugins) {
              const registeredPlugins = Chart.registry.plugins.items;
              const logoPlugin = registeredPlugins.find((p: any) => p.id === 'logoPlugin');
              
              if (logoPlugin && logoPlugin.afterDatasetsDraw) {
                // Execute the plugin drawing on the cloned canvas
                const clonedChart = {
                  ...chartInstance,
                  ctx: context,
                  canvas: clonedCanvas,
                  chartArea: chartInstance.chartArea,
                  data: chartInstance.data,
                  getDatasetMeta: chartInstance.getDatasetMeta.bind(chartInstance)
                };
                logoPlugin.afterDatasetsDraw(clonedChart);
              }
            }
          }
        }
      }
    });
    
    // Preserve styles for specific classes
    const preserveStyles = ['.ecosystem-card', '.card', '.chart-container', '.chart-wrapper'];
    preserveStyles.forEach(selector => {
      const elements = clone.querySelectorAll(selector);
      elements.forEach((el: any) => {
        const originalEl = element.querySelector(selector);
        if (originalEl) {
          const originalStyles = getComputedStyle(originalEl);
          el.style.height = originalStyles.height;
          el.style.maxHeight = originalStyles.maxHeight;
          el.style.minHeight = originalStyles.minHeight;
        }
      });
    });
    
    document.body.appendChild(clone);
    
    try {
      // Wait a bit for rendering
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Fallback to html2canvas
      const devicePixelRatio = window.devicePixelRatio || 1;
      const scale = Math.max(3, devicePixelRatio * 2);
      
      const canvas = await html2canvas(clone, {
        scale: scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: rect.width,
        height: rect.height, // Use actual height
        windowWidth: rect.width,
        windowHeight: rect.height, // Use actual height
        // Don't remove DOM elements during capture
        removeContainer: false
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