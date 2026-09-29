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
