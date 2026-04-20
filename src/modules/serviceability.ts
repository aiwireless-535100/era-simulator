/**
 * Serviceability Module
 * Implements Eq. (1)-(9) from the ERA paper (ICC 2026)
 *
 * R  = (Ntotal - Nfail) / Ntotal
 * A  = MTBF / (MTBF + MTTR)
 * Pnorm = geometric mean of normalized TP and iLatency performabilities
 * Sp = R^α · A^β · Pnorm^(1-α-β)
 */

import { drawGroupedBar } from './chartUtils'

interface ServiceabilityParams {
  ntotal:      number   // total requests
  nfail:       number   // failures
  ttot:        number   // total runtime (s)
  tdown:       number   // avg downtime per failure (s)
  alpha:       number   // reliability weight
  beta:        number   // availability weight
  tpTarget:    number   // throughput ideal (Mbps)
  tpNormal:    number   // throughput in Up state (Mbps)
  tpDegraded:  number   // throughput in Degraded state (Mbps)
  latNormal:   number   // latency in Up state (ms)
  latDegraded: number   // latency in Degraded state (ms)
}

interface ServiceabilityResult {
  R:       number
  A:       number
  Pnorm:   number
  Sp:      number
  MTBF:    number
  MTTR:    number
  Tdeg:    number
  piUp:    number
  piDeg:   number
  PssTP:   number
  PssiLA:  number
}

// Paper baseline for K8S-HPA
const K8S_BASELINE: ServiceabilityResult = {
  R: 0.5617, A: 0.6571, Pnorm: 0.6058, Sp: 0.6072,
  MTBF: 4.79, MTTR: 2.5, Tdeg: 1972.5,
  piUp: 1 - 1972.5/3780, piDeg: 1972.5/3780,
  PssTP: 0, PssiLA: 0,
}

function compute(p: ServiceabilityParams): ServiceabilityResult {
  // Eq. (8): R
  const R = (p.ntotal - p.nfail) / p.ntotal

  // Eq. (10): MTBF, MTTR
  const MTBF = p.nfail > 0 ? p.ttot / p.nfail : p.ttot
  const MTTR = p.tdown

  // Eq. (9): A
  const A = MTBF / (MTBF + MTTR)

  // Degraded duration
  const Tdeg = p.tdown * p.nfail
  const piDeg = Math.min(Tdeg / p.ttot, 1)
  const piUp  = 1 - piDeg

  // Eq. (11): Pss,TP
  const PssTP = piUp * p.tpNormal + piDeg * p.tpDegraded

  // Eq. (12): Pss,iLA  (inverse latency)
  const PssiLA = piUp * (1 / p.latNormal) + piDeg * (1 / p.latDegraded)
  const iLAmax = 1 / 1  // latency target = 1 ms → iLA_max = 1

  // Eq. (13) adapted with weights (both 50%)
  const w_tp = 0.5, w_ila = 0.5
  const Pnorm = Math.pow(PssTP / p.tpTarget, w_tp) * Math.pow(PssiLA / iLAmax, w_ila)

  // Eq. (7): Sp
  const gamma = Math.max(0, 1 - p.alpha - p.beta)
  const Sp = Math.pow(R, p.alpha) * Math.pow(A, p.beta) * Math.pow(Math.min(Pnorm, 1), gamma)

  return { R, A, Pnorm: Math.min(Pnorm, 1), Sp, MTBF, MTTR, Tdeg, piUp, piDeg, PssTP, PssiLA }
}

function pct(v: number): string { return (v * 100).toFixed(2) + '%' }
function fmt2(v: number): string { return v.toFixed(2) }

function updateDisplay(res: ServiceabilityResult): void {
  const set = (id: string, val: string) => {
    const el = document.getElementById(id)
    if (el) el.textContent = val
  }
  set('result-R',    pct(res.R))
  set('result-A',    pct(res.A))
  set('result-Pnorm', pct(res.Pnorm))
  set('result-Sp',   pct(res.Sp))
  set('det-mtbf', fmt2(res.MTBF) + ' s')
  set('det-mttr', fmt2(res.MTTR) + ' s')
  set('det-tdeg', fmt2(res.Tdeg) + ' s')
  set('det-piup', (res.piUp * 100).toFixed(1) + '%')
  set('det-pideg', (res.piDeg * 100).toFixed(1) + '%')
  set('det-psstp', fmt2(res.PssTP) + ' Mbps')
  set('det-pssila', (res.PssiLA * 1000).toFixed(2) + ' 1/s')

  // Colour Sp card
  const card = document.getElementById('mc-Sp')
  if (card) {
    card.style.borderColor = res.Sp >= 0.85 ? 'var(--green)' :
                             res.Sp >= 0.70 ? 'var(--cyan)'  : 'var(--red)'
  }
  const valEl = document.getElementById('result-Sp')
  if (valEl) {
    valEl.style.color = res.Sp >= 0.85 ? 'var(--green)' :
                        res.Sp >= 0.70 ? 'var(--cyan)'  : 'var(--red)'
  }
}

let chartInstance: unknown = null

function drawChart(era: ServiceabilityResult): void {
  const canvas = document.getElementById('serviceability-chart') as HTMLCanvasElement | null
  if (!canvas) return

  const labels = ['Reliability R', 'Availability A', 'Performability P', 'Serviceability Sp']
  const eraData  = [era.R, era.A, era.Pnorm, era.Sp].map(v => +(v * 100).toFixed(2))
  const hpaData  = [
    K8S_BASELINE.R, K8S_BASELINE.A,
    K8S_BASELINE.Pnorm, K8S_BASELINE.Sp
  ].map(v => +(v * 100).toFixed(2))

  chartInstance = drawGroupedBar(canvas, chartInstance, {
    labels,
    datasets: [
      { label: 'ERA (Auto)',  data: eraData, color: '#00d4ff' },
      { label: 'K8S-HPA',    data: hpaData, color: '#ff4560' },
    ],
    yMax: 100,
    yLabel: '%',
  })
}

function readParams(): ServiceabilityParams {
  const g = (id: string): number => parseFloat((document.getElementById(id) as HTMLInputElement).value)
  return {
    ntotal:      g('ntotal'),
    nfail:       g('nfail'),
    ttot:        g('ttot'),
    tdown:       g('tdown'),
    alpha:       g('alpha'),
    beta:        g('beta'),
    tpTarget:    g('tp-target'),
    tpNormal:    g('tp-normal'),
    tpDegraded:  g('tp-degraded'),
    latNormal:   g('lat-normal'),
    latDegraded: g('lat-degraded'),
  }
}

function bindSlider(id: string, dispId: string, decimals = 0, onUpdate?: () => void): void {
  const el = document.getElementById(id) as HTMLInputElement | null
  if (!el) return
  el.addEventListener('input', () => {
    const disp = document.getElementById(dispId)
    if (disp) disp.textContent = parseFloat(el.value).toFixed(decimals)
    onUpdate?.()
  })
}

export function initServiceability(): void {
  const refresh = () => {
    const p = readParams()
    const res = compute(p)
    updateDisplay(res)
    drawChart(res)
  }

  bindSlider('ntotal',       'ntotal-val',      0, refresh)
  bindSlider('nfail',        'nfail-val',       0, refresh)
  bindSlider('ttot',         'ttot-val',        0, refresh)
  bindSlider('tdown',        'tdown-val',       1, refresh)
  bindSlider('alpha',        'alpha-val',       2, refresh)
  bindSlider('beta',         'beta-val',        2, refresh)
  bindSlider('tp-target',    'tp-target-val',   0, refresh)
  bindSlider('tp-normal',    'tp-normal-val',   0, refresh)
  bindSlider('tp-degraded',  'tp-degraded-val', 0, refresh)
  bindSlider('lat-normal',   'lat-normal-val',  1, refresh)
  bindSlider('lat-degraded', 'lat-degraded-val',1, refresh)

  document.getElementById('compare-baseline')?.addEventListener('click', refresh)

  // Initial render with ERA paper values
  refresh()
}
