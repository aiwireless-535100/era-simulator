/**
 * Lightweight chart utilities using the HTML5 Canvas API.
 * No external dependencies — fully self-contained.
 */

const COLORS = {
  gridLine:   'rgba(30,45,82,0.8)',
  axisLabel:  '#4a5568',
  tickLabel:  '#7986cb',
  legend:     '#e8eaf6',
}

export interface BarDataset {
  label: string
  data:  number[]
  color: string
}
export interface BarOptions {
  labels:   string[]
  datasets: BarDataset[]
  yMax?:    number
  yLabel?:  string
}

export interface LineDataset {
  label: string
  data:  number[]
  color: string
  dashed?: boolean
}
export interface LineOptions {
  labels:    string[]
  datasets:  LineDataset[]
  yMax?:     number
  yMin?:     number
  yLabel?:   string
  xLabel?:   string
  threshold?: { value: number; color: string; label: string }
}

// ---- Helpers ----
function clearCanvas(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#0d1730'
  ctx.fillRect(0, 0, w, h)
}

function computeLayout(w: number, h: number) {
  const pad = { top: 24, right: 24, bottom: 52, left: 60 }
  return {
    pad,
    plotW: w - pad.left - pad.right,
    plotH: h - pad.top  - pad.bottom,
  }
}

// ---- Grouped Bar Chart ----
export function drawGroupedBar(
  canvas: HTMLCanvasElement,
  _prev: unknown,
  opts: BarOptions
): unknown {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width  = rect.width  * dpr || 600 * dpr
  canvas.height = (rect.height || 220) * dpr
  canvas.style.width  = (rect.width  || 600) + 'px'
  canvas.style.height = (rect.height || 220) + 'px'

  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  const W = canvas.width  / dpr
  const H = canvas.height / dpr

  clearCanvas(ctx, W, H)
  const { pad, plotW, plotH } = computeLayout(W, H)

  const yMax    = opts.yMax ?? Math.max(...opts.datasets.flatMap(d => d.data)) * 1.1
  const nGroups = opts.labels.length
  const nDS     = opts.datasets.length
  const groupW  = plotW / nGroups
  const barW    = (groupW * 0.7) / nDS

  // Grid
  const nTicks = 5
  ctx.lineWidth = 1
  for (let i = 0; i <= nTicks; i++) {
    const yVal = (yMax / nTicks) * i
    const yPx  = pad.top + plotH - (yVal / yMax) * plotH
    ctx.strokeStyle = COLORS.gridLine
    ctx.beginPath(); ctx.moveTo(pad.left, yPx); ctx.lineTo(pad.left + plotW, yPx); ctx.stroke()
    ctx.fillStyle = COLORS.tickLabel
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(yVal.toFixed(0) + (opts.yLabel ?? ''), pad.left - 5, yPx + 3)
  }

  // Bars
  opts.datasets.forEach((ds, di) => {
    ds.data.forEach((val, gi) => {
      const x = pad.left + gi * groupW + (groupW * 0.15) + di * (barW + 1)
      const barH = (val / yMax) * plotH
      const y    = pad.top + plotH - barH

      // Gradient fill
      const grad = ctx.createLinearGradient(x, y, x, y + barH)
      grad.addColorStop(0, ds.color)
      grad.addColorStop(1, ds.color + '55')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.roundRect(x, y, barW - 1, barH, [3, 3, 0, 0])
      ctx.fill()

      // Value label
      ctx.fillStyle = COLORS.legend
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(val.toFixed(1), x + barW / 2, y - 4)
    })
  })

  // X-axis labels
  ctx.fillStyle = COLORS.tickLabel
  ctx.font = '10px sans-serif'
  ctx.textAlign = 'center'
  opts.labels.forEach((lbl, gi) => {
    const x = pad.left + gi * groupW + groupW / 2
    ctx.fillText(lbl, x, pad.top + plotH + 18)
  })

  // Legend
  const legendY = pad.top + plotH + 36
  let lx = pad.left
  opts.datasets.forEach(ds => {
    ctx.fillStyle = ds.color
    ctx.fillRect(lx, legendY - 8, 12, 8)
    ctx.fillStyle = COLORS.legend
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(ds.label, lx + 16, legendY)
    lx += ctx.measureText(ds.label).width + 40
  })

  return null
}

// ---- Line Chart ----
export function drawLineChart(
  canvas: HTMLCanvasElement,
  _prev: unknown,
  opts: LineOptions
): unknown {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width  = (rect.width  || 600) * dpr
  canvas.height = (rect.height || 300) * dpr
  canvas.style.width  = (rect.width  || 600) + 'px'
  canvas.style.height = (rect.height || 300) + 'px'

  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  const W = canvas.width  / dpr
  const H = canvas.height / dpr

  clearCanvas(ctx, W, H)
  const { pad, plotW, plotH } = computeLayout(W, H)

  const allVals = opts.datasets.flatMap(d => d.data)
  const yMin = opts.yMin ?? Math.min(0, ...allVals)
  const yMax = opts.yMax ?? Math.max(...allVals) * 1.1
  const yRange = yMax - yMin
  const n = opts.labels.length

  // Grid + Y ticks
  const nTicks = 5
  ctx.lineWidth = 1
  for (let i = 0; i <= nTicks; i++) {
    const yVal = yMin + (yRange / nTicks) * i
    const yPx  = pad.top + plotH - ((yVal - yMin) / yRange) * plotH
    ctx.strokeStyle = COLORS.gridLine
    ctx.setLineDash([3, 4])
    ctx.beginPath(); ctx.moveTo(pad.left, yPx); ctx.lineTo(pad.left + plotW, yPx); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = COLORS.tickLabel
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(yVal.toFixed(1) + (opts.yLabel ?? ''), pad.left - 5, yPx + 3)
  }

  // Threshold
  if (opts.threshold) {
    const yPx = pad.top + plotH - ((opts.threshold.value - yMin) / yRange) * plotH
    ctx.strokeStyle = opts.threshold.color
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.beginPath(); ctx.moveTo(pad.left, yPx); ctx.lineTo(pad.left + plotW, yPx); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = opts.threshold.color
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(opts.threshold.label, pad.left + plotW, yPx - 4)
  }

  // X-axis labels (sample every N)
  const step = Math.ceil(n / 12)
  ctx.fillStyle = COLORS.tickLabel
  ctx.font = '9px sans-serif'
  ctx.textAlign = 'center'
  for (let i = 0; i < n; i += step) {
    const xPx = pad.left + (i / (n - 1)) * plotW
    ctx.fillText(opts.labels[i], xPx, pad.top + plotH + 14)
  }

  // Lines
  opts.datasets.forEach(ds => {
    if (ds.data.length < 2) return
    ctx.lineWidth = 2
    ctx.strokeStyle = ds.color
    if (ds.dashed) ctx.setLineDash([6, 4])
    ctx.beginPath()
    ds.data.forEach((val, i) => {
      const xPx = pad.left + (i / (ds.data.length - 1)) * plotW
      const yPx = pad.top  + plotH - ((val - yMin) / yRange) * plotH
      i === 0 ? ctx.moveTo(xPx, yPx) : ctx.lineTo(xPx, yPx)
    })
    ctx.stroke()
    ctx.setLineDash([])

    // Area fill
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH)
    grad.addColorStop(0, ds.color + '33')
    grad.addColorStop(1, ds.color + '00')
    ctx.beginPath()
    ds.data.forEach((val, i) => {
      const xPx = pad.left + (i / (ds.data.length - 1)) * plotW
      const yPx = pad.top  + plotH - ((val - yMin) / yRange) * plotH
      i === 0 ? ctx.moveTo(xPx, yPx) : ctx.lineTo(xPx, yPx)
    })
    ctx.lineTo(pad.left + plotW, pad.top + plotH)
    ctx.lineTo(pad.left, pad.top + plotH)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()
  })

  // Legend
  const legendY = pad.top + plotH + 38
  let lx = pad.left
  opts.datasets.forEach(ds => {
    ctx.fillStyle = ds.color
    ctx.fillRect(lx, legendY - 8, 18, 3)
    ctx.fillStyle = COLORS.legend
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(ds.label, lx + 22, legendY)
    lx += ctx.measureText(ds.label).width + 52
  })

  return null
}

// ---- Scatter Chart ----
export function drawScatterChart(
  canvas: HTMLCanvasElement,
  _prev: unknown,
  opts: {
    datasets: Array<{ label: string; data: number[]; color: string; size?: number }>
    yMax?: number
    yLabel?: string
    threshold?: { value: number; color: string; label: string }
  }
): unknown {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width  = (rect.width  || 600) * dpr
  canvas.height = (rect.height || 320) * dpr
  canvas.style.width  = (rect.width  || 600) + 'px'
  canvas.style.height = (rect.height || 320) + 'px'

  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  const W = canvas.width  / dpr
  const H = canvas.height / dpr

  clearCanvas(ctx, W, H)
  const { pad, plotW, plotH } = computeLayout(W, H)

  const n = opts.datasets[0]?.data.length ?? 100
  const allVals = opts.datasets.flatMap(d => d.data)
  const yMax = opts.yMax ?? Math.max(...allVals) * 1.1

  // Grid
  ctx.lineWidth = 1
  for (let i = 0; i <= 5; i++) {
    const yVal = (yMax / 5) * i
    const yPx  = pad.top + plotH - (yVal / yMax) * plotH
    ctx.strokeStyle = COLORS.gridLine
    ctx.setLineDash([3, 4])
    ctx.beginPath(); ctx.moveTo(pad.left, yPx); ctx.lineTo(pad.left + plotW, yPx); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = COLORS.tickLabel
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(yVal.toFixed(1), pad.left - 5, yPx + 3)
  }

  // X labels
  const step = Math.ceil(n / 10)
  ctx.fillStyle = COLORS.tickLabel
  ctx.font = '9px sans-serif'
  ctx.textAlign = 'center'
  for (let i = 0; i < n; i += step) {
    const xPx = pad.left + (i / (n - 1)) * plotW
    ctx.fillText((i + 1).toString(), xPx, pad.top + plotH + 14)
  }

  // Threshold
  if (opts.threshold) {
    const yPx = pad.top + plotH - (opts.threshold.value / yMax) * plotH
    ctx.strokeStyle = opts.threshold.color
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.beginPath(); ctx.moveTo(pad.left, yPx); ctx.lineTo(pad.left + plotW, yPx); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = opts.threshold.color
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(opts.threshold.label, pad.left + plotW, yPx - 4)
  }

  // Dots + trend line
  opts.datasets.forEach(ds => {
    const r = ds.size ?? 3
    ds.data.forEach((val, i) => {
      const xPx = pad.left + (i / (n - 1)) * plotW
      const yPx = pad.top  + plotH - (Math.min(val, yMax) / yMax) * plotH
      ctx.beginPath()
      ctx.arc(xPx, yPx, r, 0, Math.PI * 2)
      ctx.fillStyle = ds.color + 'aa'
      ctx.fill()
    })

    // Moving average line
    const ma = movingAvg(ds.data, 8)
    ctx.lineWidth = 2
    ctx.strokeStyle = ds.color
    ctx.beginPath()
    ma.forEach((val, i) => {
      const xPx = pad.left + (i / (n - 1)) * plotW
      const yPx = pad.top  + plotH - (Math.min(val, yMax) / yMax) * plotH
      i === 0 ? ctx.moveTo(xPx, yPx) : ctx.lineTo(xPx, yPx)
    })
    ctx.stroke()
  })

  // Legend
  const legendY = pad.top + plotH + 38
  let lx = pad.left
  opts.datasets.forEach(ds => {
    ctx.fillStyle = ds.color
    ctx.beginPath(); ctx.arc(lx + 5, legendY - 4, 5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = COLORS.legend
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(ds.label, lx + 14, legendY)
    lx += ctx.measureText(ds.label).width + 44
  })

  return null
}

function movingAvg(data: number[], win: number): number[] {
  return data.map((_, i) => {
    const start = Math.max(0, i - Math.floor(win / 2))
    const end   = Math.min(data.length, start + win)
    const slice = data.slice(start, end)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}
