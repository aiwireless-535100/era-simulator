import './style.css'
import { initServiceability } from './modules/serviceability'
import { initHandover } from './modules/handover'
import { initBandwidth } from './modules/bandwidth'
import { initAutoscaling } from './modules/autoscaling'
import { initSLALoop } from './modules/slaloop'

// ---- Tab navigation ----
function setupTabs(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.tab-btn')
  const panels  = document.querySelectorAll<HTMLElement>('.tab-panel')

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset['tab']!
      buttons.forEach(b => b.classList.remove('active'))
      panels.forEach(p  => p.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById(`tab-${target}`)?.classList.add('active')
    })
  })
}

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => {
  setupTabs()
  initServiceability()
  initHandover()
  initBandwidth()
  initAutoscaling()
  initSLALoop()
})
