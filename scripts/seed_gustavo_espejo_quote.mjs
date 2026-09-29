import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {normalizeServiceQuote} from '../shared/service-quotes.mjs'

export const QUOTE_ID = 'bde9292026000001'
export const SEED_KEY = 'gustavo-espejo-portal-20260929-v1'
export function buildQuote() {
  const module=(name,...paragraphs)=>({name,deliverables:paragraphs.join('\n\n'),deadline:'Dentro del plazo global de 30 días.'})
  const service={
    title:'Portal web administrable y comunidad',
    objective:'Desarrollar un portal público con tres páginas de contenido administrable y noticias, integrado con registro abierto de participantes, publicaciones de actividades, moderación, comunicaciones informativas y un panel privado de gestión por municipio y rol.',
    pricingMode:'global',globalInitial:5000000,globalMonthly:0,currency:'COP',
    modules:[
      module('Sitio público en Next.js y SEO técnico',
        'Desarrollo del portal web en Next.js, adaptable a teléfonos, tablets y computadores, con navegación principal, cabecera, pie de página y acceso al registro e inicio de sesión. Incluye exactamente tres páginas públicas de contenido; sus nombres y contenidos se definirán con el cliente. Noticias y las páginas funcionales y legales descritas en esta propuesta se contemplan de forma adicional.',
        'Configuración de títulos y descripciones para buscadores, direcciones legibles, sitemap, robots y metadatos de vista previa para enlaces compartidos. Las páginas públicas y noticias publicadas serán indexables; el panel privado y los datos de participantes permanecerán protegidos. El SEO técnico no garantiza posiciones específicas en buscadores.'),
      module('Administración de contenido con estructura fija',
        'Panel para actualizar los textos, fotografías y enlaces de los componentes previstos en las tres páginas públicas. Se utilizará una plantilla de estructura y diseño definidos para el proyecto, con vista previa y publicación de los cambios por usuarios autorizados.',
        'La edición se limita al contenido de los campos previstos. No incluye un constructor visual libre, arrastrar bloques, modificar el orden de componentes, cambiar distribuciones o estilos ni crear páginas o componentes adicionales. Los nombres de las tres páginas y sus contenidos quedan por definir con el cliente.'),
      module('Noticias del equipo editorial',
        'Sección pública de noticias con listado y página individual por noticia. El equipo autorizado podrá crear y editar título, resumen, cuerpo de texto, imagen principal, categoría y fecha de publicación.',
        'Gestión de borradores, revisión y publicación conforme a los permisos asignados. Se incluyen enlaces permanentes, vista previa al compartir y edición de metadatos SEO. La administración de noticias será independiente de las publicaciones de actividades de los participantes.'),
      module('Registro abierto, perfiles y acceso por QR',
        'Formulario de autorregistro accesible mediante enlace público y código QR que el equipo podrá mostrar o imprimir durante reuniones. Captura de nombre, teléfono, correo para autenticación y recuperación, departamento, municipio y rol o cargo de participación declarado por la persona; por ejemplo, aspirante al Concejo de un municipio.',
        'Cada persona completará y confirmará sus datos, credenciales y consentimientos de tratamiento de datos. Los roles y permisos serán asignados por un administrador. El perfil permitirá actualizar información y añadir enlaces opcionales a sus redes sociales.',
        'Botón para abrir WhatsApp dirigido al número indicado, con un texto de invitación y el enlace de registro preparados. El operador confirmará el envío dentro de WhatsApp. No incluye envío automático por API, SMS ni alta definitiva de una persona sin su intervención y autorización.'),
      module('Usuarios, roles y paneles privados',
        'Inicio y cierre de sesión, recuperación de contraseña por correo y gestión de usuarios activos o suspendidos. Roles base de administrador, editor/moderador y participante, con validación de permisos tanto en la interfaz como en el servidor.',
        'El administrador accederá a usuarios, contenido, moderación e indicadores internos; el editor o moderador a las funciones editoriales asignadas; el participante a su perfil, publicaciones y estado de revisión. Los paneles mostrarán únicamente la información y acciones autorizadas para cada rol.'),
      module('Publicaciones de actividades y moderación',
        'Los participantes podrán redactar actividades realizadas, con título, descripción, fecha, municipio y fotografías. Tendrán un listado de sus aportes y podrán guardarlos como borrador o enviarlos a revisión.',
        'Flujo de estados: borrador, en revisión y publicado. Los administradores o moderadores podrán aprobar, devolver con observaciones, editar según sus permisos o retirar publicaciones. Solo los contenidos aprobados y autorizados para difusión serán visibles en el portal público.',
        'Se conservarán autoría, fechas y estado de cada publicación. La carga de imágenes tendrá validación de formato y tamaño, y optimización para web; los límites de archivos y capacidad se acordarán con el cliente según el hosting contratado.'),
      module('Botones de compartir por red social',
        'Botones específicos en noticias y actividades públicas para abrir Facebook o WhatsApp directamente, sin utilizar el menú general de compartir del teléfono. Facebook recibirá el enlace público de la publicación; WhatsApp recibirá un texto breve y su enlace. La persona elegirá el destino y confirmará la publicación o el envío dentro de la plataforma correspondiente.',
        'Las vistas previas utilizarán título, descripción e imagen pública del portal, sujetas a la interpretación y caché de cada red. Compartir el enlace no equivale a subir automáticamente toda la galería al perfil personal.',
        'Publicaciones en Instagram: por definir.'),
      module('Directorio territorial, mapa y ranking de actividad',
        'Vista interna de participantes con búsqueda y filtros por municipio y rol declarado. Mapa interactivo agregado por municipio para consultar cantidades de personas registradas y publicaciones aprobadas; no mostrará ubicaciones individuales, direcciones ni GPS.',
        'Ranking interno por cantidad de publicaciones aprobadas de cada participante en el período seleccionado, ordenado de mayor a menor, con los empates identificados por el mismo número de aportes. Los borradores, contenidos pendientes o retirados no sumarán.',
        'Los indicadores reflejarán actividad registrada en el portal. No medirán intención de voto, afinidad, influencia política ni actividad externa en redes sociales. La consulta estará limitada a los roles internos autorizados.'),
      module('Correos informativos y preferencias de comunicación',
        'Panel para redactar, previsualizar y enviar comunicaciones informativas a participantes que hayan autorizado ese canal, mediante el proveedor de correo contratado por el cliente. Incluye envío de prueba, procesamiento por lotes, registro de envíos y errores, y mecanismo de baja de estas comunicaciones.',
        'Se diferenciarán los mensajes operativos de cuenta de las comunicaciones informativas suscritas. Los destinatarios se seleccionarán por su suscripción, sin inferencias de afinidad política. La entregabilidad, las cuotas y las restricciones de uso dependerán del proveedor elegido.',
        'El volumen de usuarios, fotografías, almacenamiento y correos mensuales está por definir. La configuración se ajustará a los límites acordados y a la capacidad contratada; no se ofrece capacidad ilimitada ni automatización de WhatsApp.'),
      module('Privacidad, autorizaciones y seguridad',
        'Páginas de política de tratamiento de datos, privacidad y términos del sitio, con contenido suministrado o validado jurídicamente por el cliente para el contexto colombiano. Registro de autorización previa, explícita e informada para el tratamiento de datos sensibles, diferenciando registro, divulgación pública de actividades y recepción de comunicaciones.',
        'Registro de la fecha y versión de los textos aceptados; mecanismos para actualizar datos, solicitar retiro de autorizaciones o supresión, y gestión de estas solicitudes por un administrador. La información de contacto y los datos internos no serán públicos por defecto.',
        'Contraseñas protegidas mediante hash, sesiones seguras, controles de acceso en servidor, validación de formularios y archivos, protección frente a intentos abusivos y bitácora de acciones administrativas relevantes. Configuración de HTTPS y respaldos con restauración documentada en la infraestructura entregada por el cliente.',
        'La implementación técnica facilitará el cumplimiento de la Ley 1581 de 2012 y las disposiciones aplicables; no sustituye la revisión jurídica ni las obligaciones del cliente como responsable del tratamiento. No incluye certificación de cumplimiento o auditoría externa de seguridad.'),
      module('Infraestructura, pruebas, capacitación y entrega',
        'Instalación y configuración inicial en el hosting compatible con Next.js contratado por el cliente, con almacenamiento de fotografías en ese mismo entorno y conexión al proveedor de correo que el cliente suministre. Entrega del código fuente, documentación de instalación y una sesión de capacitación sobre administración, noticias, usuarios y moderación.',
        'Pruebas funcionales de los flujos incluidos, revisión de permisos por rol, formularios, carga de fotografías, navegación adaptable y generación de enlaces de registro y difusión. La entrega se validará sobre estos módulos y el contenido suministrado por el cliente.',
        'Hosting, dominio, almacenamiento, proveedor de correo, licencias y mantenimiento operativo serán contratados y pagados directamente por el cliente. Este deberá suministrar accesos y permisos de configuración antes del inicio. El mantenimiento recurrente no está incluido; sí se mantiene el soporte correctivo posterior indicado en las condiciones.',
        'Los nombres de las tres páginas, el contenido inicial y los volúmenes esperados se definirán con el cliente para fijar capacidad y configuración. Nuevas integraciones, módulos o ampliaciones de capacidad que exijan desarrollo adicional se cotizarán por separado.')
    ],
    includes:'Aplicación adaptable a escritorio y tablet. Código fuente y documentación de instalación.',
    excludes:'Hosting, dominios, licencias y nuevas integraciones.',
    responsibilities:'Entregar contenidos y accesos; revisar cada entrega dentro de 3 días hábiles.',
    timeline:'30 días.',
    startCondition:'El desarrollo y el plazo de 30 días iniciarán únicamente cuando se cumplan las tres condiciones: aprobación de la propuesta, pago del anticipo y recepción de los accesos necesarios a las plataformas contratadas y pagadas por el cliente.',
    support:'30 días para corregir defectos del alcance entregado.',
    changePolicy:'Las funcionalidades adicionales se estiman y cotizan por separado.',
    recurringTerms:'No aplica.',
    milestones:[{name:'Inicio del proyecto',percent:30},{name:'Versión funcional aprobada',percent:30},{name:'Entrega final',percent:40}]
  }
  return {...normalizeServiceQuote({type:'services',service}),id:QUOTE_ID,seedKey:SEED_KEY,customer:'Gustavo Espejo',date:'2026-09-29',notes:'',items:[],totalize:true,validityDays:15,createdAt:new Date().toISOString(),createdBy:'seed:gustavo-espejo'}
}
export async function seedQuote(directory) {
  await fs.mkdir(directory,{recursive:true})
  const file=path.join(directory,'quotes.json')
  let raw='[]'
  try {raw=await fs.readFile(file,'utf8')} catch(e){if(e.code!=='ENOENT')throw e}
  const list=JSON.parse(raw)
  if(!Array.isArray(list))throw Error('El archivo de cotizaciones no contiene una lista válida.')
  const existing=list.find(q=>q.seedKey===SEED_KEY || q.id===QUOTE_ID)
  if(existing){if(existing.customer!=='Gustavo Espejo')throw Error('Conflicto de identificador.');return {created:false,id:existing.id}}
  const quote=buildQuote()
  // Run with the app stopped: atomic replace and backup protect the existing store.
  const backup=path.join(directory,`quotes.before-gustavo-espejo.${Date.now()}.json`)
  await fs.writeFile(backup,raw,{flag:'wx',mode:0o600})
  const temporary=path.join(directory,`.quotes.${process.pid}.tmp`)
  try {await fs.writeFile(temporary,JSON.stringify([quote,...list],null,2),{flag:'wx',mode:0o600});await fs.rename(temporary,file)}
  finally {await fs.rm(temporary,{force:true})}
  return {created:true,id:quote.id}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.env.NODE_ENV==='production')throw Error('Este seed no se ejecuta en producción.')
  const args=process.argv.slice(2)
  if(args.length!==2 || args[0]!=='--quotes-dir' || !path.isAbsolute(args[1]))throw Error('Uso: node scripts/seed_gustavo_espejo_quote.mjs --quotes-dir /ruta/local/cotizaciones (detener antes el servidor local)')
  console.log(JSON.stringify(await seedQuote(args[1])))
}
