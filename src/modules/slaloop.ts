/**
 * SLA Loop Module
 * Animates the ERA three-phase closed-loop: Self-Awareness → Self-Learning → Self-Adaptation
 * Paper reference: Section III-D, Fig. 1
 */

type Phase = 'awareness' | 'learning' | 'adaptation'

interface LoopState {
  phase:      Phase
  tick:       number
  speed:      number
  running:    boolean
  rssi:       number    // dBm
  cpu:        number    // %
  rtt:        number    // ms
  predLoad:   number    // %
  risk:       number    // %
  pods:       number
  bandwidth:  number    // Mbps
  logEntries: LogEntry[]
}

interface LogEntry {
  time:  string
  msg:   string
  type:  'info' | 'warn' | 'action' | 'alert'
}

const PHASE_DURATION_MS = 1800  // ms per phase at 1× speed

let state: LoopState = {
  phase: 'awareness', tick: 0, speed: 1, running: false,
  rssi: -55, cpu: 42, rtt: 1.2,
  predLoad: 48, risk: 15, pods: 3, bandwidth: 800,
  logEntries: [],
}

let rafHandle: number | null = null
let lastTime: number = 0
let phaseElapsed: number = 0

// ---- Canvas diagram ----
function drawDiagram(canvas: HTMLCanvasElement, phase: Phase, progress: number): void {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#0d1730'
  ctx.fillRect(0, 0, W, H)

  const cx = W / 2, cy = H / 2
  const r  = Math.min(W, H) * 0.32

  // Phases placed on a circle
  const phases: { id: Phase; label: string; icon: string; angle: number }[] = [
    { id: 'awareness',  label: 'Self-Awareness',  icon: '👁',  angle: -Math.PI / 2 },
    { id: 'learning',   label: 'Self-Learning',   icon: '🧠', angle: -Math.PI / 2 + (2 * Math.PI / 3) },
    { id: 'adaptation', label: 'Self-Adaptation', icon: '⚡', angle: -Math.PI / 2 + (4 * Math.PI / 3) },
  ]

  // Connecting arcs (arrows)
  phases.forEach((_ph, i) => {
    const from = phases[i]
    const to   = phases[(i + 1) % 3]
    const fx = cx + r * Math.cos(from.angle)
    const fy = cy + r * Math.sin(from.angle)
    const tx = cx + r * Math.cos(to.angle)
    const ty = cy + r * Math.sin(to.angle)

    // Animated arc
    const isActive = from.id === phase
    const acx = cx + r * 0.55 * Math.cos((from.angle + to.angle) / 2)
    const acy = cy + r * 0.55 * Math.sin((from.angle + to.angle) / 2)

    ctx.strokeStyle = isActive ? '#00d4ff' : '#1e2d52'
    ctx.lineWidth = isActive ? 2.5 : 1.5
    ctx.beginPath()
    ctx.moveTo(fx, fy)
    ctx.quadraticCurveTo(acx, acy, tx, ty)
    ctx.stroke()

    // Arrowhead
    const angle = Math.atan2(ty - acy, tx - acx)
    ctx.fillStyle = isActive ? '#00d4ff' : '#1e2d52'
    ctx.beginPath()
    ctx.moveTo(tx, ty)
    ctx.lineTo(tx - 10 * Math.cos(angle - 0.4), ty - 10 * Math.sin(angle - 0.4))
    ctx.lineTo(tx - 10 * Math.cos(angle + 0.4), ty - 10 * Math.sin(angle + 0.4))
    ctx.closePath()
    ctx.fill()

    // Moving dot along arc
    if (isActive) {
      const t  = progress
      const px = (1-t)*(1-t)*fx + 2*(1-t)*t*acx + t*t*tx
      const py = (1-t)*(1-t)*fy + 2*(1-t)*t*acy + t*t*ty
      ctx.beginPath()
      ctx.arc(px, py, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#00d4ff'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(px, py, 9, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0,212,255,0.3)'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  })

  // Center ERA label
  ctx.fillStyle = '#1e2d52'
  ctx.beginPath()
  ctx.arc(cx, cy, 42, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#00d4ff'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = '#00d4ff'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ERA', cx, cy - 8)
  ctx.fillStyle = '#7986cb'
  ctx.font = '9px sans-serif'
  ctx.fillText('SLA Loop', cx, cy + 8)
  ctx.textBaseline = 'alphabetic'

  // Phase nodes
  phases.forEach(ph => {
    const nx = cx + r * Math.cos(ph.angle)
    const ny = cy + r * Math.sin(ph.angle)
    const isActive = ph.id === phase
    const nodeR = isActive ? 44 : 38

    // Glow
    if (isActive) {
      const grd = ctx.createRadialGradient(nx, ny, nodeR * 0.5, nx, ny, nodeR * 2)
      grd.addColorStop(0, 'rgba(0,212,255,0.2)')
      grd.addColorStop(1, 'rgba(0,212,255,0)')
      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.arc(nx, ny, nodeR * 2, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.fillStyle = isActive ? '#0d2246' : '#0d1730'
    ctx.beginPath()
    ctx.arc(nx, ny, nodeR, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = isActive ? '#00d4ff' : '#1e2d52'
    ctx.lineWidth = isActive ? 2.5 : 1.5
    ctx.stroke()

    // Icon
    ctx.font = `${isActive ? 20 : 16}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(ph.icon, nx, ny - 8)

    // Label
    ctx.font = `${isActive ? 'bold 9' : '8'}px sans-serif`
    ctx.fillStyle = isActive ? '#00d4ff' : '#4a5568'
    // Wrap label
    const words = ph.label.split('-')
    words.forEach((w, wi) => ctx.fillText(w, nx, ny + 7 + wi * 11))
    ctx.textBaseline = 'alphabetic'
  })
}

function setPhaseActive(phase: Phase): void {
  const phases: Phase[] = ['awareness', 'learning', 'adaptation']
  phases.forEach(p => {
    const el = document.getElementById(`sla-phase-${p}`)
    if (el) {
      el.classList.toggle('active-phase', p === phase)
    }
  })
}

function rndRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function fmtTime(): string {
  const d = new Date()
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}.${d.getMilliseconds().toString().padStart(3,'0')}`
}

function addLog(msg: string, type: LogEntry['type'] = 'info'): void {
  state.logEntries.unshift({ time: fmtTime(), msg, type })
  if (state.logEntries.length > 40) state.logEntries.pop()
  const el = document.getElementById('sla-log')
  if (!el) return
  el.innerHTML = state.logEntries.slice(0, 20).map(e =>
    `<div class="log-entry ${e.type}"><span class="ts">${e.time}</span>${e.msg}</div>`
  ).join('')
}

function tickAwareness(): void {
  state.rssi    = rndRange(-70, -45)
  state.cpu     = rndRange(30, 85)
  state.rtt     = rndRange(0.8, 3.5)

  const set = (id: string, v: string) => {
    const el = document.getElementById(id)
    if (el) el.textContent = v
  }
  set('sla-rssi', state.rssi.toFixed(1) + ' dBm')
  set('sla-cpu',  state.cpu.toFixed(1) + '%')
  set('sla-rtt',  state.rtt.toFixed(2) + ' ms')

  if (state.cpu > 75) addLog(`High CPU utilisation: ${state.cpu.toFixed(1)}%`, 'warn')
  else if (state.rssi < -65) addLog(`Weak RSSI: ${state.rssi.toFixed(1)} dBm`, 'warn')
  else addLog(`KPI nominal — RSSI ${state.rssi.toFixed(1)} dBm, CPU ${state.cpu.toFixed(1)}%`, 'info')
}

function tickLearning(): void {
  state.predLoad = Math.min(100, state.cpu * (0.9 + Math.random() * 0.2))
  state.risk     = state.predLoad > 70 ? rndRange(60, 90) : rndRange(5, 30)

  const set = (id: string, v: string) => {
    const el = document.getElementById(id)
    if (el) el.textContent = v
  }
  set('sla-pred-load', state.predLoad.toFixed(1) + '%')
  set('sla-risk',      state.risk.toFixed(1) + '%')

  const policy = state.risk > 60
    ? 'Scale-Up (Proactive)'
    : state.cpu < 35
    ? 'Scale-Down'
    : 'Hold'
  set('sla-policy', policy)
  addLog(`Autoformer: pred-load=${state.predLoad.toFixed(0)}%, risk=${state.risk.toFixed(0)}% → ${policy}`, 'info')
}

function tickAdaptation(): void {
  if (state.risk > 60 && state.pods < 12) {
    state.pods += 2
    addLog(`Scale-Up: pods ${state.pods - 2} → ${state.pods}`, 'action')
  } else if (state.cpu < 35 && state.pods > 1) {
    state.pods = Math.max(1, state.pods - 1)
    addLog(`Scale-Down: pods ${state.pods + 1} → ${state.pods}`, 'action')
  } else {
    addLog('No scaling action required', 'info')
  }

  if (state.rssi < -65) {
    addLog('Handover triggered: 5G → Wi-Fi 6 (Socat anchor)', 'action')
  }
  state.bandwidth = rndRange(700, 950)

  const set = (id: string, v: string) => {
    const el = document.getElementById(id)
    if (el) el.textContent = v
  }
  set('sla-action', state.risk > 60 ? 'Scale-Up' : state.cpu < 35 ? 'Scale-Down' : 'Hold')
  set('sla-pods',   state.pods.toString())
  set('sla-bw',     state.bandwidth.toFixed(0) + ' Mbps')
}

function advancePhase(): void {
  const order: Phase[] = ['awareness', 'learning', 'adaptation']
  const idx = order.indexOf(state.phase)
  const next = order[(idx + 1) % 3] as Phase

  switch (state.phase) {
    case 'awareness':  tickAwareness();  break
    case 'learning':   tickLearning();   break
    case 'adaptation': tickAdaptation(); break
  }

  state.phase = next
  setPhaseActive(next)
  state.tick++
}

function loop(ts: number): void {
  if (!state.running) return
  const dt = ts - lastTime
  lastTime = ts
  phaseElapsed += dt * state.speed

  const canvas = document.getElementById('slaloop-canvas') as HTMLCanvasElement | null
  if (canvas) {
    const progress = Math.min(phaseElapsed / PHASE_DURATION_MS, 1)
    drawDiagram(canvas, state.phase, progress)
  }

  if (phaseElapsed >= PHASE_DURATION_MS) {
    phaseElapsed = 0
    advancePhase()
  }

  rafHandle = requestAnimationFrame(loop)
}

export function initSLALoop(): void {
  const canvas = document.getElementById('slaloop-canvas') as HTMLCanvasElement | null
  if (canvas) drawDiagram(canvas, 'awareness', 0)

  document.getElementById('sla-start')?.addEventListener('click', () => {
    if (!state.running) {
      state.running = true
      lastTime = performance.now()
      phaseElapsed = 0
      rafHandle = requestAnimationFrame(loop)
    }
  })

  document.getElementById('sla-pause')?.addEventListener('click', () => {
    state.running = false
    if (rafHandle !== null) cancelAnimationFrame(rafHandle)
  })

  document.getElementById('sla-reset')?.addEventListener('click', () => {
    state.running = false
    if (rafHandle !== null) cancelAnimationFrame(rafHandle)
    state.phase = 'awareness'
    state.tick  = 0
    state.logEntries = []
    phaseElapsed = 0
    setPhaseActive('awareness')
    const logEl = document.getElementById('sla-log')
    if (logEl) logEl.innerHTML = ''
    const set = (id: string) => { const el = document.getElementById(id); if (el) el.textContent = '—' }
    ['sla-rssi','sla-cpu','sla-rtt','sla-pred-load','sla-risk','sla-policy','sla-action','sla-pods','sla-bw'].forEach(set)
    if (canvas) drawDiagram(canvas, 'awareness', 0)
  })

  const speedSlider = document.getElementById('sla-speed') as HTMLInputElement | null
  speedSlider?.addEventListener('input', () => {
    state.speed = parseFloat(speedSlider.value)
    const d = document.getElementById('sla-speed-val')
    if (d) d.textContent = state.speed.toFixed(1) + '×'
  })
}
