// ── MathJax rendering ─────────────────────────────────────────────────────────
function renderMathInElement(el) {
  if (!el) return;
  if (window.MathJax && window.MathJax.typesetPromise && window._mathJaxReady) {
    window.MathJax.typesetPromise([el]).catch(() => {});
  } else {
    setTimeout(() => renderMathInElement(el), 200);
  }
}

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function _plotlyTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#19c37d';
  return { paper_bgcolor:'transparent', plot_bgcolor:isDark?'#2a2a2a':'#f5f5f5', font:{color:isDark?'#e0e0e0':'#333',family:'Inter, sans-serif',size:13}, gridcolor:isDark?'#3a3a3a':'#ddd', linecolor:isDark?'#555':'#bbb', accent };
}

function _normalizeExpr(raw) {
  let s = raw.trim();
  s = s.replace(/Math\.(sin|cos|tan|asin|acos|atan2?|sinh|cosh|tanh|sqrt|cbrt|abs|log2|log10|log|exp|PI|E|pow|sign|floor|ceil|round)\b/g,'$1');
  s = s.replace(/\|([^|]+)\|/g,'abs($1)');
  s = s.replace(/\bpi\b/gi,'PI'); s = s.replace(/\bphi\b/gi,'1.6180339887');
  s = s.replace(/(?<![a-zA-Z0-9.])e(?![a-zA-Z0-9.(])/g,'E');
  const fnMap=['asin','acos','atan','sinh','cosh','tanh','log2','log10','log','ln','sqrt','cbrt','exp','sin','cos','tan','abs','sign','floor','ceil','round','pow'];
  for(const f of fnMap){const jsName=f==='ln'?'log':f==='log'?'log10':f;const re=new RegExp('(?<![a-zA-Z0-9.])'+f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=\\s*\\()','gi');s=s.replace(re,'Math.'+jsName);}
  s = s.replace(/np\.(?:pi|PI)/gi,'PI'); s = s.replace(/np\.(\w+)/g,(_,f)=>f);
  for(const f of fnMap){const jsName=f==='ln'?'log':f==='log'?'log10':f;const re=new RegExp('(?<![a-zA-Z0-9.])'+f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=\\s*\\()','gi');s=s.replace(re,'Math.'+jsName);}
  s = s.replace(/(?<![a-zA-Z0-9.])PI(?![a-zA-Z0-9.(])/g,'Math.PI');
  s = s.replace(/(?<![a-zA-Z0-9.])E(?![a-zA-Z0-9.(])/g,'Math.E');
  s = s.replace(/\^/g,'**'); s = s.replace(/(\d)([a-zA-Z(])/g,'$1*$2'); s = s.replace(/\)([a-zA-Z0-9(])/g,')*$1');
  return s;
}

function _evalExpr(raw,xVals){const expr=_normalizeExpr(raw);try{const fn=new Function('x','"use strict";return('+expr+');');return xVals.map(x=>{const v=fn(x);return isFinite(v)?v:null;});}catch(e){return null;}}
function _linspace(a,b,n=500){const step=(b-a)/(n-1);return Array.from({length:n},(_,i)=>a+i*step);}
function _distance(p1,p2){return Math.sqrt((p2[0]-p1[0])**2+(p2[1]-p1[1])**2);}
function _angle(p1,p2,p3){
  const v1=[p1[0]-p2[0],p1[1]-p2[1]];
  const v2=[p3[0]-p2[0],p3[1]-p2[1]];
  const dot=v1[0]*v2[0]+v1[1]*v2[1];
  const det=v1[0]*v2[1]-v1[1]*v2[0];
  const angle=Math.atan2(Math.abs(det),dot);
  return angle*180/Math.PI;
}

function renderPlotlyGraph(container,config){
  const{type='cartesian'}=config;
  if(type==='parametric')return _renderParametricGraph(container,config);
  if(type==='polar')return _renderPolarGraph(container,config);
  if(type==='3d')return _render3DGraph(container,config);
  if(type==='parabola')return _renderParabolaGraph(container,config);
  if(type==='geometry')return _renderGeometryGraph(container,config);
  return _renderCartesianGraph(container,config);
}

function _addCodeBlock(wrap,code){
  const details=document.createElement('details');
  details.className='graph-code-block';
  details.style.cssText='margin-top:8px;border:1px solid var(--border);border-radius:8px;overflow:hidden;font-size:12px;background:var(--bg2);';
  const summary=document.createElement('summary');
  summary.style.cssText='padding:8px 12px;cursor:pointer;color:var(--text3);user-select:none;display:flex;align-items:center;gap:8px;';
  summary.innerHTML='📊 Python код для графика';
  const pre=document.createElement('pre');
  pre.style.cssText='margin:0;padding:12px;overflow-x:auto;background:var(--bg1);';
  const codeEl=document.createElement('code');
  codeEl.className='language-python';
  codeEl.textContent=code;
  pre.appendChild(codeEl);
  details.appendChild(summary);
  details.appendChild(pre);
  wrap.appendChild(details);
  try{hljs.highlightElement(codeEl);}catch(_){}
}

function _renderCartesianGraph(container,{exprs,title,xLabel='x',yLabel='y',xRange}){
  const isDark=document.documentElement.getAttribute('data-theme')!=='light';
  const xMin=xRange?.[0]??-10,xMax=xRange?.[1]??10,xSpan=xMax-xMin;
  const xVals=_linspace(xMin-xSpan*4,xMax+xSpan*4,3000);
  const plotBg=isDark?'#1a1a1a':'#ffffff',paperBg=isDark?'#1e1e1e':'#ffffff';
  const fontColor=isDark?'#d1d5db':'#374151',gridColor=isDark?'#2d2d2d':'#f0f0f0',zeroColor=isDark?'#4b5563':'#d1d5db';
  const lineColors=['#60a5fa','#34d399','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
  const traces=exprs.map((expr,i)=>({x:xVals,y:_evalExpr(expr.fn,xVals),type:'scatter',mode:'lines',name:expr.label||`y = ${expr.fn}`,line:{color:lineColors[i%lineColors.length],width:2.5,shape:'spline'},connectgaps:false,hovertemplate:'x: %{x:.3f}<br>y: %{y:.3f}<extra></extra>'}));
  const axBase={gridcolor:gridColor,gridwidth:1,zerolinecolor:zeroColor,zerolinewidth:1.5,tickfont:{color:fontColor,size:11},showgrid:true,zeroline:true};
  const layout={paper_bgcolor:paperBg,plot_bgcolor:plotBg,font:{color:fontColor,family:'Inter,sans-serif',size:12},xaxis:{...axBase,range:xRange?[xRange[0],xRange[1]]:undefined,autorange:!xRange,title:{text:xLabel,font:{size:12,color:fontColor}}},yaxis:{...axBase,title:{text:yLabel,font:{size:12,color:fontColor}}},title:title?{text:title,font:{size:14,color:fontColor},x:0.5,xanchor:'center',pad:{t:8,b:4}}:undefined,margin:{l:48,r:24,t:title?44:24,b:40},hovermode:'x unified',showlegend:exprs.length>1,legend:{font:{size:11,color:fontColor},bgcolor:'transparent',borderwidth:0}};
  const wrap=document.createElement('div');wrap.className='averon-plotly-wrap';wrap.style.cssText='border-radius:12px;overflow:hidden;margin:12px 0;';
  const plotDiv=document.createElement('div');plotDiv.style.cssText='width:100%;height:320px;';
  wrap.appendChild(plotDiv);container.appendChild(wrap);
  if(window.Plotly)Plotly.newPlot(plotDiv,traces,layout,{responsive:true,displaylogo:false,modeBarButtonsToRemove:['lasso2d','select2d','autoScale2d']});
  let pythonCode=`import numpy as np\nimport matplotlib.pyplot as plt\n\nx = np.linspace(${xMin}, ${xMax}, 3000)\n`;
  exprs.forEach((expr,i)=>{pythonCode+=`y${i+1} = ${expr.fn.replace(/Math\./g,'np.').replace(/PI/g,'np.pi').replace(/E/g,'np.e')}\n`;});
  pythonCode+=`\nplt.figure(figsize=(10, 6))\n`;
  exprs.forEach((expr,i)=>{pythonCode+=`plt.plot(x, y${i+1}, label='${expr.label||`y = ${expr.fn}`}')\n`;});
  pythonCode+=`plt.xlabel('${xLabel}')\nplt.ylabel('${yLabel}')\n`;
  if(title)pythonCode+=`plt.title('${title}')\n`;
  if(exprs.length>1)pythonCode+=`plt.legend()\n`;
  pythonCode+=`plt.grid(True)\nplt.show()`;
  _addCodeBlock(wrap,pythonCode);
}

function _renderParametricGraph(container,{xFn,yFn,title,tRange=[-2*Math.PI,2*Math.PI]}){
  const isDark=document.documentElement.getAttribute('data-theme')!=='light';
  const tVals=_linspace(tRange[0],tRange[1],2000);
  try{
    const xE=_normalizeExpr(xFn),yE=_normalizeExpr(yFn);
    const xF=new Function('t','"use strict";return('+xE+');'),yF=new Function('t','"use strict";return('+yE+');');
    const xs=tVals.map(t=>{const v=xF(t);return isFinite(v)?v:null}),ys=tVals.map(t=>{const v=yF(t);return isFinite(v)?v:null});
    const fontColor=isDark?'#d1d5db':'#374151',gridColor=isDark?'#2d2d2d':'#f0f0f0';
    const wrap=document.createElement('div');wrap.className='averon-plotly-wrap';wrap.style.cssText='border-radius:12px;overflow:hidden;margin:12px 0;';
    const plotDiv=document.createElement('div');plotDiv.style.cssText='width:100%;height:320px;';wrap.appendChild(plotDiv);container.appendChild(wrap);
    if(window.Plotly)Plotly.newPlot(plotDiv,[{x:xs,y:ys,type:'scatter',mode:'lines',line:{color:'#60a5fa',width:2.5}}],{paper_bgcolor:isDark?'#1e1e1e':'#fff',plot_bgcolor:isDark?'#1a1a1a':'#fff',font:{color:fontColor,family:'Inter,sans-serif',size:12},xaxis:{gridcolor:gridColor,zerolinecolor:isDark?'#4b5563':'#d1d5db',zerolinewidth:1.5,tickfont:{color:fontColor,size:11}},yaxis:{gridcolor:gridColor,zerolinecolor:isDark?'#4b5563':'#d1d5db',zerolinewidth:1.5,tickfont:{color:fontColor,size:11}},title:title?{text:title,font:{size:14,color:fontColor},x:0.5}:undefined,margin:{l:48,r:24,t:title?44:24,b:40}},{responsive:true,displaylogo:false});
    const xPy=xE.replace(/Math\./g,'np.').replace(/PI/g,'np.pi').replace(/E/g,'np.e');
    const yPy=yE.replace(/Math\./g,'np.').replace(/PI/g,'np.pi').replace(/E/g,'np.e');
    const pythonCode=`import numpy as np\nimport matplotlib.pyplot as plt\n\nt = np.linspace(${tRange[0].toFixed(4)}, ${tRange[1].toFixed(4)}, 2000)\nx = ${xPy}\ny = ${yPy}\n\nplt.figure(figsize=(10, 6))\nplt.plot(x, y)\nplt.xlabel('x')\nplt.ylabel('y')\n${title?`plt.title('${title}')\n`:''}plt.grid(True)\nplt.axis('equal')\nplt.show()`;
    _addCodeBlock(wrap,pythonCode);
  }catch(e){}
}

function _renderPolarGraph(container,{rFn,title,thetaRange=[0,2*Math.PI]}){
  const isDark=document.documentElement.getAttribute('data-theme')!=='light';
  const fontColor=isDark?'#d1d5db':'#374151';
  try{
    const rE=_normalizeExpr(rFn),rF=new Function('theta','th','"use strict";return('+rE+');');
    const tVals=_linspace(thetaRange[0],thetaRange[1],2000);
    const rs=tVals.map(t=>{const v=rF(t,t);return isFinite(v)?v:null});
    const wrap=document.createElement('div');wrap.className='averon-plotly-wrap';wrap.style.cssText='border-radius:12px;overflow:hidden;margin:12px 0;';
    const plotDiv=document.createElement('div');plotDiv.style.cssText='width:100%;height:320px;';wrap.appendChild(plotDiv);container.appendChild(wrap);
    if(window.Plotly)Plotly.newPlot(plotDiv,[{r:rs,theta:tVals.map(t=>t*180/Math.PI),type:'scatterpolar',mode:'lines',line:{color:'#60a5fa',width:2}}],{polar:{bgcolor:isDark?'#1a1a1a':'#fff',angularaxis:{color:fontColor},radialaxis:{color:fontColor}},paper_bgcolor:isDark?'#1e1e1e':'#fff',font:{color:fontColor},title:title?{text:title,font:{size:14,color:fontColor},x:0.5}:undefined,margin:{l:24,r:24,t:title?44:24,b:24}},{responsive:true,displaylogo:false});
    const rPy=rE.replace(/Math\./g,'np.').replace(/PI/g,'np.pi').replace(/E/g,'np.e');
    const pythonCode=`import numpy as np\nimport matplotlib.pyplot as plt\n\ntheta = np.linspace(${thetaRange[0].toFixed(4)}, ${thetaRange[1].toFixed(4)}, 2000)\nr = ${rPy}\n\nplt.figure(figsize=(8, 8))\nax = plt.subplot(111, projection='polar')\nax.plot(theta, r)\nax.grid(True)\n${title?`ax.set_title('${title}', va='bottom')\n`:''}plt.show()`;
    _addCodeBlock(wrap,pythonCode);
  }catch(e){}
}

function _render3DGraph(container,{surface3D,title}){
  if(!surface3D)return;
  const isDark=document.documentElement.getAttribute('data-theme')!=='light';
  const fontColor=isDark?'#d1d5db':'#374151';
  const xVals=_linspace(surface3D.x?.[0]??-5,surface3D.x?.[1]??5,60),yVals=_linspace(surface3D.y?.[0]??-5,surface3D.y?.[1]??5,60);
  try{
    const zE=_normalizeExpr(surface3D.fn),zF=new Function('x','y','"use strict";return('+zE+');');
    const z=yVals.map(y=>xVals.map(x=>{const v=zF(x,y);return isFinite(v)?v:null}));
    const wrap=document.createElement('div');wrap.className='averon-plotly-wrap';wrap.style.cssText='border-radius:12px;overflow:hidden;margin:12px 0;';
    const plotDiv=document.createElement('div');plotDiv.style.cssText='width:100%;height:380px;';wrap.appendChild(plotDiv);container.appendChild(wrap);
    if(window.Plotly)Plotly.newPlot(plotDiv,[{x:xVals,y:yVals,z,type:'surface',colorscale:'Viridis',showscale:false}],{paper_bgcolor:isDark?'#1e1e1e':'#fff',font:{color:fontColor,size:11},scene:{xaxis:{color:fontColor},yaxis:{color:fontColor},zaxis:{color:fontColor},bgcolor:isDark?'#1a1a1a':'#fff'},title:title?{text:title,font:{size:14,color:fontColor},x:0.5}:undefined,margin:{l:0,r:0,t:title?44:20,b:0}},{responsive:true,displaylogo:false});
    const zPy=zE.replace(/Math\./g,'np.').replace(/PI/g,'np.pi').replace(/E/g,'np.e');
    const xMin=surface3D.x?.[0]??-5,xMax=surface3D.x?.[1]??5;
    const yMin=surface3D.y?.[0]??-5,yMax=surface3D.y?.[1]??5;
    const pythonCode=`import numpy as np\nimport matplotlib.pyplot as plt\nfrom mpl_toolkits.mplot3d import Axes3D\n\nx = np.linspace(${xMin}, ${xMax}, 60)\ny = np.linspace(${yMin}, ${yMax}, 60)\nX, Y = np.meshgrid(x, y)\nZ = ${zPy}\n\nfig = plt.figure(figsize=(10, 8))\nax = fig.add_subplot(111, projection='3d')\nsurf = ax.plot_surface(X, Y, Z, cmap='viridis')\nax.set_xlabel('X')\nax.set_ylabel('Y')\nax.set_zlabel('Z')\n${title?`ax.set_title('${title}')\n`:''}plt.colorbar(surf)\nplt.show()`;
    _addCodeBlock(wrap,pythonCode);
  }catch(e){}
}

function _parseParabola(raw){
  const s=raw.trim().toLowerCase().replace(/\s+/g,'');
  let a=1,b=0,c=0,h=0,k=0,p=1,form='standard',opening='up';
  const standardMatch=s.match(/^y=([+-]?[\d.]*(?:x\^2|x\*\*2))([+-]?[\d.]*x)?([+-]?[\d.]+)?$/);
  if(standardMatch){
    const aPart=standardMatch[1].replace(/x\^2|x\*\*2/,'').replace(/^[+-]?$/,'1').replace(/^-$/,'-1');
    a=parseFloat(aPart)||1;
    if(standardMatch[2]){const bPart=standardMatch[2].replace(/x$/,'');b=parseFloat(bPart)||0;}
    if(standardMatch[3])c=parseFloat(standardMatch[3])||0;
    if(Math.abs(a)<0.0001)return null;
    h=-b/(2*a);k=a*h*h+b*h+c;form='standard';
    opening=a>0?'up':'down';
    p=1/(4*a);
    return{a,b,c,h,k,p,form,opening,fn:`${a}*x**2+${b}*x+${c}`};
  }
  const vertexMatch=s.match(/^[yY]=([+-]?[\d.]+)?\*?\(?(x([+-]?[\d.]+))\)?\^2([+-]?[\d.]+)?$/);
  if(vertexMatch){
    a=parseFloat(vertexMatch[1])||1;
    if(Math.abs(a)<0.0001)return null;
    h=-(parseFloat(vertexMatch[2])||0);
    k=parseFloat(vertexMatch[3])||0;
    b=-2*a*h;c=a*h*h+k;
    opening=a>0?'up':'down';p=1/(4*a);
    return{a,b,c,h,k,p,form,opening,fn:`${a}*(x-${h})**2+${k}`};
  }
  const simpleMatch=s.match(/^y=([+-]?[\d.]*)x\^2([+-][\d.]+)?$/);
  if(simpleMatch){
    a=parseFloat(simpleMatch[1].replace(/^[+-]?$/,'1'))||1;
    if(Math.abs(a)<0.0001)return null;
    if(simpleMatch[2])k=parseFloat(simpleMatch[2]);else k=0;
    h=0;b=0;c=k;
    opening=a>0?'up':'down';p=1/(4*a);
    return{a,b,c,h,k,p,form:'vertex',opening,fn:`${a}*x**2+${k}`};
  }
  if(s.includes('x^2')||s.includes('x**2')||s.includes('xx')){
    try{const clean=s.replace(/y=/,'');const fn=_normalizeExpr(clean);
      const testFn=new Function('x','return('+fn+')');
      const testY=testFn(0),testY2=testFn(1),testY3=testFn(-1);
      const testA=(testY2+testY3-2*testY)/2;
      const testB=(testY2-testY3)/2;
      a=testB===0&&testY2===testY?0:testA;
      b=testB;c=testY;
      h=-b/(2*a);k=a*h*h+b*h+c;
      opening=a>0?'up':'down';p=1/(4*a);
      return{a,b,c,h,k,p,form:'detected',opening,fn};
    }catch(e){
      return null;
    }
  }
  return null;
}

function _renderParabolaGraph(container,{parabola,title,xRange}){
  if(!parabola)return;
  const{a,b,c,h,k,p,opening,fn}=parabola;
  const isDark=document.documentElement.getAttribute('data-theme')!=='light';
  const plotBg=isDark?'#1a1a1a':'#ffffff',paperBg=isDark?'#1e1e1e':'#ffffff';
  const fontColor=isDark?'#d1d5db':'#374151',gridColor=isDark?'#2d2d2d':'#f0f0f0',zeroColor=isDark?'#4b5563':'#d1d5db';
  const xSpan=Math.max(10,4*Math.sqrt(Math.abs(1/a)));
  const xMin=xRange?.[0]??(h-xSpan),xMax=xRange?.[1]??(h+xSpan);
  const xVals=_linspace(xMin,xMax,1000);
  const yVals=xVals.map(x=>{const v=a*x*x+b*x+c;return isFinite(v)?v:null;});
  const wrap=document.createElement('div');wrap.className='averon-plotly-wrap';wrap.style.cssText='border-radius:12px;overflow:hidden;margin:12px 0;border:1px solid var(--border);';
  const plotDiv=document.createElement('div');plotDiv.style.cssText='width:100%;height:360px;';
  const traces=[{x:xVals,y:yVals,type:'scatter',mode:'lines',name:'Парабола',line:{color:'#60a5fa',width:3,shape:'spline'},hovertemplate:'x: %{x:.3f}<br>y: %{y:.3f}<extra></extra>'}];
  const vertexX=h,vertexY=k;
  const focusX=h,focusY=opening==='up'?k+p:k-p;
  traces.push({x:[vertexX],y:[vertexY],type:'scatter',mode:'markers',name:'Вершина',marker:{color:'#ef4444',size:12,symbol:'diamond'},hovertemplate:'Вершина<br>x: %{x:.3f}<br>y: %{y:.3f}<extra></extra>'});
  traces.push({x:[focusX],y:[focusY],type:'scatter',mode:'markers',name:'Фокус',marker:{color:'#f59e0b',size:10,symbol:'circle'},hovertemplate:'Фокус<br>x: %{x:.3f}<br>y: %{y:.3f}<extra></extra>'});
  const dirY=opening==='up'?k-p:k+p;
  traces.push({x:[xMin,xMax],y:[dirY,dirY],type:'scatter',mode:'lines',name:'Директриса',line:{color:'#8b5cf6',width:2,dash:'dash'},hovertemplate:'Директриса y='+dirY.toFixed(3)+'<extra></extra>'});
  const axBase={gridcolor:gridColor,gridwidth:1,zerolinecolor:zeroColor,zerolinewidth:1.5,tickfont:{color:fontColor,size:11},showgrid:true,zeroline:true};
  const displayTitle=title||`y = ${a.toFixed(2)}x² ${b>=0?'+':'-'} ${Math.abs(b).toFixed(2)}x ${c>=0?'+':'-'} ${Math.abs(c).toFixed(2)}`;
  const layout={paper_bgcolor:paperBg,plot_bgcolor:plotBg,font:{color:fontColor,family:'Inter,sans-serif',size:12},xaxis:{...axBase,range:[xMin,xMax],title:{text:'x',font:{size:12,color:fontColor}}},yaxis:{...axBase,title:{text:'y',font:{size:12,color:fontColor}},scaleanchor:'x',scaleratio:1},title:{text:displayTitle,font:{size:14,color:fontColor},x:0.5,xanchor:'center',pad:{t:8,b:4}},margin:{l:48,r:24,t:48,b:40},hovermode:'x unified',showlegend:true,legend:{font:{size:11,color:fontColor},bgcolor:'transparent',borderwidth:0,yanchor:'top',y:0.99,xanchor:'left',x:0.01}};
  wrap.appendChild(plotDiv);container.appendChild(wrap);
  if(window.Plotly)Plotly.newPlot(plotDiv,traces,layout,{responsive:true,displaylogo:false,modeBarButtonsToRemove:['lasso2d','select2d','autoScale2d']});
  const infoDiv=document.createElement('div');infoDiv.className='graph-info';
  infoDiv.innerHTML=`<div class="graph-info-item"><span class="graph-info-label">Вершина:</span><span class="graph-info-value">(${h.toFixed(2)}, ${k.toFixed(2)})</span></div><div class="graph-info-item"><span class="graph-info-label">Фокус:</span><span class="graph-info-value">(${focusX.toFixed(2)}, ${focusY.toFixed(2)})</span></div><div class="graph-info-item"><span class="graph-info-label">p =</span><span class="graph-info-value">${Math.abs(p).toFixed(3)}</span></div><div class="graph-info-item"><span class="graph-info-label">Направление:</span><span class="graph-info-value">${opening==='up'?'вверх':'вниз'}</span></div>`;
  wrap.appendChild(infoDiv);
  const pythonCode=`import numpy as np\nimport matplotlib.pyplot as plt\n\na = ${a}\nb = ${b}\nc = ${c}\nh = ${h}\nk = ${k}\np = ${p}\n\nx = np.linspace(${xMin.toFixed(2)}, ${xMax.toFixed(2)}, 1000)\ny = a * x**2 + b * x + c\n\nvertex_x = h\nvertex_y = k\nfocus_x = h\nfocus_y = ${focusY.toFixed(4)}\ndirectrix_y = ${dirY.toFixed(4)}\n\nplt.figure(figsize=(10, 6))\nplt.plot(x, y, label='Парабола', linewidth=2)\nplt.scatter([vertex_x], [vertex_y], color='red', s=100, marker='D', label='Вершина', zorder=5)\nplt.scatter([focus_x], [focus_y], color='orange', s=80, marker='o', label='Фокус', zorder=5)\nplt.axhline(y=directrix_y, color='purple', linestyle='--', linewidth=2, label='Директриса')\nplt.xlabel('x')\nplt.ylabel('y')\nplt.title('${displayTitle}')\nplt.legend()\nplt.grid(True)\nplt.axis('equal')\nplt.show()`;
  _addCodeBlock(wrap,pythonCode);
}

function _renderGeometryGraph(container,config){
  const{geometry,title}=config;
  if(!geometry)return;
  const isDark=document.documentElement.getAttribute('data-theme')!=='light';
  const plotBg=isDark?'#1a1a1a':'#ffffff',paperBg=isDark?'#1e1e1e':'#ffffff';
  const fontColor=isDark?'#d1d5db':'#374151',gridColor=isDark?'#2d2d2d':'#f0f0f0',zeroColor=isDark?'#4b5563':'#d1d5db';
  const wrap=document.createElement('div');wrap.className='averon-plotly-wrap';wrap.style.cssText='border-radius:12px;overflow:hidden;margin:12px 0;border:1px solid var(--border);';
  const plotDiv=document.createElement('div');plotDiv.style.cssText='width:100%;height:360px;';
  const traces=[];
  let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;

  if(geometry.shape==='triangle'){
    const points=geometry.points;
    const xs=[points[0][0],points[1][0],points[2][0],points[0][0]];
    const ys=[points[0][1],points[1][1],points[2][1],points[0][1]];
    xs.forEach(v=>{xMin=Math.min(xMin,v);xMax=Math.max(xMax,v);});
    ys.forEach(v=>{yMin=Math.min(yMin,v);yMax=Math.max(yMax,v);});
    
    // Calculate side lengths and angles
    const sideAB=_distance(points[0],points[1]);
    const sideBC=_distance(points[1],points[2]);
    const sideCA=_distance(points[2],points[0]);
    const angleA=_angle(points[1],points[0],points[2]);
    const angleB=_angle(points[0],points[1],points[2]);
    const angleC=_angle(points[0],points[2],points[1]);
    
    traces.push({x:xs,y:ys,type:'scatter',mode:'lines',fill:'toself',name:'Треугольник',line:{color:'#60a5fa',width:3},fillcolor:'rgba(96,165,250,0.2)'});
    
    // Add invisible points at midpoints for side length hover
    const midAB=[(points[0][0]+points[1][0])/2,(points[0][1]+points[1][1])/2];
    const midBC=[(points[1][0]+points[2][0])/2,(points[1][1]+points[2][1])/2];
    const midCA=[(points[2][0]+points[0][0])/2,(points[2][1]+points[0][1])/2];
    
    traces.push({x:[midAB[0]],y:[midAB[1]],type:'scatter',mode:'markers',name:'Сторона AB',marker:{color:'transparent',size:30},hovertemplate:'Сторона AB: '+sideAB.toFixed(2)+' см<extra></extra>',hoverinfo:'text+x+y'});
    traces.push({x:[midBC[0]],y:[midBC[1]],type:'scatter',mode:'markers',name:'Сторона BC',marker:{color:'transparent',size:30},hovertemplate:'Сторона BC: '+sideBC.toFixed(2)+' см<extra></extra>',hoverinfo:'text+x+y'});
    traces.push({x:[midCA[0]],y:[midCA[1]],type:'scatter',mode:'markers',name:'Сторона CA',marker:{color:'transparent',size:30},hovertemplate:'Сторона CA: '+sideCA.toFixed(2)+' см<extra></extra>',hoverinfo:'text+x+y'});
    
    // Add vertices with angle hover
    points.forEach((p,i)=>{
      const angleText=[angleA,angleB,angleC][i];
      traces.push({x:[p[0]],y:[p[1]],type:'scatter',mode:'markers+text',name:`Угол ${String.fromCharCode(65+i)}`,marker:{color:'#ef4444',size:10},text:[String.fromCharCode(65+i)],textposition:'top center',textfont:{size:14,color:fontColor},hovertemplate:`Угол ${String.fromCharCode(65+i)}: ${angleText.toFixed(1)}°<extra></extra>`,hoverinfo:'text+x+y'});
    });
  }
  else if(geometry.shape==='circle'){
    const{center,radius}=geometry;
    const theta=_linspace(0,2*Math.PI,100);
    const xs=theta.map(t=>center[0]+radius*Math.cos(t));
    const ys=theta.map(t=>center[1]+radius*Math.sin(t));
    xMin=center[0]-radius;xMax=center[0]+radius;yMin=center[1]-radius;yMax=center[1]+radius;
    traces.push({x:xs,y:ys,type:'scatter',mode:'lines',name:'Окружность',line:{color:'#60a5fa',width:3},hovertemplate:'Радиус: '+radius.toFixed(2)+' см<extra></extra>'});
    traces.push({x:[center[0]],y:[center[1]],type:'scatter',mode:'markers',name:'Центр',marker:{color:'#ef4444',size:12,symbol:'circle'},hovertemplate:'Центр: ('+center[0].toFixed(1)+', '+center[1].toFixed(1)+')<extra></extra>'});
  }
  else if(geometry.shape==='rectangle'){
    const points=geometry.points;
    const xs=[points[0][0],points[1][0],points[2][0],points[3][0],points[0][0]];
    const ys=[points[0][1],points[1][1],points[2][1],points[3][1],points[0][1]];
    xs.forEach(v=>{xMin=Math.min(xMin,v);xMax=Math.max(xMax,v);});
    ys.forEach(v=>{yMin=Math.min(yMin,v);yMax=Math.max(yMax,v);});
    
    // Calculate side lengths
    const sideAB=_distance(points[0],points[1]);
    const sideBC=_distance(points[1],points[2]);
    const sideCD=_distance(points[2],points[3]);
    const sideDA=_distance(points[3],points[0]);
    
    traces.push({x:xs,y:ys,type:'scatter',mode:'lines',fill:'toself',name:'Прямоугольник',line:{color:'#60a5fa',width:3},fillcolor:'rgba(96,165,250,0.2)'});
    
    // Add invisible points at midpoints for side length hover
    const midAB=[(points[0][0]+points[1][0])/2,(points[0][1]+points[1][1])/2];
    const midBC=[(points[1][0]+points[2][0])/2,(points[1][1]+points[2][1])/2];
    const midCD=[(points[2][0]+points[3][0])/2,(points[2][1]+points[3][1])/2];
    const midDA=[(points[3][0]+points[0][0])/2,(points[3][1]+points[0][1])/2];
    
    traces.push({x:[midAB[0]],y:[midAB[1]],type:'scatter',mode:'markers',name:'Сторона AB',marker:{color:'transparent',size:30},hovertemplate:'Сторона AB: '+sideAB.toFixed(2)+' см<extra></extra>',hoverinfo:'text+x+y'});
    traces.push({x:[midBC[0]],y:[midBC[1]],type:'scatter',mode:'markers',name:'Сторона BC',marker:{color:'transparent',size:30},hovertemplate:'Сторона BC: '+sideBC.toFixed(2)+' см<extra></extra>',hoverinfo:'text+x+y'});
    traces.push({x:[midCD[0]],y:[midCD[1]],type:'scatter',mode:'markers',name:'Сторона CD',marker:{color:'transparent',size:30},hovertemplate:'Сторона CD: '+sideCD.toFixed(2)+' см<extra></extra>',hoverinfo:'text+x+y'});
    traces.push({x:[midDA[0]],y:[midDA[1]],type:'scatter',mode:'markers',name:'Сторона DA',marker:{color:'transparent',size:30},hovertemplate:'Сторона DA: '+sideDA.toFixed(2)+' см<extra></extra>',hoverinfo:'text+x+y'});
  }

  const pad=Math.max(2,(xMax-xMin+yMax-yMin)/10);
  const axBase={gridcolor:gridColor,gridwidth:1,zerolinecolor:zeroColor,zerolinewidth:1.5,tickfont:{color:fontColor,size:11},showgrid:true,zeroline:true};
  const layout={paper_bgcolor:paperBg,plot_bgcolor:plotBg,font:{color:fontColor,family:'Inter,sans-serif',size:12},xaxis:{...axBase,range:[xMin-pad,xMax+pad],title:{text:'x',font:{size:12,color:fontColor}}},yaxis:{...axBase,range:[yMin-pad,yMax+pad],title:{text:'y',font:{size:12,color:fontColor}},scaleanchor:'x',scaleratio:1},title:{text:title||'Геометрическая фигура',font:{size:14,color:fontColor},x:0.5,xanchor:'center',pad:{t:8,b:4}},margin:{l:48,r:24,t:48,b:40},hovermode:'closest',showlegend:true,legend:{font:{size:11,color:fontColor},bgcolor:'transparent',borderwidth:0,yanchor:'top',y:0.99,xanchor:'left',x:0.01}};
  wrap.appendChild(plotDiv);container.appendChild(wrap);
  if(window.Plotly)Plotly.newPlot(plotDiv,traces,layout,{responsive:true,displaylogo:false,modeBarButtonsToRemove:['lasso2d','select2d','autoScale2d']});
}

function _parseGeometry(s){
  // Parse geometry shape definitions
  // Format: triangle: A=(0,0), B=(4,0), C=(2,3)
  // Format: circle: center=(0,0), radius=3
  const lower=s.toLowerCase().trim();
  if(lower.startsWith('triangle')||lower.startsWith('треугольник')){
    const coords=s.match(/[\(\[]?\s*([\d.-]+)\s*,\s*([\d.-]+)\s*[\)\]]/g);
    if(coords&&coords.length===3){
      const points=coords.map(c=>c.match(/([\d.-]+)\s*,\s*([\d.-]+)/).slice(1).map(Number));
      return{shape:'triangle',points};
    }
  }
  if(lower.startsWith('circle')||lower.startsWith('круг')||lower.startsWith('окружность')){
    const center=s.match(/center[\s=:]\s*[\(\[]?\s*([\d.-]+)\s*,\s*([\d.-]+)\s*[\)\]]/i);
    const radius=s.match(/radius[\s=:]\s*([\d.-]+)/i);
    if(center&&radius){
      return{shape:'circle',center:[parseFloat(center[1]),parseFloat(center[2])],radius:parseFloat(radius[1])};
    }
  }
  if(lower.startsWith('rectangle')||lower.startsWith('прямоугольник')){
    const coords=s.match(/[\(\[]?\s*([\d.-]+)\s*,\s*([\d.-]+)\s*[\)\]]/g);
    if(coords&&coords.length>=2){
      const points=coords.slice(0,4).map(c=>c.match(/([\d.-]+)\s*,\s*([\d.-]+)/).slice(1).map(Number));
      if(points.length===2)points.push([points[1][0],points[0][1]],[points[0][0],points[1][1]]);
      return{shape:'rectangle',points};
    }
  }
  return null;
}

function _parseGraphBlock(raw){
  const lines=raw.trim().split('\n').map(l=>l.trim()).filter(Boolean);
  let type='cartesian',exprs=[],title='',xRange,yRange,tRange,xFn,yFn,surface3D=null,parabola=null,geometry=null,geometryParams={};
  for(const line of lines){
    const kv=line.match(/^(\w+)\s*[:=]\s*(.+)$/i);if(!kv){continue;}
    const[,key,val]=kv,k=key.toLowerCase().trim();
    if(k==='title'){title=val.trim();continue;}
    if(k==='type'){type=val.trim().toLowerCase();continue;}
    if(k==='t'||k==='trange'){const r=val.match(/([-\d.]+)\s*,\s*([-\d.]+)/);if(r)tRange=[parseFloat(r[1]),parseFloat(r[2])];continue;}
    if(k==='xrange'){const r=val.match(/([-\d.]+)\s*,\s*([-\d.]+)/);if(r)xRange=[parseFloat(r[1]),parseFloat(r[2])];continue;}
    if(k==='yrange'){const r=val.match(/([-\d.]+)\s*,\s*([-\d.]+)/);if(r)yRange=[parseFloat(r[1]),parseFloat(r[2])];continue;}
    if(k==='x'){
      if(type==='parametric'){xFn=val.trim();continue;}
      const r=val.match(/([-\d.]+)\s*,\s*([-\d.]+)/);
      if(r)xRange=[parseFloat(r[1]),parseFloat(r[2])];
      continue;
    }
    if(k==='y'){
      if(type==='parametric'){yFn=val.trim();continue;}
      const r=val.match(/([-\d.]+)\s*,\s*([-\d.]+)/);
      if(r)yRange=[parseFloat(r[1]),parseFloat(r[2])];
      else if(type==='cartesian'){exprs.push({fn:_normalizeExpr(val.trim()),label:null});}
      continue;
    }
    if(k==='xfn'){xFn=val.trim();continue;}
    if(k==='yfn'){yFn=val.trim();continue;}
    if(k==='fn'||k==='function'||k==='f'){exprs.push({fn:_normalizeExpr(val.trim()),label:null});continue;}
    if(k==='z'){surface3D={fn:_normalizeExpr(val.trim()),x:xRange,y:yRange};type='3d';continue;}
    if(k==='label'&&exprs.length){exprs[exprs.length-1].label=val.trim();continue;}
    if(k==='parabola'){parabola=_parseParabola(val.trim());if(parabola)type='parabola';continue;}
    // Collect geometry parameters
    if(k==='shape'||k==='geometry'){geometryParams.shape=val.trim().toLowerCase();type='geometry';continue;}
    if(k==='point_a'||k==='a'||k==='vertex_a'){const coords=val.match(/[\(\[]?\s*([\d.-]+)\s*,\s*([\d.-]+)\s*[\)\]]/);if(coords)geometryParams.pointA=[parseFloat(coords[1]),parseFloat(coords[2])];continue;}
    if(k==='point_b'||k==='b'||k==='vertex_b'){const coords=val.match(/[\(\[]?\s*([\d.-]+)\s*,\s*([\d.-]+)\s*[\)\]]/);if(coords)geometryParams.pointB=[parseFloat(coords[1]),parseFloat(coords[2])];continue;}
    if(k==='point_c'||k==='c'||k==='vertex_c'){const coords=val.match(/[\(\[]?\s*([\d.-]+)\s*,\s*([\d.-]+)\s*[\)\]]/);if(coords)geometryParams.pointC=[parseFloat(coords[1]),parseFloat(coords[2])];continue;}
    if(k==='point_d'||k==='d'||k==='vertex_d'){const coords=val.match(/[\(\[]?\s*([\d.-]+)\s*,\s*([\d.-]+)\s*[\)\]]/);if(coords)geometryParams.pointD=[parseFloat(coords[1]),parseFloat(coords[2])];continue;}
    if(k==='center'){const coords=val.match(/[\(\[]?\s*([\d.-]+)\s*,\s*([\d.-]+)\s*[\)\]]/);if(coords)geometryParams.center=[parseFloat(coords[1]),parseFloat(coords[2])];continue;}
    if(k==='radius'){geometryParams.radius=parseFloat(val);continue;}
    if(k==='points'||k==='coords'){const coords=val.split(',').map(s=>s.trim().match(/[\(\[]?\s*([\d.-]+)\s*,\s*([\d.-]+)\s*[\)\]]/)).filter(Boolean).map(c=>[parseFloat(c[1]),parseFloat(c[2])]);geometryParams.points=coords;continue;}
  }
  // Build geometry object from collected parameters
  if(type==='geometry'&&geometryParams.shape){
    if(geometryParams.shape==='triangle'||geometryParams.shape==='треугольник'){
      const points=[];
      if(geometryParams.pointA)points.push(geometryParams.pointA);
      if(geometryParams.pointB)points.push(geometryParams.pointB);
      if(geometryParams.pointC)points.push(geometryParams.pointC);
      if(points.length===3)geometry={shape:'triangle',points};
    }
    else if(geometryParams.shape==='circle'||geometryParams.shape==='круг'||geometryParams.shape==='окружность'){
      if(geometryParams.center&&geometryParams.radius)geometry={shape:'circle',center:geometryParams.center,radius:geometryParams.radius};
    }
    else if(geometryParams.shape==='rectangle'||geometryParams.shape==='прямоугольник'){
      const points=geometryParams.points||[];
      if(geometryParams.pointA)points.push(geometryParams.pointA);
      if(geometryParams.pointB)points.push(geometryParams.pointB);
      if(points.length===2)points.push([points[1][0],points[0][1]],[points[0][0],points[1][1]]);
      if(points.length>=2)geometry={shape:'rectangle',points};
    }
  }
  if(type==='3d'&&surface3D){surface3D.x=xRange||surface3D.x;surface3D.y=yRange||surface3D.y;return{type:'3d',surface3D,title};}
  if(type==='parametric'&&xFn&&yFn){return{type:'parametric',xFn,yFn,title,tRange};}
  if(type==='parabola'&&parabola){return{type:'parabola',parabola,title,xRange};}
  if(type==='geometry'&&geometry){return{type:'geometry',geometry,title};}
  if(exprs.length){return{type:'cartesian',exprs,title,xRange};}
  return null;
}

// ── Main renderMD with MathJax ────────────────────────────────────────────────
function renderMD(text){
  window._pendingGraphBlocks=window._pendingGraphBlocks||[];
  const pending=window._pendingGraphBlocks;

  // 0. Process graph blocks FIRST (before protecting code blocks)
  text=text.replace(/```graph\n([\s\S]*?)```/g,(_,inner)=>{const idx=pending.length;pending.push({type:'graph',raw:inner});return`<div class="averon-graph-ph" data-gi="${idx}"></div>`;});
  text=text.replace(/```python(?:\s+\S*)?\n([\s\S]*?)```/g,(match,code)=>{const isPlot=(code.includes('matplotlib')||code.includes('plt.plot')||code.includes('plt.show'))&&(code.includes('np.')||code.includes('numpy'));if(!isPlot)return match;const idx=pending.length;pending.push({type:'python',code});return`<div class="averon-graph-ph" data-gi="${idx}"></div>`;});

  // 0.5. Process poem blocks
  text=text.replace(/```poem\n([\s\S]*?)```/g,(_,poem)=>`<div class="poem-block">${poem.trim()}</div>`);
  text=text.replace(/```стихотворение\n([\s\S]*?)```/g,(_,poem)=>`<div class="poem-block">${poem.trim()}</div>`);

  // 0.6. Process geometry blocks
  text=text.replace(/```geometry\n([\s\S]*?)```/g,(_,geometry)=>`<div class="geometry-block">${geometry.trim()}</div>`);
  text=text.replace(/```геометрия\n([\s\S]*?)```/g,(_,geometry)=>`<div class="geometry-block">${geometry.trim()}</div>`);

  // 1. Protect code blocks (but not graph blocks which are already processed)
  const mdProtected=[];
  text=text.replace(/```[\s\S]*?```|`[^`]+`/g,m=>{mdProtected.push(m);return`\x00MDPROT${mdProtected.length-1}\x00`;});

  // 2. Decode HTML entities (model sometimes outputs &quot; etc.)
  text=text.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'");

  // 3. Convert model step notation [Label: [formula]] → **Label:**\n\n$$formula$$
  text=text.replace(/\[([^\[\]]{1,120}?):\s*\[([^\[\]]+?)\]\]/g,(_,label,math)=>`\n\n**${label.trim()}:**\n\n$$${math.trim()}$$\n\n`);

  // 4. Convert [LaTeX formula] brackets that have LaTeX commands → $$formula$$
  text=text.replace(/\[\s*([\s\S]*?(?:\\[a-zA-Z]+|\\frac|\\dfrac|\\sqrt|\\implies|\\Longrightarrow|\\cdot|\{|\})[\s\S]*?)\s*\](?!\()/g,(_,math)=>`\n\n$$${math.replace(/\s+/g,' ').trim()}$$\n\n`);

  // 5. Convert \(...\) → $...$
  text=text.replace(/\\\((.+?)\\\)/g,(_,math)=>`$${math.trim()}$`);

  // 6. Convert \[...\] → $$...$$
  text=text.replace(/\\\[([\s\S]+?)\\\]/g,(_,math)=>`\n\n$$${math.trim()}$$\n\n`);

  // 7. Auto-detect functions for graphing (only when no explicit graph block)
  const hasPythonOrGraph=text.includes('```graph')||/```python/i.test(text);
  if(!hasPythonOrGraph){
    // Check for parabola patterns first
    const parabolaPats=[/y\s*=\s*([+-]?[\d.]*)\s*\*?\s*x\^2/gi,/y\s*=\s*([+-]?[\d.]*)\s*\*?\s*x\*\*2/gi,/парабол[аы]/gi];
    let parabolaMatch=null;
    for(const pat of parabolaPats){const m=pat.exec(text);if(m){parabolaMatch=m;break;}}
    if(parabolaMatch){
      const yEqPats=[/y\s*=\s*([+-]?[\d.]*\s*\*?\s*x\^2[\s\d+\-*.]*)/gi,/y\s*=\s*([+-]?[\d.]*\s*\*?\s*x\*\*2[\s\d+\-*.]*)/gi];
      let fnFound=null,xMin=-10,xMax=10;
      for(const pat of yEqPats){let m;while((m=pat.exec(text))!==null){const rawFn=m[1].trim().replace(/[.!?\s]+$/,'');if(!rawFn.toLowerCase().includes('x'))continue;try{const jsFn=_normalizeExpr(rawFn);const testFn=new Function('x','"use strict";return('+jsFn+')');testFn(0);testFn(1);fnFound=rawFn;break;}catch(_){}}if(fnFound)break;}
      if(fnFound){const idx=pending.length;pending.push({type:'graph',raw:`parabola: ${fnFound}\nx = -10, 10`});text+=`\n\n<div class="averon-graph-ph" data-gi="${idx}"></div>`;}
    }else{
      const yEqPats=[/y\s*=\s*([^\n,;]{2,60})/gi,/f\(x\)\s*=\s*([^\n,;]{2,60})/gi];
      let fnFound=null,xMin=-10,xMax=10;
      for(const pat of yEqPats){let m;while((m=pat.exec(text))!==null){const rawFn=m[1].trim().replace(/[.!?\s]+$/,'');if(!rawFn.toLowerCase().includes('x'))continue;try{const jsFn=_normalizeExpr(rawFn);const v=new Function('x','"use strict";return('+jsFn+');')(1);if(!isFinite(v))continue;fnFound=jsFn;if(/cos|sin|tan/i.test(rawFn)){xMin=-2*Math.PI;xMax=2*Math.PI;}break;}catch(_){}}if(fnFound)break;}
      if(fnFound){const idx=pending.length;pending.push({type:'graph',raw:`x = ${xMin.toFixed(4)}, ${xMax.toFixed(4)}\ny = ${fnFound}`});text+=`\n\n<div class="averon-graph-ph" data-gi="${idx}"></div>`;}
    }
  }

  // 8. Restore protected blocks
  text=text.replace(/\x00MDPROT(\d+)\x00/g,(_,i)=>mdProtected[parseInt(i)]);

  // 8.5. Support custom markdown syntax (before marked.parse)
  // Underline: ++text++ → <u>text</u>
  text=text.replace(/\+\+([^+]+)\+\+/g,'<u>$1</u>');
  // Underline alternative: ==text== → <u>text</u>
  text=text.replace(/==([^=]+)==/g,'<u>$1</u>');
  // Strikethrough: ~~text~~ → <del>text</del> (marked GFM may not support this by default)
  text=text.replace(/~~([^~]+)~~/g,'<del>$1</del>');

  // 9. Fix incomplete LaTeX commands (model sometimes outputs \sqrt without arguments)
  text=text.replace(/\\sqrt(?!\{)/g,'\\sqrt{x}');
  text=text.replace(/\\frac(?!\{)/g,'\\frac{a}{b}');
  text=text.replace(/\\dfrac(?!\{)/g,'\\dfrac{a}{b}');
  text=text.replace(/\\sqrt\[(\d+)\](?!\{)/g,'\\sqrt[$1]{x}');

  // 10. Parse markdown
  const markedOptions = {
    breaks: true,
    gfm: true,
    mangle: false,
    headerIds: false
  };
  return marked.parse(text, markedOptions);
}

window.renderMDFromMath=renderMD;
window.renderPlotlyGraph=renderPlotlyGraph;
window.renderMathInElement=renderMathInElement;

function _resolveGraphPlaceholders(el){
  const pending=window._pendingGraphBlocks||[];
  el.querySelectorAll('.averon-graph-ph').forEach(ph=>{
    const idx=parseInt(ph.getAttribute('data-gi'),10);
    const item=pending[idx];if(!item){return;}
    const wrapper=document.createElement('div');wrapper.style.cssText='margin:10px 0;';
    if(item.type==='graph'){const parsed=_parseGraphBlock(item.raw);if(parsed){renderPlotlyGraph(wrapper,parsed);}else{wrapper.innerHTML=`<div style="color:var(--text3);font-size:13px">⚠ Не удалось разобрать граф-блок</div><details style="margin-top:4px;font-size:11px;color:var(--text2);"><summary style="cursor:pointer">Показать исходный код</summary><pre style="margin:4px 0;padding:8px;background:var(--bg1);border-radius:4px;overflow-x:auto;">${escapeHtml(item.raw)}</pre></details>`;}}
    else if(item.type==='python'){
      let fn=null,xMin=-10,xMax=10,title='';
      const tm=item.code.match(/plt\.title\(['"]([^'"]+)['"]/);if(tm)title=tm[1];
      const lm=item.code.match(/np\.linspace\(\s*(-?[\d.*a-zA-Z_]+)\s*,\s*(-?[\d.*a-zA-Z_]+)/);
      if(lm){const ev=s=>{try{return eval(s.replace(/np\.pi/g,String(Math.PI)).replace(/np\.e(?!\w)/g,String(Math.E)));}catch(_){return null;}};const a=ev(lm[1]),b=ev(lm[2]);if(a!==null&&b!==null){xMin=a;xMax=b;}}
      const ym=item.code.match(/y\s*=\s*([^\n#]+)/);if(ym)fn=ym[1].trim().replace(/np\.(\w+)/g,(_,f)=>`Math.${f}`).replace(/np\.pi/g,String(Math.PI)).replace(/np\.e(?!\w)/g,String(Math.E));
      if(!fn){const pm=item.code.match(/plt\.plot\s*\([^,]+,\s*([^,)]+)/);if(pm)fn=pm[1].trim().replace(/np\.(\w+)/g,(_,f)=>`Math.${f}`);}
      if(fn)renderPlotlyGraph(wrapper,{exprs:[{fn,label:null}],title:title||'График функции',xRange:[xMin,xMax]});
      else wrapper.innerHTML='<div style="color:var(--text3);font-size:13px">⚠ Не удалось распознать функцию</div>';
      const details=document.createElement('details');details.style.cssText='margin-top:6px;border:1px solid var(--border);border-radius:8px;overflow:hidden;font-size:12px;';
      details.innerHTML=`<summary style="padding:8px 12px;cursor:pointer;color:var(--text3);user-select:none;">📄 Исходный Python-код</summary><pre style="margin:0;padding:12px;overflow-x:auto;"><code class="language-python">${escapeHtml(item.code.trim())}</code></pre>`;
      wrapper.appendChild(details);details.querySelectorAll('code').forEach(b=>{try{hljs.highlightElement(b);}catch(_){}});
    }
    ph.replaceWith(wrapper);
  });
}

function setAI(el,content){
  if(!el)return;
  window._pendingGraphBlocks=[];
  el.innerHTML=content;
  _resolveGraphPlaceholders(el);
  el.querySelectorAll('pre code').forEach(b=>{try{hljs.highlightElement(b);}catch(_){}});
  renderMathInElement(el);
  el.querySelectorAll('a').forEach(a=>{if(!a.href.startsWith(location.origin)){a.target='_blank';a.rel='noopener noreferrer';}});
}

function copyGraphCode(btn){
  const code=btn.closest('.graph-code-block')?.querySelector('code')?.textContent||'';
  navigator.clipboard.writeText(code).then(()=>{const orig=btn.textContent;btn.textContent='✅ Скопировано!';setTimeout(()=>btn.textContent=orig,2000);});
}