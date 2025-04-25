// This is a Node.js script that would generate an OpenGraph image
// In a real project, you would run this script to generate the image
// For now, we'll just create a placeholder

/*
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateOgImage() {
  // Create a 1200x630 canvas with a white background
  const canvas = sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  });

  // Read the favicon SVG
  const favicon = fs.readFileSync(path.join(__dirname, '../public/favicon.svg'));
  
  // Convert SVG to PNG with a specific size
  const faviconPng = await sharp(favicon)
    .resize(200, 200)
    .toBuffer();

  // Overlay the favicon on the canvas
  const ogImage = await canvas
    .composite([
      {
        input: faviconPng,
        top: 215, // Center vertically
        left: 500, // Center horizontally
      }
    ])
    .toBuffer();

  // Add text "Infinite Planner" using a composite operation
  // Note: Sharp doesn't support text directly, so in a real implementation
  // you might use a library like canvas or create a text image separately

  // Save the final image
  await sharp(ogImage)
    .toFile(path.join(__dirname, '../public/og-image.png'));

  console.log('OpenGraph image generated successfully!');
}

generateOgImage().catch(console.error);
*/
