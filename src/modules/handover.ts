/**
 * Handover Module
 * Simulates Multi-RAT seamless handover (5G-NR ↔ Wi-Fi 6)
 * Paper reference: Section V-B, Fig. 4
 *
 * Paper data (5G→WiFi / WiFi→5G):
 *   GStreamer: 21.45 s / 22.28 s
 *   FFmpeg:     2.15 s /  2.20 s
 *   Socat:      0.07 s /  0.29 s
 *
 * KPI target: < 1 s
 */

import { drawGroupedBar } from './chartUtils'

interface HOParams {
  direction: '5g-wifi' | 'wifi-5g'
  rssi:      number    // RSSI threshold (dBm)
  jitter:    number    // multiplicative jitter factor
}

interface HOResult {
  gstreamer: number
  ffmpeg:    number
  socat:     number
}

// Paper values
const PAPER: Record<'5g-wifi' | 'wifi-5g', HOResult> = {
  '5g-wifi': { gstreamer: 21.45, ffmpeg: 2.15, socat: 0.07 },
  'wifi-5g': { gstreamer: 22.28, ffmpeg: 2.20, socat: 0.29 },
}

function simulate(p: HOParams): HOResult {
  const base = PAPER[p.direction]
  // RSSI penalty: stricter threshold → slightly longer HO for GStreamer/FFmpeg
  const rssiFactor = 1 + Math.max(0, (-60 - p.rssi) / 60) * 0.3
  const j = p.jitter

  return {
    gstreamer: base.gstreamer * j * rssiFactor * (0.9 + Math.random() * 0.2),
    ffmpeg:    base.ffmpeg    * j * rssiFactor * (0.9 + Math.random() * 0.2),
    socat:     base.socat     * j              * (0.85 + Math.random() * 0.3),
  }
}

let animTimer: number | null = null
let chartInst: unknown = null

function drawChart(res: HOResult): void {
  const canvas = document.getElementById('handover-chart') as HTMLCanvasElement | null
  if (!canvas) return
  const kpi = 1.0
  chartInst = drawGroupedBar(canvas, chartInst, {
    labels: ['GStreamer', 'FFmpeg', 'Socat'],
    datasets: [
      {
        label: 'Handover Time (s)',
        data: [res.gstreamer, res.ffmpeg, res.socat].map(v => +v.toFixed(3)),
        color: ((_v) => '#00d4ff')(''),
      },
    ],
    yMax: Math.max(res.gstreamer * 1.1, 5),
    yLabel: ' s',
  })

  // Re-draw with colour coding
  const canvas2 = document.getElementById('handover-chart') as HTMLCanvasElement | null
  if (!canvas2) return
  const dpr = window.devicePixelRatio || 1
  const ctx = canvas2.getContext('2d')!
  ctx.save()
  ctx.scale(1 / dpr, 1 / dpr)

  const W = canvas2.width / dpr
  const H = canvas2.height / dpr
  // KPI line
  const plotTop    = 24
  const plotBottom = H - 52
  const plotLeft   = 60
  const plotRight  = W - 24
  const plotH      = plotBottom - plotTop
  const yMax       = Math.max(res.gstreamer * 1.1, 5)

  const kpiY = plotTop + plotH - (kpi / yMax) * plotH
  ctx.strokeStyle = '#ffb300'
  ctx.lineWidth   = 1.5 * dpr
  ctx.setLineDash([6 * dpr, 4 * dpr])
  ctx.beginPath()
  ctx.moveTo(plotLeft * dpr, kpiY * dpr)
  ctx.lineTo(plotRight * dpr, kpiY * dpr)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle   = '#ffb300'
  ctx.font        = `${10 * dpr}px sans-serif`
  ctx.textAlign   = 'right'
  ctx.fillText('KPI < 1 s', plotRight * dpr, (kpiY - 4) * dpr)
  ctx.restore()
}

function drawAnimation(
  canvas: HTMLCanvasElement,
  direction: '5g-wifi' | 'wifi-5g',
  mechanism: 'gstreamer' | 'ffmpeg' | 'socat',
  progress: number  // 0..1
): void {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#0d1730'
  ctx.fillRect(0, 0, W, H)

  // Tower positions
  const t5gX   = direction === '5g-wifi' ? 60  : W - 60
  const wifiX  = direction === '5g-wifi' ? W - 60 : 60
  const towerY = H / 2 - 20

  const draw5GTower = (x: number): void => {
    ctx.fillStyle = '#ff6b35'
    ctx.fillRect(x - 6, towerY - 30, 12, 50)
    ctx.fillRect(x - 20, towerY + 20, 40, 8)
    ctx.fillStyle = '#ff6b35'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('5G-NR', x, towerY - 36)
  }
  const drawWiFiTower = (x: number): void => {
    ctx.strokeStyle = '#00d4ff'
    ctx.lineWidth = 2
    for (let r = 10; r <= 30; r += 10) {
      ctx.beginPath()
      ctx.arc(x, towerY, r, Math.PI, 2 * Math.PI)
      ctx.stroke()
    }
    ctx.fillStyle = '#00d4ff'
    ctx.fillRect(x - 3, towerY, 6, 30)
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Wi-Fi 6', x, towerY - 36)
  }

  draw5GTower(t5gX)
  drawWiFiTower(wifiX)

  // UE position
  const ueX = t5gX + (wifiX - t5gX) * progress
  const ueY = towerY + 40

  // Signal beam to current tower
  const nearX = progress < 0.5 ? t5gX : wifiX
  const alpha = progress < 0.5 ? 1 - 2 * progress : 2 * (progress - 0.5)
  ctx.strokeStyle = `rgba(0,212,255,${0.3 + alpha * 0.4})`
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(nearX, towerY)
  ctx.lineTo(ueX, ueY)
  ctx.stroke()
  ctx.setLineDash([])

  // UE (car icon)
  ctx.fillStyle = '#00e676'
  ctx.beginPath()
  ctx.roundRect(ueX - 14, ueY - 8, 28, 16, [4])
  ctx.fill()
  ctx.fillStyle = '#0d1730'
  ctx.fillRect(ueX - 10, ueY - 6, 8, 8)
  ctx.fillRect(ueX + 2,  ueY - 6, 8, 8)

  // Mechanism label
  ctx.fillStyle = '#7986cb'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'center'
  const mecColors = { gstreamer: '#ff4560', ffmpeg: '#ffb300', socat: '#00e676' }
  ctx.fillStyle = mecColors[mechanism]
  ctx.fillText(mechanism.toUpperCase(), W / 2, H - 10)

  // Progress bar
  ctx.fillStyle = '#1e2d52'
  ctx.fillRect(60, H - 22, W - 120, 6)
  ctx.fillStyle = mecColors[mechanism]
  ctx.fillRect(60, H - 22, (W - 120) * progress, 6)
}

function runAnimation(
  direction: '5g-wifi' | 'wifi-5g',
  mechanism: 'gstreamer' | 'ffmpeg' | 'socat',
  durationMs: number
): void {
  const canvas = document.getElementById('handover-anim') as HTMLCanvasElement | null
  if (!canvas) return
  if (animTimer !== null) cancelAnimationFrame(animTimer)

  const start = performance.now()
  const animate = (now: number): void => {
    const progress = Math.min((now - start) / durationMs, 1)
    drawAnimation(canvas, direction, mechanism, progress)
    if (progress < 1) animTimer = requestAnimationFrame(animate)
    else animTimer = null
  }
  animTimer = requestAnimationFrame(animate)
}

export function initHandover(): void {
  const refresh = (): void => {
    const dir = (document.querySelector<HTMLInputElement>('input[name="ho-dir"]:checked')?.value ?? '5g-wifi') as '5g-wifi' | 'wifi-5g'
    const rssi   = parseFloat((document.getElementById('rssi')   as HTMLInputElement).value)
    const jitter = parseFloat((document.getElementById('jitter') as HTMLInputElement).value)
    const res = simulate({ direction: dir, rssi, jitter })
    drawChart(res)

    // Run animation for all three mechanisms sequentially
    const animDur = { gstreamer: 2400, ffmpeg: 1600, socat: 800 }
    let t = 0
    const mechs: ('gstreamer' | 'ffmpeg' | 'socat')[] = ['gstreamer', 'ffmpeg', 'socat']
    mechs.forEach(m => {
      setTimeout(() => runAnimation(dir, m, animDur[m]), t)
      t += animDur[m] + 200
    })
  }

  const rssiSlider = document.getElementById('rssi') as HTMLInputElement | null
  rssiSlider?.addEventListener('input', () => {
    const v = document.getElementById('rssi-val')
    if (v) v.textContent = rssiSlider.value
  })
  const jitterSlider = document.getElementById('jitter') as HTMLInputElement | null
  jitterSlider?.addEventListener('input', () => {
    const v = document.getElementById('jitter-val')
    if (v) v.textContent = parseFloat(jitterSlider.value).toFixed(1) + '×'
  })
  document.querySelectorAll<HTMLInputElement>('input[name="ho-dir"]').forEach(r => r.addEventListener('change', refresh))
  document.getElementById('run-handover')?.addEventListener('click', refresh)

  refresh()
}
