# Cotizaciones de software

En Cotizaciones → Nueva cotización, seleccionar Servicios de software. Las cotizaciones anteriores siguen tratándose como productos.

La propuesta admite módulos de precio fijo, horas estimadas por tarifa y mantenimiento mensual. La inversión inicial suma precios fijos y horas; las mensualidades se muestran por separado. Los hitos distribuyen exclusivamente la inversión inicial y deben sumar 100%; el último absorbe el redondeo a centavos. Una propuesta exclusivamente mensual puede no tener hitos.

Incluye plantillas editables, alcance, exclusiones, responsabilidades, plazos, soporte y condiciones de cambios y mensualidad. El PDF utiliza logo, firma y datos de Branding; las condiciones de software se guardan por propuesta.

Persistencia: mismo archivo `QUOTES_DIR/quotes.json` (por defecto `FEEGO_DATA_ROOT/cotizaciones/quotes.json`), con `type: services` y objeto `service`. No requiere migración SQL. Respaldar ese archivo junto con Branding. La muestra local no se distribuye con Git.

Validación:

```sh
node --test tests/service-quotes.test.mjs
node --check server.js
npm --prefix ui run build
```

Al desplegar incluir `shared/service-quotes.mjs` y `lib/service-quote-pdf.cjs`, además del backend y el build. La conversión de propuestas a proyectos de Roadmap queda fuera de esta versión.

## Precio global

El selector Precio por módulo / Precio global se configura por propuesta. En modo global, `globalInitial` y `globalMonthly` determinan los totales y los hitos; los precios de módulos no se suman ni se imprimen. Los módulos conservan nombre, entregables y plazo. Los importes por módulo válidos se conservan para volver a esa modalidad. Las propuestas anteriores, sin `pricingMode`, siguen usando módulos.

## Seed de Gustavo Espejo

`scripts/seed_gustavo_espejo_quote.mjs` crea únicamente la propuesta `bde9292026000001`, por 5.000.000 COP, sin mensualidad, con plazo de 30 días e hitos 30/30/40. Contiene los 11 módulos detallados. La vigencia de esta propuesta se fija en 15 días.

Detener el servidor local antes de ejecutarlo y usar la carpeta efectiva de cotizaciones (`QUOTES_DIR` o `FEEGO_DATA_ROOT/cotizaciones`):

```sh
node scripts/seed_gustavo_espejo_quote.mjs --quotes-dir /ruta/absoluta/local/cotizaciones
```

No ejecutarlo contra producción sin autorización. Rechaza `NODE_ENV=production`. Crea una copia del archivo previo y reemplaza el JSON de forma atómica. Si ya existe, no duplica ni sobrescribe la propuesta, incluidas las ediciones posteriores realizadas en la UI. Reiniciar el servidor local después.

Las firmas de las propuestas de software se centran y se muestran con un máximo de 196 × 72 puntos; se conserva su proporción.
