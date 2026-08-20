const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Create standard Microsoft ICO file with embedded PNG chunks
function createIcoFile(pngBuffers, sizes) {
  const numImages = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const headerAndDirSize = headerSize + (dirEntrySize * numImages);

  let currentOffset = headerAndDirSize;
  const dirEntries = [];

  for (let i = 0; i < numImages; i++) {
    const buf = pngBuffers[i];
    const size = sizes[i];
    const widthByte = size >= 256 ? 0 : size;
    const heightByte = size >= 256 ? 0 : size;

    const entry = Buffer.alloc(16);
    entry.writeUInt8(widthByte, 0); // Width
    entry.writeUInt8(heightByte, 1); // Height
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(buf.length, 8); // Size of image data
    entry.writeUInt32LE(currentOffset, 12); // Offset of image data

    dirEntries.push(entry);
    currentOffset += buf.length;
  }

  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // Reserved (must be 0)
  icoHeader.writeUInt16LE(1, 2); // Image type (1 for ICO)
  icoHeader.writeUInt16LE(numImages, 4); // Number of images

  return Buffer.concat([icoHeader, ...dirEntries, ...pngBuffers]);
}

async function generate() {
  const publicDir = path.join(__dirname, '..', 'public');
  const appDir = path.join(__dirname, '..', 'src', 'app');
  const svgPath = path.join(publicDir, 'favicon.svg');

  const svgBuffer = fs.readFileSync(svgPath);

  console.log('Generating high-res PNG and ICO icon assets...');

  const png16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer();
  const png32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  const png48 = await sharp(svgBuffer).resize(48, 48).png().toBuffer();
  const png180 = await sharp(svgBuffer).resize(180, 180).png().toBuffer();
  const png192 = await sharp(svgBuffer).resize(192, 192).png().toBuffer();
  const png512 = await sharp(svgBuffer).resize(512, 512).png().toBuffer();

  const icoBuffer = createIcoFile([png16, png32, png48], [16, 32, 48]);

  // Write to public/
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(publicDir, 'favicon-16x16.png'), png16);
  fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), png32);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png180);
  fs.writeFileSync(path.join(publicDir, 'icon-192x192.png'), png192);
  fs.writeFileSync(path.join(publicDir, 'icon-512x512.png'), png512);

  // Write to src/app/ for Next.js App Router default favicon
  fs.writeFileSync(path.join(appDir, 'favicon.ico'), icoBuffer);

  console.log('✅ Successfully generated all favicon and PWA icons!');
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
