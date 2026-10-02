import { Input, BlobSource, ALL_FORMATS, CanvasSink, AudioBufferSink, Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, canEncodeVideo, canEncodeAudio } from 'mediabunny'
import type { ProjectBundle, TextStyle } from '../types/editor'
import { activeVideo, sourceTime, clipEnd } from './timeline'

export interface ExportProgress { percent: number; stage: string }
function drawText(ctx: CanvasRenderingContext2D, text: TextStyle, canvasWidth: number) {
  ctx.save()
  ctx.font = `${text.bold ? 700 : 400} ${text.fontSize}px "${text.fontFamily}"`
  const max = canvasWidth * .9 - 24
  const paragraphs = text.value.split('\n')
  const width = Math.max(1, Math.min(max, Math.max(...paragraphs.map(p => ctx.measureText(p).width))))
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    let line = ''
    for (const token of paragraph.split(/(\s+)/)) {
      if (line && ctx.measureText(line + token).width > width && token.trim()) { lines.push(line); line = '' }
      for (const char of token) {
        if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = '' }
        line += char
      }
    }
    lines.push(line)
  }
  ctx.fillStyle = text.color; ctx.textAlign = text.align; ctx.textBaseline = 'middle'
  const x = text.x + (text.align === 'left' ? -width/2 : text.align === 'right' ? width/2 : 0)
  const lineHeight = text.fontSize * 1.25
  for (let i = 0; i < lines.length; i++) {
    const y = text.y + (i - (lines.length-1)/2) * lineHeight
    if (text.shadow) { ctx.shadowColor = '#000'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3 }
    ctx.fillText(lines[i],x,y)
  }
  ctx.restore()
}

export async function exportVideo(bundle: ProjectBundle, height: 1280 | 1920, signal: AbortSignal, progress: (value: ExportProgress) => void): Promise<Blob> {
  const project = structuredClone(bundle.project)
  if (project.duration <= 0) throw new Error('내보낼 클립을 추가하세요.')
  if (project.duration > 600) throw new Error('현재 MP4 내보내기는 프로젝트 10분까지 지원합니다.')
  const width = height === 1280 ? 720 : 1080; const fps = project.canvas.fps
  const check = () => { if (signal.aborted) throw new DOMException('내보내기를 취소했습니다.', 'AbortError') }
  check()
  if (!await canEncodeVideo('avc',{width,height,bitrate:height === 1280 ? 4_000_000 : 8_000_000,frameRate:fps})) throw new Error('이 브라우저는 MP4 인코딩을 지원하지 않습니다. 최신 Chrome 또는 Edge에서 내보내세요.')
  const inputs = new Map<string, Input>()
  const sinks = new Map<string, CanvasSink>()
  const firstFrames = new Map<string, number>()
  const images = new Map<string, ImageBitmap>()
  let output: Output | undefined
  let finished = false
  const getInput = (id: string, file?: Blob) => {
    if (!file) throw new Error('원본 미디어 파일을 찾을 수 없습니다.')
    let input = inputs.get(id)
    if (!input) { input = new Input({source: new BlobSource(file),formats: ALL_FORMATS}); inputs.set(id,input) }
    return input
  }
  try {
    progress({percent:0,stage:'원본 미디어 준비 중…'})
    const clips = project.tracks.flatMap(t => t.clips)
    for (const clip of clips.filter(c => c.type === 'video')) {
      check(); const asset = bundle.videoAssets[clip.videoAssetId ?? '']
      if (!asset) throw new Error(`${clip.name}: 원본 영상이 누락되었습니다.`)
      if (sinks.has(asset.id)) continue
      const track = await getInput(asset.id,asset.file).getPrimaryVideoTrack()
      if (!track || !await track.canDecode()) throw new Error(`${asset.name}: 내보내기에 지원하지 않는 영상 코덱입니다.`)
      sinks.set(asset.id,new CanvasSink(track,{poolSize:1}))
      firstFrames.set(asset.id,await track.getFirstTimestamp())
    }
    for (const clip of clips.filter(c => c.image)) {
      check(); const asset = bundle.imageAssets[clip.image!.assetId]
      if (!asset?.file) throw new Error('원본 이미지를 찾을 수 없습니다.')
      if (!images.has(asset.id)) images.set(asset.id,await createImageBitmap(asset.file))
    }
    await document.fonts.ready
    const audible = clips.filter(c => (c.type === 'video' || c.type === 'audio') && !c.sound?.muted && (c.sound?.volume ?? 1) > 0)
    let mixed: AudioBuffer | undefined
    if (audible.length) {
      progress({percent:2,stage:'음악과 원본 소리 합성 중…'})
      const offline = new OfflineAudioContext(2,Math.ceil(project.duration*48000),48000)
      let hasAudio = false
      for (const clip of audible) {
        check()
        const id = clip.type === 'video' ? clip.videoAssetId : clip.audioAssetId
        const asset = clip.type === 'video' ? bundle.videoAssets[id ?? ''] : bundle.audioAssets[id ?? '']
        if (!asset) throw new Error('원본 오디오를 찾을 수 없습니다.')
        const track = await getInput(asset.id,asset.file).getPrimaryAudioTrack()
        if (!track) { if (clip.type === 'audio') throw new Error(`${asset.name}: 오디오 트랙을 찾을 수 없습니다.`); continue }
        if (!await track.canDecode()) throw new Error(`${asset.name}: 오디오 코덱을 읽을 수 없습니다.`)
        const sourceStart = clip.sourceStart ?? 0
        const gain = offline.createGain(); gain.gain.value = clip.sound?.volume ?? 1; gain.connect(offline.destination)
        for await (const {buffer,timestamp} of new AudioBufferSink(track).buffers(sourceStart,sourceStart+clip.duration)) {
          check()
          const offset = Math.max(0, sourceStart-timestamp)
          const start = clip.start + Math.max(0,timestamp-sourceStart)
          const duration = Math.min(buffer.duration-offset,clipEnd(clip)-start)
          if (duration <= 0) continue
          const source = offline.createBufferSource(); source.buffer = buffer; source.connect(gain); source.start(start,offset,duration); hasAudio = true
        }
      }
      if (hasAudio) { mixed = await offline.startRendering(); check() }
    }
    if (mixed && !await canEncodeAudio('aac',{sampleRate:48000,numberOfChannels:2,bitrate:128000})) {
      const {registerAacEncoder} = await import('@mediabunny/aac-encoder'); registerAacEncoder(); check()
    }
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')!
    const video = new CanvasSource(canvas,{codec:'avc',bitrate:height === 1280 ? 4_000_000 : 8_000_000,keyFrameInterval:2})
    const audio = mixed ? new AudioBufferSource({codec:'aac',bitrate:128000}) : undefined
    const target = new BufferTarget()
    output = new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target})
    output.addVideoTrack(video,{frameRate:fps}); if (audio) output.addAudioTrack(audio)
    await output.start()
    const frames = Math.ceil(project.duration*fps)
    let audioOffset = 0
    for (let frame = 0; frame < frames; frame++) {
      check(); const time = frame/fps
      ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0,0,width,height)
      const clip = activeVideo(project.tracks,time)
      if (clip) {
        const decoded = await sinks.get(clip.videoAssetId!)!.getCanvas(Math.max(firstFrames.get(clip.videoAssetId!) ?? 0,sourceTime(clip,time))); check()
        if (decoded) {
          const scale = Math.min(width/decoded.canvas.width,height/decoded.canvas.height)
          const w = decoded.canvas.width*scale; const h = decoded.canvas.height*scale
          ctx.drawImage(decoded.canvas,(width-w)/2,(height-h)/2,w,h)
        } else throw new Error(`${clip.name}: ${time.toFixed(2)}초의 영상 프레임을 읽을 수 없습니다.`)
      }
      ctx.scale(width/project.canvas.width,height/project.canvas.height)
      const active = clips.filter(c => time >= c.start && time < clipEnd(c))
      for (const c of active.filter(c => c.image)) {
        const style = c.image!; ctx.globalAlpha = style.opacity
        ctx.drawImage(images.get(style.assetId)!,style.x-style.width/2,style.y-style.height/2,style.width,style.height)
      }
      ctx.globalAlpha = 1
      for (const c of active.filter(c => c.text)) drawText(ctx,c.text!,project.canvas.width)
      await video.add(time,Math.min(1/fps,project.duration-time))
      if (audio && mixed && (frame % fps === 0 || frame === frames-1)) {
        const end = Math.min(mixed.length, Math.round((time+1)*48000))
        if (end > audioOffset) {
          const chunk = new AudioBuffer({numberOfChannels:2,length:end-audioOffset,sampleRate:48000})
          for (let channel = 0; channel < 2; channel++) chunk.copyToChannel(mixed.getChannelData(channel).subarray(audioOffset,end),channel)
          await audio.add(chunk); audioOffset = end
        }
      }
      if (frame % 5 === 0) { progress({percent:Math.round(5+frame/frames*92),stage:'MP4 영상 만드는 중…'}); await new Promise<void>(resolve => setTimeout(resolve,0)) }
    }
    check(); progress({percent:98,stage:'MP4 파일 마무리 중…'})
    await output.finalize(); check(); finished = true
    progress({percent:100,stage:'내보내기 완료'})
    return new Blob([target.buffer!],{type:'video/mp4'})
  } finally {
    if (output && !finished) await output.cancel().catch(() => {})
    inputs.forEach(input => input.dispose()); images.forEach(image => image.close())
  }
}
