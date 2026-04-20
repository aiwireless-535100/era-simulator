/**
 * Bandwidth Module
 * Simulates ERA dynamic bandwidth control (network slicing)
 * Paper reference: Section V-B-2, Fig. 5
 *
 * Rate sequence from paper: 1000 → 500 → 100 → 600 → 900 Mbps
 * Measured throughput closely tracks configured limits.
 */

import { drawLineChart } from './chartUtils'

interface BwStep { target: number; durationSec: number }

const PAPER_STEPS: BwStep[] = [
  { target: 1000, durationSec: 8  },
  { target:  500, durationSec: 8  },
  { target:  100, durationSec: 8  },
  { target:  600, durationSec: 8  },
  { target:  900, durationSec: 8  },
]

let chartInst: unknown = null
let currentSteps: BwStep[] = [...PAPER_STEPS]

function generateThroughput(steps: BwStep[], adaptDelayMs: number, overshootFactor: number): {
  time: number[]
  configured: number[]
  measured: number[]
} {
  const time: number[] = []
  const configured: number[] = []
  const measured: number[] = []

  const samplesPerSec = 10
  let t = 0
  let prevTarget = steps[0]?.target ?? 1000

  steps.forEach(step => {
    const nSamples = step.durationSec * samplesPerSec
    const adaptSamples = Math.round((adaptDelayMs / 1000) * samplesPerSec)

    for (let i = 0; i < nSamples; i++) {
      time.push(parseFloat(t.toFixed(2)))
      configured.push(step.target)

      let meas: number
      if (i < adaptSamples) {
        // Transition: interpolate from prevTarget to new target with overshoot
        const frac   = i / adaptSamples
        const over   = step.target > prevTarget ? overshootFactor : -overshootFactor
        const peak   = step.target * (1 + over * Math.sin(Math.PI * frac))
        meas = prevTarget + (peak - prevTarget) * frac
      } else {
        // Steady state: small noise around target
        const noise = (Math.random() - 0.5) * step.target * 0.01
        meas = step.target + noise
      }
      measured.push(Math.max(0, meas))
      t += 1 / samplesPerSec
    }
    prevTarget = step.target
  })

  return { time, configured, measured }
}

function computeStats(configured: number[], measured: number[]): { trackingErr: string; maxOvershoot: string; settling: string } {
  let errSum = 0, maxOver = 0
  configured.forEach((c, i) => {
    const err = Math.abs(measured[i] - c) / c
    errSum += err
    if (measured[i] > c) maxOver = Math.max(maxOver, measured[i] - c)
  })
  return {
    trackingErr:  (errSum / configured.length * 100).toFixed(2) + '%',
    maxOvershoot: maxOver.toFixed(1) + ' Mbps',
    settling:     '~' + ((parseFloat((document.getElementById('adapt-delay') as HTMLInputElement)?.value ?? '200') / 1000) + 0.2).toFixed(1) + ' s',
  }
}

function redraw(): void {
  const adaptDelay  = parseFloat((document.getElementById('adapt-delay')  as HTMLInputElement)?.value ?? '200')
  const overshoot   = parseFloat((document.getElementById('overshoot')     as HTMLInputElement)?.value ?? '0.02')
  const { time, configured, measured } = generateThroughput(currentSteps, adaptDelay, overshoot)

  const labels = time.map(t => t.toFixed(1))
  const canvas = document.getElementById('bandwidth-chart') as HTMLCanvasElement | null
  if (!canvas) return

  chartInst = drawLineChart(canvas, chartInst, {
    labels,
    datasets: [
      { label: 'Configured Limit', data: configured, color: '#ffb300', dashed: true },
      { label: 'ERA Throughput',   data: measured,   color: '#00d4ff' },
    ],
    yMin: 0,
    yMax: Math.max(...configured) * 1.12,
    yLabel: ' Mbps',
    xLabel: 'Time (s)',
  })

  const stats = computeStats(configured, measured)
  const s = (id: string, val: string): void => {
    const el = document.getElementById(id)
    if (el) el.textContent = val
  }
  s('bw-tracking-err',  stats.trackingErr)
  s('bw-max-overshoot', stats.maxOvershoot)
  s('bw-settling',      stats.settling)
}

function renderStepsList(): void {
  const container = document.getElementById('bw-steps-list')
  if (!container) return
  container.innerHTML = ''
  currentSteps.forEach((step, i) => {
    const row = document.createElement('div')
    row.className = 'bw-step-row'
    row.innerHTML = `
      <span style="color:#7986cb;font-size:0.75rem;min-width:40px">Step ${i + 1}</span>
      <input type="number" value="${step.target}" min="10" max="10000" step="50" title="Target Mbps" />
      <span style="color:#4a5568;font-size:0.75rem">Mbps</span>
      <input type="number" value="${step.durationSec}" min="1" max="30" step="1" title="Duration (s)" style="width:50px" />
      <span style="color:#4a5568;font-size:0.75rem">s</span>
      <button title="Remove" onclick="">✕</button>
    `
    const [tgtInput, durInput] = row.querySelectorAll<HTMLInputElement>('input')
    tgtInput.addEventListener('change', () => {
      currentSteps[i].target = parseFloat(tgtInput.value)
      redraw()
    })
    durInput.addEventListener('change', () => {
      currentSteps[i].durationSec = parseFloat(durInput.value)
      redraw()
    })
    row.querySelector('button')!.addEventListener('click', () => {
      if (currentSteps.length > 1) {
        currentSteps.splice(i, 1)
        renderStepsList()
        redraw()
      }
    })
    container.appendChild(row)
  })
}

export function initBandwidth(): void {
  renderStepsList()

  const bind = (id: string, dispId: string, decimals: number): void => {
    const el = document.getElementById(id) as HTMLInputElement | null
    if (!el) return
    el.addEventListener('input', () => {
      const d = document.getElementById(dispId)
      if (d) d.textContent = parseFloat(el.value).toFixed(decimals)
      redraw()
    })
  }
  bind('adapt-delay', 'adapt-delay-val', 0)
  bind('overshoot',   'overshoot-val',   2)

  document.getElementById('run-bandwidth')?.addEventListener('click', redraw)
  document.getElementById('reset-bandwidth')?.addEventListener('click', () => {
    currentSteps = [...PAPER_STEPS]
    renderStepsList()
    redraw()
  })
  document.getElementById('add-bw-step')?.addEventListener('click', () => {
    currentSteps.push({ target: 500, durationSec: 5 })
    renderStepsList()
    redraw()
  })

  redraw()
}
