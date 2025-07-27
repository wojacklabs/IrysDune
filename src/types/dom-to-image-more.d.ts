declare module 'dom-to-image-more' {
  export interface Options {
    quality?: number;
    pixelRatio?: number;
    width?: number;
    height?: number;
    style?: any;
  }

  export function toPng(node: HTMLElement, options?: Options): Promise<string>;
  export function toJpeg(node: HTMLElement, options?: Options): Promise<string>;
  export function toSvg(node: HTMLElement, options?: Options): Promise<string>;
  export function toPixelData(node: HTMLElement, options?: Options): Promise<Uint8ClampedArray>;
  export function toCanvas(node: HTMLElement, options?: Options): Promise<HTMLCanvasElement>;

  const domtoimage: {
    toPng: typeof toPng;
    toJpeg: typeof toJpeg;
    toSvg: typeof toSvg;
    toPixelData: typeof toPixelData;
    toCanvas: typeof toCanvas;
  };

  export default domtoimage;
} 