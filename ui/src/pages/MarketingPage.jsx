import React from 'react'

const WHATSAPP = 'https://wa.me/573193289504?text=' + encodeURIComponent('Hola, vengo desde feegosystem.com. Quiero cotizar un proyecto.')

function GlowBg() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-fuchsia-500/25 blur-3xl" />
      <div className="absolute top-24 -right-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="absolute bottom-[-120px] left-1/3 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(99,102,241,0.12),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(34,211,238,0.10),transparent_40%),radial-gradient(circle_at_60%_80%,rgba(236,72,153,0.10),transparent_45%)]" />
    </div>
  )
}

function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
      {children}
    </span>
  )
}

function Card({ title, desc }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl hover:bg-white/[0.07] transition">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm text-slate-300 leading-relaxed">{desc}</div>
    </div>
  )
}

export default function MarketingPage() {
  const [mode, setMode] = React.useState('dark')

  React.useEffect(() => {
    // Simple theme toggle for this page: switch bg/fg via data attribute
    document.documentElement.dataset.feegoTheme = mode
    return () => {
      delete document.documentElement.dataset.feegoTheme
    }
  }, [mode])

  const isDark = mode === 'dark'

  return (
    <div className={isDark ? 'min-h-screen bg-slate-950 text-white' : 'min-h-screen bg-slate-50 text-slate-900'}>
      <div className="relative">
        {isDark && <GlowBg />}

        <header className={"relative z-10 border-b " + (isDark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-white/70')}>
          <div className="mx-auto max-w-6xl px-4 py-4 flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className={"h-10 w-10 rounded-xl grid place-items-center font-black tracking-wide " + (isDark ? 'bg-white/10 border border-white/10' : 'bg-slate-900 text-white')}>F</div>
              <div>
                <div className="font-extrabold leading-tight">FeegoSystem</div>
                <div className={"text-xs " + (isDark ? 'text-slate-400' : 'text-slate-600')}>Software + IA</div>
              </div>
            </div>

            <nav className="ml-auto hidden md:flex items-center gap-6 text-sm">
              <a className={isDark ? 'text-slate-200 hover:text-white' : 'text-slate-700 hover:text-slate-950'} href="#servicios">Servicios</a>
              <a className={isDark ? 'text-slate-200 hover:text-white' : 'text-slate-700 hover:text-slate-950'} href="#proceso">Proceso</a>
              <a className={isDark ? 'text-slate-200 hover:text-white' : 'text-slate-700 hover:text-slate-950'} href="#tecnologia">Tecnología</a>
            </nav>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode(isDark ? 'light' : 'dark')}
                className={"px-3 py-2 rounded-xl border text-sm font-semibold transition " + (isDark ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-slate-200 bg-white hover:bg-slate-50')}
                aria-label="Cambiar tema"
                title="Cambiar tema"
              >
                {isDark ? 'Claro' : 'Oscuro'}
              </button>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noreferrer"
                className={"px-4 py-2 rounded-xl font-bold text-sm transition " + (isDark ? 'bg-indigo-500 hover:bg-indigo-400 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white')}
              >
                WhatsApp
              </a>
            </div>
          </div>
        </header>

        <main className="relative z-10">
          <section className="mx-auto max-w-6xl px-4 pt-12 pb-10">
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap gap-2">
                <Pill>Automatizaciones con IA</Pill>
                <Pill>Web • Mobile • Desktop</Pill>
                <Pill>Entrega rápida + escalable</Pill>
              </div>

              <div>
                <h1 className={"text-4xl md:text-6xl font-black leading-[1.05] " + (isDark ? 'text-white' : 'text-slate-950')}>
                  Desarrollo de software moderno
                  <span className={isDark ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-200' : 'text-indigo-600'}> con inteligencia artificial</span>
                </h1>
                <p className={"mt-5 max-w-2xl text-base md:text-lg leading-relaxed " + (isDark ? 'text-slate-300' : 'text-slate-700')}>
                  Creamos páginas web, aplicaciones web, apps Android/iPhone y software para Mac.
                  Integramos automatizaciones con IA para reducir trabajo manual y acelerar procesos.
                </p>

                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <a
                    href={WHATSAPP}
                    target="_blank"
                    rel="noreferrer"
                    className={"px-5 py-3 rounded-2xl font-extrabold text-sm sm:text-base inline-flex justify-center " + (isDark ? 'bg-indigo-500 hover:bg-indigo-400 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white')}
                  >
                    Cotizar por WhatsApp
                  </a>
                  <a
                    href="#servicios"
                    className={"px-5 py-3 rounded-2xl font-extrabold text-sm sm:text-base inline-flex justify-center border transition " + (isDark ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-900')}
                  >
                    Ver servicios
                  </a>
                </div>

                <div className={"mt-6 text-xs " + (isDark ? 'text-slate-400' : 'text-slate-600')}>
                  Respuesta rápida • Enfoque en resultados • Diseño mobile-first
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="servicios">
                <Card title="Páginas web" desc="Landing pages modernas, rápidas y optimizadas para conversión. SEO técnico, rendimiento y responsive." />
                <Card title="Aplicaciones web" desc="Paneles, dashboards, sistemas internos y plataformas completas con autenticación, roles y analítica." />
                <Card title="Apps móviles (Android/iPhone)" desc="Apps escalables con UX cuidada, notificaciones, pagos, cámara, mapas y sincronización." />
                <Card title="Automatizaciones con IA" desc="Bots, flujos de trabajo, clasificación, extracción de datos, asistentes internos y automatización de tareas repetitivas." />
                <Card title="Software para Mac/desktop" desc="Herramientas internas, utilidades y apps multiplataforma. Integración con servicios y APIs." />
                <Card title="Integraciones" desc="Conectamos WhatsApp, CRMs, ERPs, pasarelas de pago, email, calendarios y APIs propias." />
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 py-10" id="proceso">
            <div className={"rounded-3xl border p-6 md:p-10 " + (isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white')}>
              <h2 className={"text-2xl md:text-3xl font-black " + (isDark ? 'text-white' : 'text-slate-950')}>Proceso simple, entregas rápidas</h2>
              <div className={"mt-3 text-sm md:text-base " + (isDark ? 'text-slate-300' : 'text-slate-700')}>
                Trabajamos por etapas cortas para que veas progreso real.
              </div>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card title="1. Descubrimiento" desc="Entendemos tu necesidad, objetivos y restricciones. Definimos alcance y prioridad." />
                <Card title="2. Diseño" desc="Diseño UI/UX moderno y funcional, pensado para móvil primero." />
                <Card title="3. Construcción" desc="Desarrollo con buenas prácticas, pruebas y automatizaciones." />
                <Card title="4. Despliegue" desc="CI/CD, monitoreo y evolución. Tú apruebas y nosotros entregamos." />
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 py-10" id="tecnologia">
            <h2 className={"text-2xl md:text-3xl font-black " + (isDark ? 'text-white' : 'text-slate-950')}>Tecnología</h2>
            <p className={"mt-3 max-w-2xl text-sm md:text-base " + (isDark ? 'text-slate-300' : 'text-slate-700')}>
              Stack moderno: React/Next.js, Node.js, Docker, Nginx, y automatizaciones con IA.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['React', 'Next.js', 'Node.js', 'Docker', 'Nginx', 'PostgreSQL/MariaDB', 'CI/CD', 'IA'].map((t) => (
                <span key={t} className={"rounded-full px-3 py-1 text-xs border " + (isDark ? 'border-white/10 bg-white/5 text-slate-200' : 'border-slate-200 bg-white text-slate-800')}>
                  {t}
                </span>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 pb-14">
            <div className={"rounded-3xl border p-6 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 " + (isDark ? 'border-white/10 bg-gradient-to-r from-white/5 to-white/[0.03]' : 'border-slate-200 bg-white')}>
              <div>
                <div className={"text-2xl md:text-3xl font-black " + (isDark ? 'text-white' : 'text-slate-950')}>¿Listo para construir?</div>
                <div className={"mt-2 text-sm md:text-base " + (isDark ? 'text-slate-300' : 'text-slate-700')}>
                  Cuéntanos tu idea y te proponemos un plan de ejecución.
                </div>
              </div>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noreferrer"
                className={"px-5 py-3 rounded-2xl font-extrabold text-sm sm:text-base inline-flex justify-center " + (isDark ? 'bg-indigo-500 hover:bg-indigo-400 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white')}
              >
                Escribir por WhatsApp
              </a>
            </div>
          </section>

          <footer className={"border-t py-10 " + (isDark ? 'border-white/10' : 'border-slate-200')}>
            <div className={"mx-auto max-w-6xl px-4 text-sm flex flex-col md:flex-row gap-3 justify-between " + (isDark ? 'text-slate-400' : 'text-slate-600')}>
              <div>© {new Date().getFullYear()} FeegoSystem</div>
              <div>Desarrollo de software • Automatizaciones con IA</div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
