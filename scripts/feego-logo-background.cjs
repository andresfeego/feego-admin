// Remove only near-black pixels connected to the outside of Feego's logo (including the bulb interior).
// Keep the original asset intact; output a new PNG with transparency.
const sharp = require('sharp');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
(async () => {
  const source = path.join(root, 'data/project-logos/project_27_1772478873333.webp');
  const output = path.join(root, 'data/project-logos/project_27_feego_transparent.png');
  const {data, info} = await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:w, height:h} = info;
  const seen = new Uint8Array(w*h);
  const queue = [];
  function add(i) {
    if (seen[i]) return;
    const p=i*4;
    if (Math.max(data[p],data[p+1],data[p+2]) > 60) return;
    seen[i]=1; queue.push(i);
  }
  for(let x=0;x<w;x++){add(x);add((h-1)*w+x)}
  for(let y=0;y<h;y++){add(y*w);add(y*w+w-1)}
  // The bulb interior is negative space too; seed it explicitly.
  add(260*w+200);
  for(let q=0;q<queue.length;q++) {
    const i=queue[q],x=i%w,y=Math.floor(i/w);
    if(x>0)add(i-1);if(x<w-1)add(i+1);if(y>0)add(i-w);if(y<h-1)add(i+w);
  }
  // Fully clear the exterior; a narrow alpha transition smooths the colored rim.
  for(const i of queue) {
    const p=i*4, brightness=Math.max(data[p],data[p+1],data[p+2]);
    const alpha=Math.max(0,Math.min(1,(brightness-12)/48));
    data[p+3]=Math.round(alpha*255);
    if(alpha>0)for(let c=0;c<3;c++)data[p+c]=Math.min(255,Math.round(data[p+c]/alpha));
  }
  await sharp(data,{raw:{width:w,height:h,channels:4}}).png().toFile(output);
  await sharp(output).flatten({background:'#ffffff'}).png().toFile('/tmp/feego-white-preview.png');
  console.log(JSON.stringify({output,exteriorPixels:queue.length,totalPixels:w*h}));
})().catch(e=>{console.error(e);process.exitCode=1});
