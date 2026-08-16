import QRCode from 'qrcode';

export async function generateQrCodeSvg(text: string, options?: { width?: number; margin?: number }): Promise<string> {
  const width = options?.width || 120;
  const margin = options?.margin !== undefined ? options.margin : 1;

  try {
    const svgString = await QRCode.toString(text, {
      type: 'svg',
      width: width,
      margin: margin,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    return svgString;
  } catch (err) {
    console.error('Error generating QR code SVG:', err);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${width}" height="${width}"><rect width="100" height="100" fill="#eee"/><text x="50" y="50" text-anchor="middle" font-size="10">QR Error</text></svg>`;
  }
}
