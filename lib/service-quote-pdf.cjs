const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('node:fs/promises');
async function renderServiceQuote(quote, branding, paths = {}) {
  const {serviceTotals,milestoneAmounts} = await import('../shared/service-quotes.mjs');
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const hex = /^#[\da-f]{6}$/i.test(branding.accentColor || '') ? branding.accentColor.slice(1) : '1f4db6';
  const accent = rgb(...[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255));
  const ink=rgb(.12,.16,.23), muted=rgb(.4,.44,.5), line=rgb(.87,.89,.93);
  const W=595.28,H=841.89,M=44,C=W-2*M; let page,y;
  const safe = value => Array.from(String(value || '').replace(/\t/g,'  ')).map(ch=>{if(ch==='\n')return ch;try{regular.encodeText(ch);return ch}catch{return '?'}}).join('');
  function wrap(value,width,size,font=regular) {
    const result=[];
    for(const para of safe(value).split('\n')) {
      let current='';
      for(const word of para.split(/\s+/).filter(Boolean)) {
        if(current && font.widthOfTextAtSize(current+' '+word,size)>width){result.push(current);current=''}
        for(const char of (current?' ':'')+word){if(font.widthOfTextAtSize(current+char,size)>width){result.push(current);current=''}current+=char}
      }
      result.push(current);
    }
    return result;
  }
  function newPage() {
    page=doc.addPage([W,H]);page.drawRectangle({x:0,y:H-6,width:W,height:6,color:accent});
    page.drawText(safe(branding.companyName || 'Feego'),{x:M,y:H-32,size:10,font:bold,color:accent});
    page.drawText('PROPUESTA DE SOFTWARE',{x:W-M-148,y:H-32,size:9,font:regular,color:muted});y=H-66;
  }
  function ensure(height) {if(y-height<66)newPage()}
  function text(value,{size=10,font=regular,color=ink,width=C,leading=size*1.35}={}) {
    for(const l of wrap(value,width,size,font)){ensure(leading);if(l)page.drawText(l,{x:M,y,size,font,color});y-=leading}
  }
  function heading(value){ensure(48);y-=7;text(value,{size:13,font:bold,color:accent});y-=5}
  function rule(){ensure(14);page.drawLine({start:{x:M,y},end:{x:W-M,y},thickness:.7,color:line});y-=14}
  // Rows wrap within cells; long rows continue with repeated column headings.
  function table(headers, rows, widths, {numeric=[], strong=false}={}) {
    const padding=6, size=9, leading=11, headerHeight=26;
    const header=()=>{
      page.drawRectangle({x:M,y:y-headerHeight,width:C,height:headerHeight,color:rgb(.90,.94,1),borderColor:line,borderWidth:.6});
      let x=M;
      headers.forEach((label,i)=>{page.drawText(label,{x:x+padding,y:y-18,size:9,font:bold,color:accent});x+=widths[i]});
      y-=headerHeight;
    };
    ensure(headerHeight+42);header();
    rows.forEach((row,index)=>{
      const cells=row.map((value,i)=>wrap(value,widths[i]-padding*2,size,strong||i===0?bold:regular));
      let offset=0, count=Math.max(...cells.map(c=>c.length));
      const fullHeight=count*leading+padding*2;
      if(fullHeight<=H-66-66-headerHeight && y-fullHeight<66){newPage();header()}
      while(offset<count){
        let capacity=Math.floor((y-66-padding*2)/leading);
        if(capacity<1){newPage();header();capacity=Math.floor((y-66-padding*2)/leading)}
        const take=Math.min(count-offset,capacity),height=take*leading+padding*2;
        page.drawRectangle({x:M,y:y-height,width:C,height,color:index%2===0?rgb(.975,.982,1):rgb(1,1,1),borderColor:line,borderWidth:.6});
        let x=M;
        cells.forEach((lines,i)=>{
          const font=strong||i===0?bold:regular;
          if(i)page.drawLine({start:{x,y},end:{x,y:y-height},color:line,thickness:.5});
          lines.slice(offset,offset+take).forEach((value,j)=>{
            const tx=numeric.includes(i)?x+widths[i]-padding-font.widthOfTextAtSize(value,size):x+padding;
            page.drawText(value,{x:tx,y:y-padding-size-j*leading,size,font,color:strong?accent:ink});
          });
          x+=widths[i];
        });
        y-=height;offset+=take;
        if(offset<count){newPage();header()}
      }
    });
    y-=12;
  }
  const cash=n=>`${Number(n).toLocaleString('es-CO',{minimumFractionDigits:0,maximumFractionDigits:2})} COP`;
  const service=quote.service, totals=serviceTotals(service);
  newPage();
  try {if(paths.logoFile){const img=await doc.embedPng(await fs.readFile(paths.logoFile));const size=img.scale(Math.min(100/img.width,42/img.height));page.drawImage(img,{x:W-M-size.width,y:y-size.height,width:size.width,height:size.height});}}catch{}
  text('COTIZACIÓN DE SERVICIOS',{size:10,font:bold,color:muted,width:C-120});
  y-=12;text(service.title,{size:23,font:bold,width:C-120,leading:28});y-=12;
  text(`Cliente: ${quote.customer}`,{font:bold});text(`Fecha: ${quote.date}  |  Referencia: ${quote.id}`,{size:9,color:muted});
  text([branding.legalName,branding.nit?`NIT ${branding.nit}`:'',branding.email,branding.phone].filter(Boolean).join(' · '),{size:9,color:muted});
  y-=12;rule();
  heading('Objetivo');text(service.objective);
  heading('Módulos y entregables');
  service.modules.forEach((m,i)=>{
    ensure(84);rule();text(`${String(i+1).padStart(2,'0')}  ${m.name}`,{size:12,font:bold});
    const amount=m.unitPrice*(m.billing==='hourly'?m.qty:1);
    if(service.pricingMode !== 'global')text(`${m.billing==='hourly'?`${m.qty} horas estimadas × ${cash(m.unitPrice)}`:m.billing==='monthly'?'Servicio mensual':'Precio fijo'}  |  ${cash(amount)}${m.billing==='monthly'?' / mes':''}`,{size:10,color:accent,font:bold});
    if(m.deadline)text(`Plazo estimado: ${m.deadline}`,{size:9,color:muted});
    if(m.deliverables)text(m.deliverables);y-=8;
  });
  // Commercial terms start together after the technical scope.
  newPage();
  if(service.milestones.length){
    heading('Plan de pagos');
    text('Porcentajes sobre la inversión inicial.',{size:9,color:muted});y-=5;
    table(['Hito de pago','Porcentaje','Valor'],milestoneAmounts(service).map(m=>[m.name,`${m.percent}%`,cash(m.amount)]),[C-210,80,130],{numeric:[1,2]});
  }
  const clauses=[['includes','Incluye'],['excludes','No incluye'],['responsibilities','Responsabilidades del cliente'],['timeline','Plazo general'],['startCondition','Inicio del plazo'],['support','Soporte posterior'],['changePolicy','Cambios de alcance'],['recurringTerms','Condiciones de la mensualidad']];
  const conditions=clauses.filter(([key])=>service[key]).map(([key,label])=>[label,service[key]]);
  if(quote.notes)conditions.push(['Notas adicionales',quote.notes]);
  if(branding.validityDays)conditions.push(['Vigencia',`Propuesta válida por ${branding.validityDays} días a partir de la fecha de emisión.`]);
  if(conditions.length){heading('Alcance y condiciones');table(['Concepto','Detalle'],conditions,[150,C-150])}
  // Keep the investment summary and signature together.
  ensure(225);
  heading('Resumen de inversión');
  const investment=[['Inversión inicial',cash(totals.initial)]];
  if(totals.monthly>0)investment.push(['Recurrente mensual',`${cash(totals.monthly)} / mes`]);
  table(['Concepto','Valor'],investment,[C-205,205],{numeric:[1],strong:true});
  if(totals.monthly>0)text('Los valores mensuales se facturan por separado de la inversión inicial.',{size:9,color:muted});
  if(branding.signerName || paths.signatureFile){
    ensure(100);y-=16;
    try {const img=await doc.embedPng(await fs.readFile(paths.signatureFile));const size=img.scale(Math.min(140/img.width,48/img.height));page.drawImage(img,{x:M,y:y-size.height,width:size.width,height:size.height});y-=size.height+8;}catch{}
    if(branding.signerName)text(branding.signerName,{font:bold});if(branding.signerRole)text(branding.signerRole,{size:9,color:muted});
  }
  const pages=doc.getPages();pages.forEach((p,i)=>{
    p.drawLine({start:{x:M,y:46},end:{x:W-M,y:46},color:line,thickness:.7});
    const footer=wrap(branding.notesFooter || branding.companyName || 'Feego',C-65,8).slice(0,2);
    footer.forEach((l,j)=>p.drawText(l,{x:M,y:32-j*10,font:regular,size:8,color:muted}));
    p.drawText(`${i+1} / ${pages.length}`,{x:W-M-30,y:32,font:regular,size:8,color:muted});
  });
  doc.setTitle(service.title);doc.setAuthor(branding.companyName || 'Feego');
  return doc.save();
}
module.exports={renderServiceQuote};
