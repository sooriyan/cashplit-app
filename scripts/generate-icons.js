const { Jimp } = require('jimp');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '../assets/images/logo.png');
const ASSETS_DIR = path.join(__dirname, '../assets/images');
const BACKGROUND_COLOR = '#0D0D0D'; // Dark theme background

const ICONS = [
    { name: 'icon.png', size: 1024, padding: 0.1, background: BACKGROUND_COLOR },
    { name: 'adaptive-icon.png', size: 1024, padding: 0.3, background: 0x00000000 }, // Transparent for adaptive foreground
    { name: 'splash-icon.png', size: 1024, padding: 0.0, background: 0x00000000 }, // Transparent, splash screen handles bg color
    { name: 'favicon.png', size: 48, padding: 0.0, background: 0x00000000 }
];

async function generate() {
    try {
        console.log(`Reading logo from: ${LOGO_PATH}`);

        let logo;
        try {
            logo = await Jimp.read(LOGO_PATH);
        } catch (e) {
            console.error("Error reading logo.png. Make sure 'assets/images/logo.png' exists.");
            console.error(e);
            process.exit(1);
        }

        console.log("Logo loaded. Generating icons...");

        for (const iconConfig of ICONS) {
            const { name, size, padding, background } = iconConfig;

            // Create new canvas
            // Jimp v1: new Jimp({ width, height, color })
            const canvas = new Jimp({ width: size, height: size, color: background });

            // Calculate logo size
            const targetLogoSize = Math.floor(size * (1 - padding * 2));

            // Clone logo and resize to fit within target size (maintaining aspect ratio)
            const scaledLogo = logo.clone().contain({ w: targetLogoSize, h: targetLogoSize });

            // Calculate centering position
            const x = Math.floor((size - scaledLogo.width) / 2);
            const y = Math.floor((size - scaledLogo.height) / 2);

            // Composite
            canvas.composite(scaledLogo, x, y);

            // Save
            const outputPath = path.join(ASSETS_DIR, name);
            // Jimp v1: write(path) returns promise
            await canvas.write(outputPath);
            console.log(`Generated: ${name}`);
        }

        console.log("All icons generated successfully!");

    } catch (err) {
        console.error("Error generating icons:", err);
        process.exit(1);
    }
}

generate();
