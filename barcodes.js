/* Pure JavaScript EAN-13 renderer; the printed bars and scan codes match catalog.js. */
(function(){
  const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const G=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
  const R=['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
  // First-digit parity encoding for the six left-hand EAN-13 digits.
  const p=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
  function valid(code){ if(!/^\d{13}$/.test(code))return false;const a=code.slice(0,12).split('').map(Number);return (10-(a.reduce((s,x,i)=>s+x*(i%2?3:1),0)%10))%10===+code[12]; }
  function svg(code, options={}){
    if(!valid(code))throw new Error('Invalid EAN-13 code '+code);
    let bits='101';
    for(let i=1;i<=6;i++) bits+=(p[+code[0]][i-1]==='L'?L:G)[+code[i]];
    bits+='01010';
    for(let i=7;i<=12;i++)bits+=R[+code[i]];
    bits+='101';
    const width=options.width||315, height=options.height||126, quiet=11, bw=width/(bits.length+quiet*2);
    let rects='';
    for(let i=0;i<bits.length;i++){if(bits[i]!=='1')continue;const guard=i<3||(i>=45&&i<50)||i>=92; rects+=`<rect x="${((i+quiet)*bw).toFixed(3)}" y="5" width="${(bw+0.03).toFixed(3)}" height="${guard?height-30:height-40}" fill="#142537"/>`;}
    return `<svg class="ean13" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="EAN-13 ${code}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet"><rect width="100%" height="100%" fill="white"/>${rects}<text x="${width/2}" y="${height-7}" font-family="Arial, sans-serif" font-size="16" font-weight="600" text-anchor="middle" letter-spacing="1.4" fill="#142537">${code}</text></svg>`;
  }
  window.WatchBarcodes={svg,valid};
})();
