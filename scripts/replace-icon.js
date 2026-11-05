import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, '../app/tydora-web/src/assets/icon-source.svg');
const sourcePath = path.join(__dirname, '../app/tydora-web/src/assets/icon.png');
const iconsDir = path.join(__dirname, '../app/tydora-desktop/icons');

console.log(`Using source image: ${sourcePath}`);

// 矢量源文件是唯一真源：先渲染出 1024px PNG，再交给 tauri icon 切图
try {
  await sharp(svgPath, { density: 288 })
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(sourcePath);
  console.log(`Rendered ${path.basename(svgPath)} -> ${path.basename(sourcePath)} (1024x1024)`);
} catch (error) {
  console.error('Failed to render SVG source:', error.message);
  process.exit(1);
}

try {
  execSync(`npx tauri icon "${sourcePath}" --output "${iconsDir}"`, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
  console.log('Icons generated successfully!');
} catch (error) {
  console.error('Failed to generate icons:', error.message);
  process.exit(1);
}

console.log('Done!');
