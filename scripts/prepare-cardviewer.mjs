import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const revision = '0030c9ba5045f6e2de871b300d446fb91def9599'
const root = fileURLToPath(new URL('../', import.meta.url))
const vendor = join(root, 'vendor', 'cardviewer')
const files = (await readFile(new URL('./cardviewer-files.txt', import.meta.url), 'utf8'))
  .trim().split(/\r?\n/)
const stamp = join(vendor, '.revision')

if (await readFile(stamp, 'utf8').catch(() => '') === revision) {
  console.log(`cardviewer ${revision}: already prepared`)
} else {
  const staging = await mkdtemp(join(tmpdir(), 'simulator-cardviewer-'))
  try {
    const archive = join(staging, 'cardviewer.tar.gz')
    if (process.env.CARDVIEWER_ARCHIVE) {
      console.log(`cardviewer ${revision}: local archive ${process.env.CARDVIEWER_ARCHIVE}`)
      await copyFile(process.env.CARDVIEWER_ARCHIVE, archive)
    } else {
      const url = `https://codeload.github.com/lukaszmizik/cardviewer/tar.gz/${revision}`
      console.log(`cardviewer ${revision}: download ${url}`)
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      if (!response.ok) throw new Error(`Cannot download cardviewer ${revision}: HTTP ${response.status}`)
      await writeFile(archive, Buffer.from(await response.arrayBuffer()))
    }
    const extracted = join(staging, 'out')
    await mkdir(extracted)
    const result = spawnSync('tar', ['-xf', archive, '-C', extracted, '--strip-components=1'], { stdio: 'inherit' })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`Cannot extract cardviewer ${revision}`)
    for (const file of files) {
      const target = join(vendor, file)
      await mkdir(dirname(target), { recursive: true })
      await copyFile(join(extracted, file), target)
    }
    await writeFile(stamp, revision)
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

async function copyOverrides(source, destination) {
  await mkdir(destination, { recursive: true })
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name)
    const to = join(destination, entry.name)
    if (entry.isDirectory()) await copyOverrides(from, to)
    else await copyFile(from, to)
  }
}

await copyOverrides(join(root, 'vendor', 'cardviewer-overrides'), vendor)

for (const [source, destination] of [
  ['vendor/cardviewer/public/wasm_exec.js', 'public/wasm_exec.js'],
  ['vendor/cardviewer/public/dddparser.wasm', 'public/dddparser.wasm'],
  ['ttf/PixeloidSans.ttf', 'public/ttf/pixeloidsans/PixeloidSans.ttf'],
  ['ttf/casio/casio-fx-9860gii.ttf', 'public/ttf/casio/casio-fx-9860gii.ttf'],
]) {
  const target = join(root, destination)
  await mkdir(dirname(target), { recursive: true })
  await copyFile(join(root, source), target)
}
