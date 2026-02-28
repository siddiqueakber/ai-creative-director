export function bufferToDataUrl(buffer: Buffer, mimeType: string = 'audio/mpeg'): string {
  const base64 = buffer.toString('base64')
  return `data:${mimeType};base64,${base64}`
}

export async function writePublicFile(
  buffer: Buffer,
  relativePath: string
): Promise<string> {
  const { mkdir, writeFile } = await import('node:fs/promises')
  const path = await import('node:path')

  const publicDir = path.join(process.cwd(), 'public')
  const fullPath = path.join(publicDir, relativePath)
  const dir = path.dirname(fullPath)

  await mkdir(dir, { recursive: true })
  await writeFile(fullPath, buffer)

  return `/${relativePath.replace(/\\/g, '/')}`
}
