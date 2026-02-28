declare module 'fluent-ffmpeg' {
  export interface FfmpegCommand {
    setFfmpegPath(path: string): FfmpegCommand
    input(input: string | string[]): FfmpegCommand
    inputOptions(options: string[]): FfmpegCommand
    outputOptions(options: string[]): FfmpegCommand
    videoFilters(filters: string[]): FfmpegCommand
    complexFilter(filter: string | string[]): FfmpegCommand
    on(event: string, callback: (...args: any[]) => void): FfmpegCommand
    save(output: string): FfmpegCommand
  }
  interface Ffmpeg {
    (input?: string): FfmpegCommand
    setFfmpegPath(path: string): void
    ffprobe(path: string, callback: (err: Error | null, data: { streams?: { codec_type?: string }[] }) => void): void
  }
  const ffmpeg: Ffmpeg
  export default ffmpeg
}
