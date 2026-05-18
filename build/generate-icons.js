const sharp = require('sharp')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

const resourcesDir = path.join(__dirname, '../resources')
const publicDir = path.join(__dirname, '../src/public')

const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512"
  fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="115" fill="#1a1228"/>
  <circle cx="230" cy="256" r="160" stroke="#a78bfa" stroke-width="20"/>
  <path d="M175 168 L175 344 L355 256 Z" fill="#a78bfa"/>
  <line x1="400" y1="200" x2="490" y2="200" stroke="#a78bfa" stroke-width="18" stroke-linecap="round"/>
  <line x1="400" y1="256" x2="500" y2="256" stroke="#a78bfa" stroke-width="22" stroke-linecap="round"/>
  <line x1="400" y1="312" x2="490" y2="312" stroke="#a78bfa" stroke-width="18" stroke-linecap="round"/>
</svg>
`

async function createIco(svgBuffer, outputPath) {
  const sizes = [16, 32, 48, 64, 128, 256]
  const pngBuffers = await Promise.all(
    sizes.map((s) => sharp(svgBuffer).resize(s, s).png().toBuffer())
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
  console.log(`✅ ${path.basename(outputPath)} generated`)
}

async function createIcns(svgBuffer, outputPath) {
  if (process.platform !== 'darwin') {
    console.log('Skipping .icns (requires macOS) — copying 512px PNG as placeholder')
    await sharp(svgBuffer).resize(512, 512).png().toFile(outputPath)
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
    await sharp(svgBuffer).resize(size, size).png().toFile(path.join(iconsetDir, name))
  }

  execSync(`iconutil -c icns "${iconsetDir}" -o "${outputPath}"`)
  fs.rmSync(iconsetDir, { recursive: true })
  console.log(`✅ ${path.basename(outputPath)} generated`)
}

async function main() {
  fs.mkdirSync(resourcesDir, { recursive: true })
  fs.mkdirSync(publicDir, { recursive: true })

  const svgBuffer = Buffer.from(svgIcon)

  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(resourcesDir, 'icon.png'))
  console.log('✅ icon.png generated')

  await createIco(svgBuffer, path.join(resourcesDir, 'icon.ico'))
  await createIcns(svgBuffer, path.join(resourcesDir, 'icon.icns'))

  await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(publicDir, 'favicon.png'))
  console.log('✅ src/public/favicon.png generated')

  console.log('✅ All icons written to resources/ and src/public/')
}

main().catch(console.error)
