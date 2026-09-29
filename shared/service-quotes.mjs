export const MAX_AMOUNT = 1e12
export const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100
export function serviceTotals(service) {
  if (service?.pricingMode === 'global') return { initial: money(service.globalInitial || 0), monthly: money(service.globalMonthly || 0) }
  const totals = { initial: 0, monthly: 0 }
  for (const module of service?.modules || []) {
    const amount = money(Number(module.unitPrice || 0) * (module.billing === 'hourly' ? Number(module.qty || 0) : 1))
    if (module.billing === 'monthly') totals.monthly += amount
    else totals.initial += amount
  }
  return { initial: money(totals.initial), monthly: money(totals.monthly) }
}
export function milestoneAmounts(service) {
  const total = Math.round(serviceTotals(service).initial * 100)
  const milestones = service?.milestones || []
  let assigned = 0
  return milestones.map((m, i) => {
    const amount = i === milestones.length - 1 ? total - assigned : Math.round(total * Number(m.percent) / 100)
    assigned += amount
    return { ...m, amount: amount / 100 }
  })
}
const fields = ['title','objective','includes','excludes','responsibilities','timeline','startCondition','support','changePolicy','recurringTerms']
export function normalizeServiceQuote(body) {
  if (body.type !== 'services') return { type: 'products', service: null }
  const source = body.service || {}
  const fail = message => { throw new Error(message) }
  const text = (v, max = 10000) => {
    if (v != null && typeof v !== 'string') fail('Los textos de la propuesta deben ser válidos.')
    const s = String(v || '').trim()
    if (s.length > max) fail(`El texto supera el máximo de ${max} caracteres.`)
    return s
  }
  const service = Object.fromEntries(fields.map(k => [k, text(source[k], k === 'title' ? 240 : 10000)]))
  if (!service.title || !service.objective) fail('Indica el nombre y el objetivo del proyecto.')
  service.currency = 'COP'
  service.pricingMode = source.pricingMode ?? 'modules'
  if (!['modules','global'].includes(service.pricingMode)) fail('Selecciona un tipo de precio válido.')
  for (const key of ['globalInitial','globalMonthly']) {
    const raw = source[key] ?? (key === 'globalMonthly' ? 0 : undefined)
    if (service.pricingMode === 'global') {
      if (raw === '' || raw == null || !['number','string'].includes(typeof raw) || !Number.isFinite(Number(raw)) || Number(raw) < 0 || Number(raw) > MAX_AMOUNT) fail('Indica un valor global válido, mayor o igual a cero.')
      service[key] = money(raw)
    } else if (source[key] !== '' && source[key] != null && ['number','string'].includes(typeof source[key]) && Number.isFinite(Number(source[key])) && Number(source[key]) >= 0 && Number(source[key]) <= MAX_AMOUNT) {
      service[key] = money(source[key])
    }
  }
  if (!Array.isArray(source.modules) || !source.modules.length || source.modules.length > 50) fail('Agrega entre 1 y 50 módulos o servicios.')
  service.modules = source.modules.map(m => {
    if (service.pricingMode === 'global' && m) {
      const name = text(m.name, 240)
      if (!name) fail('Todos los módulos deben tener nombre.')
      // Keep valid module prices for switching back, but never require them in global mode.
      const billing = ['fixed','hourly','monthly'].includes(m.billing) ? m.billing : 'fixed'
      const qty = Number(m.qty), price = Number(m.unitPrice)
      return {name, deliverables:text(m.deliverables), deadline:text(m.deadline,500), billing, qty:Number.isFinite(qty) && qty > 0 && qty <= 100000 ? qty : 1, unitPrice:Number.isFinite(price) && price >= 0 && price <= MAX_AMOUNT ? money(price) : 0}
    }
    if (!m || !['fixed','hourly','monthly'].includes(m.billing)) fail('Selecciona una modalidad de cobro válida.')
    const name = text(m.name, 240)
    if (!name) fail('Todos los módulos deben tener nombre.')
    const qty = m.billing === 'hourly' ? Number(m.qty) : 1
    const unitPrice = Number(m.unitPrice)
    if (m.unitPrice === '' || m.unitPrice == null || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > MAX_AMOUNT) fail('Indica un valor válido para cada módulo.')
    if (!Number.isFinite(qty) || qty <= 0 || qty > 100000) fail('Las horas estimadas deben ser mayores que cero y hasta 100.000.')
    return { name, billing:m.billing, qty, unitPrice:money(unitPrice), deliverables:text(m.deliverables), deadline:text(m.deadline,500) }
  })
  const totals = serviceTotals(service)
  if (totals.initial > MAX_AMOUNT || totals.monthly > MAX_AMOUNT) fail('El total supera el máximo permitido.')
  if (!Array.isArray(source.milestones) || source.milestones.length > 20) fail('Revisa los hitos de pago.')
  service.milestones = source.milestones.map(m => {
    const name = text(m?.name,240), percent = Number(m?.percent)
    if (!name || !Number.isFinite(percent) || percent <= 0 || percent > 100 || Math.abs(percent * 100 - Math.round(percent * 100)) > 0.00001) fail('Cada hito requiere un nombre y un porcentaje válido (hasta dos decimales).')
    return { name, percent }
  })
  const basisPoints = service.milestones.reduce((sum,m) => sum + Math.round(m.percent*100),0)
  if ((totals.initial > 0 || service.milestones.length) && basisPoints !== 10000) fail('Los porcentajes de los hitos deben sumar 100%.')
  return { type:'services', service }
}
export function newService() {
  return { currency:'COP', title:'', objective:'', includes:'', excludes:'Hosting, dominios y licencias de terceros, salvo indicación expresa.', responsibilities:'Entrega de contenidos, accesos y aprobación de los entregables.', timeline:'', startCondition:'Desde la aprobación de la propuesta, el anticipo y la recepción de los accesos necesarios.', support:'', changePolicy:'Las funcionalidades fuera del alcance se estimarán y cotizarán por separado.', recurringTerms:'', modules:[{name:'',billing:'fixed',qty:1,unitPrice:0,deliverables:'',deadline:''}], milestones:[{name:'Inicio del proyecto',percent:40},{name:'Versión funcional aprobada',percent:40},{name:'Entrega final',percent:20}] }
}
export function serviceTemplate(key) {
  const s = newService()
  const module = (name,deliverables,deadline='',billing='fixed') => ({name,deliverables,deadline,billing,qty:1,unitPrice:0})
  const templates = {
    web: {title:'Sitio web corporativo',objective:'Presentar la empresa y facilitar el contacto con sus clientes.',modules:[module('Diseño y contenido','Prototipo de las páginas y estructura de contenidos.'),module('Desarrollo web','Sitio adaptable a móvil, tablet y escritorio; formulario de contacto.'),module('Publicación','Configuración del entorno, despliegue y capacitación.')]},
    app: {title:'Aplicación web a medida',objective:'Centralizar y simplificar los procesos del negocio.',modules:[module('Diseño de experiencia','Flujos de uso y prototipo de las pantallas.'),module('Usuarios y permisos','Inicio de sesión, recuperación de acceso y roles.'),module('Panel de gestión','Gestión de registros, búsqueda, filtros y reportes.'),module('Pruebas y entrega','Validación funcional, despliegue y capacitación.')]},
    integration: {title:'Integración de sistemas',objective:'Automatizar el intercambio de información entre plataformas.',modules:[module('Análisis de integración','Revisión de APIs, permisos y mapeo de datos.'),module('Desarrollo de integración','Sincronización, validaciones y manejo de errores.'),module('Pruebas y documentación','Pruebas de integración y documentación de operación.')]},
    maintenance: {title:'Mantenimiento y soporte de software',objective:'Mantener la continuidad operativa de la aplicación.',modules:[module('Mantenimiento mensual','Revisión técnica y atención de incidencias dentro del alcance acordado.','Mensual','monthly')],milestones:[],recurringTerms:'Facturación mensual anticipada. Definir fecha de inicio, permanencia y condiciones de cancelación antes de enviar.'}
  }
  return {...s,...templates[key]}
}
