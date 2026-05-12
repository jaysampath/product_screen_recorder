const sharp = require('sharp')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

const resourcesDir = path.join(__dirname, '../resources')
const sourcePath = path.join(resourcesDir, 'icon-source.png')

async function createPlaceholder() {
  const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" fill="#1a1a1a" rx="80"/>
    <text x="256" y="340" font-family="Arial, sans-serif" font-size="220" font-weight="bold"
          fill="white" text-anchor="middle">RQ</text>
  </svg>`
  await sharp(Buffer.from(svg)).png().toFile(sourcePath)
  console.log('Generated placeholder icon-source.png')
}

async function createIco(inputPath, outputPath) {
  const sizes = [16, 32, 48, 64, 128, 256]
  const pngBuffers = await Promise.all(
    sizes.map((s) => sharp(inputPath).resize(s, s).png().toBuffer())
  )

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)

  const entries = []
  let offset = 6 + sizes.length * 16
  for (let i = 0; i < sizes.length; i++) {
    const e = Buffer.alloc(16)
    const s = sizes[i]
    e.writeUInt8(s === 256 ? 0 : s, 0)
    e.writeUInt8(s === 256 ? 0 : s, 1)
    e.writeUInt8(0, 2)
    e.writeUInt8(0, 3)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(pngBuffers[i].length, 8)
    e.writeUInt32LE(offset, 12)
    entries.push(e)
    offset += pngBuffers[i].length
  }

  fs.writeFileSync(outputPath, Buffer.concat([header, ...entries, ...pngBuffers]))
  console.log(`Created ${outputPath}`)
}

async function createIcns(inputPath, outputPath) {
  if (process.platform !== 'darwin') {
    console.log('Skipping .icns (requires macOS) — run this script on Mac before building')
    await sharp(inputPath).resize(512, 512).png().toFile(outputPath.replace('.icns', '-512.png'))
    return
  }

  const iconsetDir = outputPath.replace('.icns', '.iconset')
  fs.mkdirSync(iconsetDir, { recursive: true })

  const iconsetSizes = [
    [16, 'icon_16x16.png'],
    [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'],
    [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'],
    [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'],
    [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'],
    [1024, 'icon_512x512@2x.png']
  ]

  for (const [size, name] of iconsetSizes) {
    await sharp(inputPath).resize(size, size).png().toFile(path.join(iconsetDir, name))
  }

  execSync(`iconutil -c icns "${iconsetDir}" -o "${outputPath}"`)
  fs.rmSync(iconsetDir, { recursive: true })
  console.log(`Created ${outputPath}`)
}

async function main() {
  fs.mkdirSync(resourcesDir, { recursive: true })

  if (!fs.existsSync(sourcePath)) {
    console.log('icon-source.png not found — generating placeholder...')
    await createPlaceholder()
  }

  await createIco(sourcePath, path.join(resourcesDir, 'icon.ico'))
  await createIcns(sourcePath, path.join(resourcesDir, 'icon.icns'))

  console.log('Done. Icons written to resources/')
}

main().catch(console.error)
