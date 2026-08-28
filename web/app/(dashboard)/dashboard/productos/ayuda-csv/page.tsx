import Link from "next/link";
import { ArrowLeft, Info, TriangleAlert, CircleCheck } from "lucide-react";

// ── Static reference data ───────────────────────────────────────────────────

const COLUMN_REF: {
  name: string;
  level: string;
  required: "req" | "opt" | "cond" | "none";
  note: string;
}[] = [
  { name: "product_id", level: "Resolución", required: "none", note: "UUID del producto (lo trae el export). Identifica la fila sin necesidad de slug." },
  { name: "slug", level: "Producto", required: "req", note: "Igual en todas las filas del mismo producto. Para actualizar, se puede omitir si usás sku o product_id." },
  { name: "name", level: "Producto", required: "req", note: "Si la columna está presente en el archivo, no puede quedar vacía en ninguna fila." },
  { name: "description", level: "Producto", required: "opt", note: "Vacía en una fila presente = borra la descripción." },
  { name: "category_slug", level: "Producto", required: "opt", note: "Debe existir una categoría con ese slug — si no, error. Vacía = sin categoría." },
  { name: "iva_rate", level: "Producto", required: "req", note: "Valores válidos: 0, 10.5, 21." },
  { name: "image_url", level: "Producto", required: "opt", note: "Las imágenes se suben desde el formulario del producto, no por CSV. Vacía = borra la imagen." },
  { name: "made_to_order", level: "Producto", required: "opt", note: "true/false, si/no, 1/0. Por defecto false al crear." },
  { name: "is_active", level: "Producto", required: "opt", note: "Por defecto true al crear." },
  { name: "variant_id", level: "Resolución", required: "none", note: "UUID de la variante (lo trae el export). La forma más precisa de apuntar a una variante puntual." },
  { name: "sku", level: "Variante", required: "req", note: "Único en todo el catálogo. Alcanza solo para identificar una fila de actualización." },
  { name: "variant_name", level: "Variante", required: "req", note: "Nombre propio de esa variante." },
  { name: "attributes", level: "Variante", required: "opt", note: 'Objeto JSON, ej. {"potencia": "550W"}. Lo que distingue una variante de otra.' },
  { name: "price", level: "Variante", required: "req", note: "Punto decimal, sin separador de miles." },
  { name: "price_input_mode", level: "Variante", required: "cond", note: "net (sin IVA, por defecto) o final (con IVA incluido — se convierte a neto solo)." },
  { name: "stock_qty", level: "Variante", required: "opt", note: "Número entero. Por defecto 0 al crear." },
  { name: "final_price", level: "—", required: "none", note: "Solo aparece al exportar (precio con IVA calculado). Si la dejás al importar, no hace nada." },
];

const REQ_LABEL: Record<string, { text: string; className: string }> = {
  req: { text: "Obligatoria", className: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/80 dark:border-red-500/20" },
  opt: { text: "Opcional", className: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700" },
  cond: { text: "Condicional", className: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/80 dark:border-amber-500/20" },
  none: { text: "No usar", className: "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700" },
};

const ERRORS: { msg: string; fix: string }[] = [
  { msg: "'campo' es obligatorio y no puede estar vacío", fix: "Esa columna está en el archivo pero la celda vino vacía en una fila donde es obligatoria. Completá el dato o sacá la columna si no la necesitás." },
  { msg: "la fila necesita 'product_id', 'slug' o 'sku' para poder identificarse", fix: "Ninguna de las tres columnas de identificación vino con datos. Agregá al menos sku (para actualizar) o slug (para crear)." },
  { msg: "el sku 'X' no existe — para crear un producto nuevo también necesitás la columna 'slug'", fix: "Quisiste actualizar por SKU pero ese SKU todavía no existe. Si es un producto nuevo, agregá slug y el resto de los campos de creación." },
  { msg: "valores distintos para 'X' entre filas del producto", fix: "Dos filas del mismo slug traen valores distintos en una columna de producto (ej. name o iva_rate). Repetí el mismo valor en todas las filas." },
  { msg: "El SKU 'X' ya pertenece al producto 'Y'", fix: "Ese SKU ya está en uso en otro producto — es único en todo el catálogo. Usá un SKU distinto." },
  { msg: "Ya existe un producto con ese slug", fix: "Estás creando con un slug que ya tiene otro producto. Si querías actualizarlo no hace falta ningún truco extra — revisá que no haya un typo en el slug." },
  { msg: "category_slug 'X' no existe", fix: "No hay ninguna categoría con ese slug. Revisá el slug exacto o dejá la celda vacía si no aplica." },
  { msg: "'X' parece tener separador de miles estilo es-AR — usá punto decimal simple", fix: "Escribiste el precio como 145.000 (formato argentino). Usá 145000 o 145000.50, con punto solo como decimal." },
  { msg: "JSON inválido en 'attributes'", fix: 'La celda de attributes no es un JSON válido. Tiene que ser {"clave": "valor"}, con comillas dobles.' },
  { msg: "valor booleano inválido: 'X'", fix: "El valor de made_to_order o is_active no se reconoce. Usá true/false, si/no o 1/0." },
];

// ── Small building blocks ───────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </section>
  );
}

function Callout({ tone, children }: { tone: "info" | "warn"; children: React.ReactNode }) {
  const Icon = tone === "info" ? Info : TriangleAlert;
  const cls =
    tone === "info"
      ? "bg-brand-blue/5 border-brand-blue/20 text-zinc-700 dark:text-zinc-300"
      : "bg-amber-50 dark:bg-amber-500/10 border-amber-200/80 dark:border-amber-500/20 text-amber-800 dark:text-amber-300";
  const iconCls = tone === "info" ? "text-brand-blue" : "text-amber-600 dark:text-amber-400";
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-sm ${cls}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconCls}`} />
      <div>{children}</div>
    </div>
  );
}

function CsvExample({
  caption,
  hint,
  cols,
  rows,
}: {
  caption: string;
  hint: string;
  cols: string[];
  rows: string[][];
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">{caption}</span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">{hint}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono whitespace-nowrap">
          <thead>
            <tr className="bg-white dark:bg-zinc-900">
              {cols.map((c) => (
                <th key={c} className="text-left px-3 py-2 text-zinc-400 dark:text-zinc-500 font-medium border-b border-zinc-200 dark:border-zinc-800">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {rows.map((row, i) => (
              <tr key={i} className="bg-white dark:bg-zinc-900">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`px-3 py-2 ${j === 0 ? "text-brand-blue font-medium" : "text-zinc-600 dark:text-zinc-400"}`}
                  >
                    {cell || <span className="text-zinc-300 dark:text-zinc-700">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProductCsvHelpPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/productos"
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150"
          aria-label="Volver a productos"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight">
            Ayuda: importación CSV
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Cómo crear y actualizar productos simples y con variantes desde un archivo CSV
          </p>
        </div>
      </div>

      <Section title="Reglas generales del archivo">
        <p>
          Cada <strong>fila del CSV es una variante</strong>, nunca un producto entero. Un producto simple ocupa
          una sola fila; un producto con varias opciones (variantes) ocupa una fila por cada una, repitiendo los
          datos del producto.
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            Se acepta UTF-8 (recomendado) y también lo que genera Excel al hacer <em>Guardar como → CSV</em> en
            Windows — se detecta solo, no hace falta convertir nada a mano.
          </li>
          <li>El separador de columnas (coma o punto y coma) también se detecta automáticamente al importar.</li>
          <li>
            Los precios van siempre con <strong>punto decimal</strong>, sin separador de miles: <code>145000.50</code>,
            nunca <code>145.000,50</code>.
          </li>
          <li>
            Los campos sí/no (<code>made_to_order</code>, <code>is_active</code>) aceptan <code>true</code>/
            <code>false</code>, <code>si</code>/<code>no</code> o <code>1</code>/<code>0</code>.
          </li>
        </ul>
        <Callout tone="info">
          La carga de imágenes <strong>no se hace por CSV</strong>. Subilas después desde el formulario del producto.
          Al exportar, tildá <strong>«Exportar con “;”»</strong> si vas a editar el archivo con Excel en español —
          así abre las columnas ya separadas al hacer doble clic.
        </Callout>
        <Callout tone="warn">
          Si un nombre o SKU empieza con <code>=</code>, <code>+</code>, <code>-</code> o <code>@</code>, el
          catálogo exportado le antepone una comilla simple (<code>&apos;=Cliente VIP</code>). Es una protección
          contra fórmulas maliciosas en Excel — no es un error, no hace falta sacarla.
        </Callout>
      </Section>

      <Section title="Crear productos nuevos">
        <p>
          Dejá vacías las columnas <code>product_id</code> y <code>variant_id</code>. El sistema crea la fila
          cuando el <code>slug</code> todavía no existe en el catálogo.
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            Obligatorios del producto: <code>slug</code>, <code>name</code>, <code>iva_rate</code>.
          </li>
          <li>
            Obligatorios de cada variante: <code>sku</code>, <code>variant_name</code>, <code>price</code>.
          </li>
          <li>
            El resto es opcional — si no lo completás, se usa un valor por defecto (<code>made_to_order</code>{" "}
            = false, <code>is_active</code> = true, <code>stock_qty</code> = 0).
          </li>
        </ul>
        <CsvExample
          caption="producto-simple.csv"
          hint="1 fila = 1 producto sin variantes"
          cols={["slug", "name", "iva_rate", "category_slug", "sku", "variant_name", "price", "stock_qty"]}
          rows={[
            [
              "camara-ip-exterior-4mp-plus",
              "Cámara IP Exterior 4MP Plus",
              "21",
              "domotica",
              "CAM-4MP-PLUS",
              "Cámara IP Exterior 4MP Plus",
              "112000",
              "10",
            ],
          ]}
        />
      </Section>

      <Section title="Productos con variantes">
        <p>
          Repetí el <strong>mismo <code>slug</code></strong> en cada fila del producto — eso es lo que las agrupa,
          no un ID especial ni un tipo de fila distinto.
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Se repite igual</strong> en todas las filas: <code>slug</code>, <code>name</code>,{" "}
            <code>description</code>, <code>category_slug</code>, <code>iva_rate</code>, <code>image_url</code>,{" "}
            <code>made_to_order</code>, <code>is_active</code>. Si dos filas del mismo producto traen valores
            distintos en una de estas columnas, se rechaza esa fila.
          </li>
          <li>
            <strong>Cambia en cada fila</strong>: <code>sku</code>, <code>variant_name</code>,{" "}
            <code>attributes</code>, <code>price</code>, <code>stock_qty</code>.
          </li>
          <li>
            <code>attributes</code> es un JSON con lo que distingue a la variante, ej.{" "}
            <code>{`{"potencia": "550W"}`}</code>.
          </li>
        </ul>
        <CsvExample
          caption="panel-solar.csv"
          hint="mismo slug, sku distinto por variante"
          cols={["slug", "name", "iva_rate", "sku", "variant_name", "attributes", "price", "stock_qty"]}
          rows={[
            [
              "panel-solar-550w",
              "Panel Solar 550W",
              "21",
              "PS-550W-STD",
              "Panel Solar 550W · Estándar",
              '{"potencia": "550W"}',
              "125000",
              "20",
            ],
            [
              "panel-solar-550w",
              "Panel Solar 550W",
              "21",
              "PS-550W-BIF",
              "Panel Solar 550W · Bifacial",
              '{"potencia": "550W", "tipo": "bifacial"}',
              "149000",
              "12",
            ],
          ]}
        />
        <Callout tone="info">
          El <code>sku</code> es único en <strong>todo</strong> el catálogo, no solo dentro del producto — no lo
          repitas en otra fila aunque sea de otro producto.
        </Callout>
      </Section>

      <Section title="Actualizar por SKU o ID — solo lo que incluyas">
        <p>
          Regla central: <strong>solo se modifican las columnas que estén en el archivo</strong>. Una columna
          ausente deja ese campo tal cual está.
        </p>
        <p>Cómo se identifica cada fila, en este orden:</p>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>
            <code>product_id</code> / <code>variant_id</code> — los más precisos, los da el export.
          </li>
          <li>
            <code>slug</code> — agrupa varias filas del mismo producto.
          </li>
          <li>
            <code>sku</code> solo — alcanza para actualizar porque es único en todo el catálogo. No hace falta{" "}
            <code>slug</code> si el SKU ya existe.
          </li>
        </ol>
        <CsvExample
          caption="actualizar-precios.csv"
          hint="solo toca price"
          cols={["sku", "price"]}
          rows={[
            ["PS-550W-STD", "132000"],
            ["PS-550W-BIF", "156000"],
            ["CAM-4MP-PLUS", "119000"],
          ]}
        />
        <CsvExample
          caption="actualizar-stock.csv"
          hint="agrupa solo, sin slug"
          cols={["sku", "stock_qty"]}
          rows={[
            ["PS-550W-STD", "40"],
            ["PS-550W-BIF", "18"],
          ]}
        />
        <p>Si la columna está en el archivo pero la celda de una fila viene vacía:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            En campos opcionales (<code>description</code>, <code>image_url</code>, <code>category_slug</code>) →{" "}
            <strong>borra</strong> el valor actual.
          </li>
          <li>
            En campos obligatorios (<code>name</code>, <code>slug</code>, <code>sku</code>, <code>variant_name</code>,{" "}
            <code>price</code>) → esa fila se rechaza con un error, el resto del archivo se sigue procesando.
          </li>
        </ul>
      </Section>

      <Section title="Simulación antes de importar">
        <p>
          Tildá <strong>«Simulación (no guarda)»</strong> antes de subir el archivo para ver cuántos productos y
          variantes se crearían o actualizarían, y qué filas tienen errores — sin escribir nada en el catálogo
          todavía.
        </p>
      </Section>

      <Section title="Referencia de columnas">
        <p className="text-zinc-500 dark:text-zinc-500">
          Podés incluir solo las columnas que necesitás — el orden no importa y los nombres no distinguen
          mayúsculas.
        </p>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Columna
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Nivel
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Para crear
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Notas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {COLUMN_REF.map((c) => (
                <tr key={c.name}>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-900 dark:text-zinc-100 whitespace-nowrap align-top">
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap align-top">
                    {c.level}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap align-top">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${REQ_LABEL[c.required].className}`}
                    >
                      {REQ_LABEL[c.required].text}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 align-top">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Errores comunes">
        <p>
          Un error en una fila (o en un producto y sus variantes) no frena el resto del archivo — el reporte final
          lista fila por fila qué se procesó y qué no.
        </p>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
          {ERRORS.map((e) => (
            <div key={e.msg} className="p-3.5 grid sm:grid-cols-[1fr_1.3fr] gap-2 sm:gap-4">
              <code className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200/80 dark:border-red-500/20 rounded-md px-2 py-1.5 self-start">
                {e.msg}
              </code>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 self-center">{e.fix}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-600 pt-2">
        <CircleCheck className="w-3.5 h-3.5 text-brand-blue shrink-0" />
        Esta guía refleja el comportamiento actual de importar/exportar productos.
      </div>
    </div>
  );
}
