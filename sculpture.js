/* Original open ribbon sculpture: tessellated surfaces, perspective and studio light.
   All movement follows page state; there is no autonomous spin or ambient clock. */
export function createSculpture(canvas, { reducedMotion = false, onReady = () => {} } = {}) {
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const smooth = t => { t=clamp(t,0,1); return t*t*(3-2*t); };
  const target = { progress:0, pointerX:0, pointerY:0, pull:0, reveal:0, impulse:0 };
  const state = { ...target };
  let gl=null, program=null, vertexBuffer=null, fallback=null, lost=false, destroyed=false, active=true;
  let raf=0, last=0, width=1, height=1, frames=2, vertexCount=0, narrow=false;
  const coarse=matchMedia('(pointer: coarse)').matches;
  let quality=1, slowFrames=0, fastFrames=0, frameAverage=1000/60, geometryLevel=-1, qualityChangedAt=0;
  let drawCount=0, drawCPU=0, intervalCount=0, intervalTotal=0, cssWidth=1, cssHeight=1;
  const uniforms={}, listeners=[];
  let model=new Float32Array(16), vp=new Float32Array(16);
  const listen=(el,type,fn)=>{el.addEventListener(type,fn);listeners.push(()=>el.removeEventListener(type,fn));};

  const vertexSource=`
    precision highp float;
    attribute vec2 aUV;
    attribute float aBlade;
    attribute vec3 aBary;
    uniform mat4 uModel;
    uniform mat4 uVP;
    uniform float uProgress;
    uniform float uPull;
    uniform float uReveal;
    uniform float uImpulse;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vBary;
    varying vec2 vUV;
    varying float vBlade;
    const float PI=3.14159265;
    // Analytic tangents evaluate the ribbon once instead of three full shapes.
    vec3 ribbon(vec2 uv,float blade,out vec3 normal){
      bool wire=blade>7.5;
      float index=wire?(blade-8.)*3.1+.5:blade;
      float n=index/7.-.5;
      float t=wire?.16+uv.x*.76:uv.x;
      float s=uv.y;
      float opening=smoothstep(.13,.44,uProgress)-.80*smoothstep(.70,.98,uProgress)+uReveal*.60;
      float separation=sin(uProgress*PI)*sin(uProgress*PI)*.32+uReveal*.42;
      float st=sin(t*PI),ct=cos(t*PI);
      float angle=1.55+n*(1.40+opening*.76)+st*.16;
      float length=2.68+.28*cos(n*PI*1.6);
      float stretch=1.+uPull*.34*t;
      float distance=t*length*stretch;
      vec2 forward=vec2(cos(angle),sin(angle));
      vec2 side=vec2(-forward.y,forward.x);
      vec3 p=vec3(.12+n*.09,-1.37,0.);
      p.xy+=forward*distance;
      p.x+=st*(.14+n*.14);
      p.z=st*(.51+n*.34)+sin(t*PI*1.35+index*.40)*.11+n*.21;
      float wave=max(0.,sin(t*PI*.97)),widthPower=pow(wave,.72);
      float widthFactor=1.-abs(n)*.23;
      float halfWidth=(.018+widthPower*.185)*widthFactor;
      float widthSlope=.185*.72*widthPower/max(wave,.0001)*PI*.97*cos(t*PI*.97)*widthFactor;
      if(wire){halfWidth=.0045;widthSlope=0.;p.xy+=forward*.16;p.z+=.18;}
      float twist=t*2.05+n*1.6+uReveal*n*.45;
      float twistCos=cos(twist),twistSin=sin(twist);
      p.xy+=side*s*halfWidth*twistCos;
      p.z+=s*halfWidth*twistSin+(abs(s)-.5)*halfWidth*.65;
      p+=vec3(n*separation*.85,sin(index*1.8)*separation*.12,n*separation*.72);
      float ripple=sin(t*9.+index*.7);
      p.z+=uImpulse*.075*ripple*st;
      float angleSlope=PI*ct*.16;
      vec3 along=vec3(forward*length*(1.+uPull*.68*t)+side*angleSlope*(distance+(wire?.16:0.)),0.);
      along.x+=PI*ct*(.14+n*.14);
      along.xy+=s*(side*(widthSlope*twistCos-halfWidth*twistSin*2.05)-forward*angleSlope*halfWidth*twistCos);
      along.z=PI*ct*(.51+n*.34)+PI*1.35*cos(t*PI*1.35+index*.40)*.11;
      along.z+=s*(widthSlope*twistSin+halfWidth*twistCos*2.05)+(abs(s)-.5)*widthSlope*.65;
      along.z+=uImpulse*.075*(9.*cos(t*9.+index*.7)*st+PI*ripple*ct);
      vec3 across=vec3(side*halfWidth*twistCos,halfWidth*(twistSin+(s<0.?-.65:.65)));
      normal=normalize(cross(along,across));
      return p;
    }
    void main(){
      vec3 normal;
      vec3 p=ribbon(aUV,aBlade,normal);
      vec4 world=uModel*vec4(p,1.);
      vPosition=world.xyz;vNormal=normalize(mat3(uModel)*normal);
      vBary=aBary;vUV=aUV;vBlade=aBlade;
      gl_Position=uVP*world;
    }`;
  function fragmentSource(derivatives){return `${derivatives?'#extension GL_OES_standard_derivatives : enable':''}
    precision highp float;
    uniform float uProgress;
    uniform float uReveal;
    uniform vec2 uPointer;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vBary;
    varying vec2 vUV;
    varying float vBlade;
    vec3 studio(vec3 r){
      vec3 color=mix(vec3(.035,.045,.08),vec3(.66,.74,.88),smoothstep(-.4,.9,r.y));
      float broad=pow(max(0.,dot(r,normalize(vec3(-.65+uPointer.x*.18,.75,.65)))),14.);
      float strip=exp(-pow((r.x-.28-uPointer.x*.04)/.065,2.))*(.3+.7*smoothstep(-.5,.3,r.y));
      float rim=pow(max(0.,dot(r,normalize(vec3(.75,-.10,.5)))),32.);
      float floorLight=pow(max(0.,dot(r,normalize(vec3(-.2,-.75,.6)))),9.);
      color+=vec3(2.5,2.7,3.)*broad+vec3(2.1,2.3,2.6)*strip;
      color+=vec3(.95,1.1,1.4)*rim+vec3(.76,.59,.36)*floorLight*.28;
      return color;
    }
    void main(){
      vec3 normal=normalize(vNormal);if(!gl_FrontFacing)normal=-normal;
      vec3 eye=normalize(vec3(0.,0.,6.)-vPosition);
      vec3 reflected=studio(reflect(-eye,normal));
      float light=max(0.,dot(normal,normalize(vec3(-.6,.8,.9))));
      float grazing=pow(1.-max(0.,dot(normal,eye)),3.);
      float orange=smoothstep(.25,.42,uProgress)*(1.-smoothstep(.54,.66,uProgress));
      float silver=smoothstep(.55,.73,uProgress)*(1.-smoothstep(.87,1.,uProgress));
      vec3 cobalt=vec3(.014,.065,.59);
      vec3 base=mix(cobalt,vec3(.94,.15,.025),orange);
      base=mix(base,vec3(.57,.65,.72),silver);
      float bladeShade=.87+.13*sin(vBlade*1.7);
      vec3 color=base*(.24+light*.65)*bladeShade;
      color+=reflected*mix(base*1.5,vec3(.92,.96,1.),.16+silver*.5)*(.40+grazing*.54);
      color+=vec3(.44,.65,1.)*grazing*.16*(1.-orange);
      float seam=exp(-abs(vUV.y)/.022)*.10;
      color+=seam*vec3(.20,.29,.47);
      color=color/(color+vec3(.68));color=pow(color,vec3(.84));
      ${derivatives?'vec3 edgeWidth=fwidth(vBary)*1.1;vec3 aa=smoothstep(vec3(0.),edgeWidth,vBary);float edge=1.-min(min(aa.x,aa.y),aa.z);':'float edge=1.-smoothstep(0.,.028,min(min(vBary.x,vBary.y),vBary.z));'}
      float structural=max(1.-smoothstep(.93,.99,abs(vUV.y)),0.);
      float boundary=smoothstep(.94,.99,abs(vUV.y));
      float wire=max(edge*.72,boundary);
      float alpha=mix(1.,.055+wire*.945,uReveal*.92);
      color=mix(color,mix(vec3(.03,.08,.31),vec3(.72,.82,.94),wire),uReveal*.47);
      if(vBlade>7.5){color=mix(vec3(.08,.19,.43),vec3(.58,.73,.92),grazing);alpha=.75;}
      gl_FragColor=vec4(color,alpha);
    }`;}

  // Column-major matrices keep perspective in the renderer, not in CSS transforms.
  function identity(){const a=new Float32Array(16);a[0]=a[5]=a[10]=a[15]=1;return a;}
  function multiply(a,b){const c=new Float32Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)c[col*4+row]+=a[k*4+row]*b[col*4+k];return c;}
  function translation(x,y,z){const m=identity();m[12]=x;m[13]=y;m[14]=z;return m;}
  function rotation(axis,angle){const m=identity(),c=Math.cos(angle),s=Math.sin(angle);if(axis==='x'){m[5]=c;m[6]=s;m[9]=-s;m[10]=c;}if(axis==='y'){m[0]=c;m[2]=-s;m[8]=s;m[10]=c;}if(axis==='z'){m[0]=c;m[1]=s;m[4]=-s;m[5]=c;}return m;}
  function projection(aspect){const f=1/Math.tan(40*Math.PI/360),near=.1,far=40,m=new Float32Array(16);m[0]=f/aspect;m[5]=f;m[10]=(far+near)/(near-far);m[11]=-1;m[14]=2*far*near/(near-far);return m;}
  function choreography(){
    const aspect=width/height,p=state.progress;
    // x, y, z, uniform scale, yaw, roll: a continuous entrance / crossing / fly-through.
    const keys=[
      [0,.91,-.16,0,1.03,-.42,-.13],
      [.27,-.87,.06,-.35,1.02,.55,.24],
      [.53,0,-.02,.35,1.07,1.43,-.25],
      [.72,.08,.14,3.35,.96,2.16,.39],
      [.86,-.65,-.12,-.55,.87,3.76,-.22],
      [1,.82,-.18,0,1.02,5.86,-.13]
    ];
    let a=keys[0],b=keys[1];for(let i=0;i<keys.length-1;i++)if(p>=keys[i][0]){a=keys[i];b=keys[i+1];}
    const t=smooth((p-a[0])/(b[0]-a[0]));const v=a.map((n,i)=>n+(b[i]-n)*t);
    let tx=v[1]*aspect,ty=v[2],scale=v[4];
    if(narrow){tx=v[1]*.10-.20;ty=v[2]-.66*(1-smooth(p/.28));scale*=.66;}
    tx+=state.pointerX*.075;ty-=state.pointerY*.055;
    const scaling=identity();scaling[0]=scaling[5]=scaling[10]=scale;
    model=multiply(translation(tx,ty,v[3]),multiply(rotation('y',v[5]+state.pointerX*.10),multiply(rotation('x',-.10+state.pointerY*.08),multiply(rotation('z',v[6]),scaling))));
    vp=multiply(projection(aspect),translation(0,0,-6));
  }
  function compile(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(log);}return s;}
  function mesh(compact){
    const vertices=[];const emit=(u,v,blade,bary)=>vertices.push(u,v,blade,...bary);
    for(let blade=0;blade<11;blade++){
      const rows=blade>7?(compact?24:30):(compact?32:44),columns=blade>7?1:(compact?4:6);
      for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){
        const u0=i/rows,u1=(i+1)/rows,v0=j/columns*2-1,v1=(j+1)/columns*2-1;
        emit(u0,v0,blade,[1,0,0]);emit(u1,v0,blade,[0,1,0]);emit(u1,v1,blade,[0,0,1]);
        emit(u0,v0,blade,[1,0,0]);emit(u1,v1,blade,[0,1,0]);emit(u0,v1,blade,[0,0,1]);
      }
    }
    vertexCount=vertices.length/6;return new Float32Array(vertices);
  }
  function updateGeometry(){
    const level=coarse||narrow||quality<.72?1:0;
    if(!gl||lost||!vertexBuffer||geometryLevel===level)return;
    geometryLevel=level;gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,mesh(Boolean(level)),gl.STATIC_DRAW);
  }
  function initialize(){
    gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:'high-performance'});
    if(!gl)throw new Error('WebGL unavailable');
    const derivatives=Boolean(gl.getExtension('OES_standard_derivatives'));
    const vs=compile(gl.VERTEX_SHADER,vertexSource),fs=compile(gl.FRAGMENT_SHADER,fragmentSource(derivatives));
    program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);
    vertexBuffer=gl.createBuffer();geometryLevel=-1;updateGeometry();
    for(const [name,size,offset] of [['aUV',2,0],['aBlade',1,8],['aBary',3,12]]){const a=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,24,offset);}
    for(const name of ['uModel','uVP','uProgress','uPull','uReveal','uImpulse','uPointer'])uniforms[name]=gl.getUniformLocation(program,name);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
    canvas.dataset.renderer='webgl';canvas.style.opacity='';if(fallback)fallback.style.display='none';
  }
  function fallbackStart(){
    if(!fallback){fallback=document.createElement('canvas');fallback.setAttribute('aria-hidden','true');fallback.style.cssText='position:absolute;inset:0;pointer-events:none;';canvas.insertAdjacentElement('afterend',fallback);}
    canvas.style.opacity='0';canvas.dataset.renderer='canvas';fallback.style.display='block';resize();
  }
  function pointOnRibbon(t,s,blade){
    const wire=blade>7,index=wire?(blade-8)*3.1+.5:blade,n=index/7-.5;
    if(wire)t=.16+t*.76;
    const opening=smooth((state.progress-.13)/.31)-.8*smooth((state.progress-.70)/.28)+state.reveal*.6;
    const separation=Math.sin(state.progress*Math.PI)**2*.32+state.reveal*.42;
    const angle=1.55+n*(1.4+opening*.76)+Math.sin(t*Math.PI)*.16;
    const distance=t*(2.68+.28*Math.cos(n*Math.PI*1.6))*(1+state.pull*.34*t);
    let hw=(.018+Math.pow(Math.max(0,Math.sin(t*Math.PI*.97)),.72)*.185)*(1-Math.abs(n)*.23);if(wire)hw=.0045;
    const twist=t*2.05+n*1.6+state.reveal*n*.45;
    return [.12+n*.09+Math.cos(angle)*(distance+(wire?.16:0))+Math.sin(t*Math.PI)*(.14+n*.14)-Math.sin(angle)*s*hw*Math.cos(twist)+n*separation*.85,
      -1.37+Math.sin(angle)*(distance+(wire?.16:0))+Math.cos(angle)*s*hw*Math.cos(twist)+Math.sin(index*1.8)*separation*.12,
      Math.sin(t*Math.PI)*(.51+n*.34)+Math.sin(t*Math.PI*1.35+index*.4)*.11+n*.21+s*hw*Math.sin(twist)+(Math.abs(s)-.5)*hw*.65+n*separation*.72+(wire?.18:0)+state.impulse*.075*Math.sin(t*9+index*.7)*Math.sin(t*Math.PI)];
  }
  function drawFallback(){
    const ctx=fallback?.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,width,height);
    const m=multiply(vp,model);
    const project=p=>{const x=m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],y=m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];return [(x/w*.5+.5)*width,(-y/w*.5+.5)*height];};
    const p=state.progress,orange=p>.29&&p<.60,silver=p>=.60&&p<.91;
    const colors=silver?['#253444','#c3d3dc','#f4f7f9','#526574']:orange?['#8f240c','#f87527','#ffd7ae','#b42c0e']:['#071c75','#1f58df','#b9d8ff','#123bc0'];
    for(let blade=10;blade>=0;blade--){
      const a=project(pointOnRibbon(0,-1,blade)),b=project(pointOnRibbon(1,1,blade));
      const gradient=ctx.createLinearGradient(a[0],a[1],b[0]+1,b[1]+1);colors.forEach((c,i)=>gradient.addColorStop(i/3,c));
      ctx.beginPath();for(let i=0;i<=40;i++){const xy=project(pointOnRibbon(i/40,-1,blade));i?ctx.lineTo(...xy):ctx.moveTo(...xy);}for(let i=40;i>=0;i--)ctx.lineTo(...project(pointOnRibbon(i/40,1,blade)));ctx.closePath();
      ctx.fillStyle=gradient;ctx.globalAlpha=1-state.reveal*.84;ctx.fill();ctx.globalAlpha=.45+state.reveal*.5;ctx.strokeStyle=colors[2];ctx.lineWidth=blade>7?.7:1;ctx.stroke();
      if(blade<8){ctx.beginPath();for(let i=0;i<=40;i++){const xy=project(pointOnRibbon(i/40,0,blade));i?ctx.lineTo(...xy):ctx.moveTo(...xy);}ctx.strokeStyle=colors[0];ctx.globalAlpha=.35;ctx.lineWidth=.7;ctx.stroke();}
    }
    ctx.globalAlpha=1;
  }
  function render(){
    if(destroyed||document.hidden||!active)return;
    const started=performance.now();choreography();
    if(!gl||!program||lost)drawFallback();
    else{
      gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
      gl.uniformMatrix4fv(uniforms.uModel,false,model);gl.uniformMatrix4fv(uniforms.uVP,false,vp);
      gl.uniform1f(uniforms.uProgress,state.progress);gl.uniform1f(uniforms.uPull,state.pull);gl.uniform1f(uniforms.uReveal,state.reveal);gl.uniform1f(uniforms.uImpulse,state.impulse);
      gl.uniform2f(uniforms.uPointer,state.pointerX,state.pointerY);gl.drawArrays(gl.TRIANGLES,0,vertexCount);
    }
    drawCount++;drawCPU+=performance.now()-started;
  }
  // Update the backing store without layout reads. Lower pixel density changes
  // neither the silhouette nor the scroll choreography.
  const isStatic=()=>reducedMotion||!gl||!program||lost;
  const pixelBudget=()=>isStatic()?300000:(coarse||narrow?450000:850000)*quality*quality;
  const qualityLevel=()=>isStatic()?'static':quality>.9?'high':quality>.7?'medium':'low';
  function resolution(){
    const dpr=Math.min(window.devicePixelRatio||1,coarse?1.25:1.5);
    const w=Math.max(1,cssWidth*dpr),h=Math.max(1,cssHeight*dpr);
    const budget=pixelBudget();
    const cap=Math.min(quality,Math.sqrt(budget/(w*h)));
    width=Math.max(1,Math.floor(w*cap));height=Math.max(1,Math.floor(h*cap));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    if(fallback&&(fallback.width!==width||fallback.height!==height)){fallback.width=width;fallback.height=height;}
    updateGeometry();
  }
  function diagnostics(){
    // Only published once the renderer settles; no per-frame DOM mutation.
    Object.assign(canvas.dataset,{renderFrames:String(drawCount),renderPixels:String(width*height),pixelBudget:String(Math.round(pixelBudget())),renderVertices:String(vertexCount),renderQuality:quality.toFixed(2),qualityLevel:qualityLevel(),drawCalls:gl&&!lost?'1':'0',renderIdle:'true',activeFrameMs:intervalCount?(intervalTotal/intervalCount).toFixed(2):'0',drawCpuMs:drawCount?(drawCPU/drawCount).toFixed(3):'0'});
  }
  function adapt(milliseconds){
    if(milliseconds<4)return;
    intervalCount++;intervalTotal+=milliseconds;
    frameAverage+=(Math.min(120,milliseconds)-frameAverage)*.08;
    slowFrames=frameAverage>23?slowFrames+1:Math.max(0,slowFrames-2);
    fastFrames=frameAverage<18?fastFrames+1:0;
    const now=performance.now();
    if(slowFrames>=24&&quality>.61&&now-qualityChangedAt>1500){quality=quality>.9?.8:.6;qualityChangedAt=now;slowFrames=fastFrames=0;resolution();}
    else if(fastFrames>=180&&quality<1&&now-qualityChangedAt>5000){quality=quality<.7?.8:1;qualityChangedAt=now;slowFrames=fastFrames=0;resolution();}
  }
  function resize(){
    if(destroyed||!active)return;
    const rect=canvas.getBoundingClientRect();cssWidth=rect.width;cssHeight=rect.height;narrow=rect.width<700;resolution();
    if(fallback){const style=getComputedStyle(canvas);Object.assign(fallback.style,{position:style.position==='fixed'?'fixed':'absolute',left:(style.position==='fixed'?rect.left:canvas.offsetLeft)+'px',top:(style.position==='fixed'?rect.top:canvas.offsetTop)+'px',right:'auto',bottom:'auto',width:rect.width+'px',height:rect.height+'px',zIndex:style.zIndex});}
    render();if(!raf)diagnostics();
  }
  function tick(timestamp){
    raf=0;if(destroyed||document.hidden||!active||isStatic()){last=0;return;}
    const now=timestamp/1000,dt=last?Math.min(.08,now-last):1/60;if(last)adapt((now-last)*1000);last=now;
    target.impulse*=Math.exp(-dt*5.5);
    let difference=0;
    for(const key of Object.keys(state)){
      const delta=target[key]-state[key];difference+=Math.abs(delta);
      state[key]=reducedMotion?target[key]:state[key]+delta*(1-Math.exp(-dt*(key==='progress'?12:10)));
      if(Math.abs(target[key]-state[key])<.0002)state[key]=target[key];
    }
    render();frames=Math.max(0,frames-1);
    if(difference>.0006||target.impulse>.001||frames>0)raf=requestAnimationFrame(tick);else{last=0;diagnostics();}
  }
  function wake(){if(!raf&&!destroyed&&active&&!document.hidden&&!isStatic()){canvas.dataset.renderIdle='false';raf=requestAnimationFrame(tick);}}
  listen(document,'visibilitychange',()=>{if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;last=0;}else{frames=1;wake();}});
  listen(canvas,'webglcontextlost',event=>{event.preventDefault();lost=true;if(raf)cancelAnimationFrame(raf);raf=0;last=0;fallbackStart();onReady({renderer:'canvas',reason:'context-lost'});});
  listen(canvas,'webglcontextrestored',()=>{try{lost=false;initialize();Object.assign(state,target);resize();onReady({renderer:'webgl'});}catch{lost=true;fallbackStart();}});
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(canvas);if(!observer)listen(window,'resize',resize);
  try{initialize();onReady({renderer:'webgl'});}catch{gl=null;program=null;fallbackStart();onReady({renderer:'canvas',reason:'webgl-unavailable'});}
  resize();
  function setActive(value){
    const next=Boolean(value);if(active===next)return;active=next;canvas.dataset.renderActive=String(active);
    if(!active){if(raf)cancelAnimationFrame(raf);raf=0;last=0;diagnostics();}
    else{if(isStatic())Object.assign(state,target);resize();frames=1;wake();}
  }
  return {
    setState(value={}){
      let changed=false;
      for(const key of Object.keys(target))if(Number.isFinite(value[key])){const next=clamp(value[key],key.startsWith('pointer')?-1:0,1);if(Math.abs(next-target[key])>.00005){target[key]=next;changed=true;}}
      if(!changed)return;
      // Static mode retains one composed frame while ordinary HTML remains
      // usable. Remember input for a later return to interactive quality.
      if(isStatic())return;
      frames=1;wake();
    },
    setReducedMotion(value){reducedMotion=Boolean(value);if(reducedMotion){if(raf)cancelAnimationFrame(raf);raf=0;last=0;Object.assign(state,target);resolution();render();diagnostics();}else{resolution();wake();}},
    setActive,
    setPaused(value){setActive(!value);},
    resize,
    destroy(){destroyed=true;if(raf)cancelAnimationFrame(raf);observer?.disconnect();listeners.forEach(remove=>remove());fallback?.remove();if(gl&&!lost){if(vertexBuffer)gl.deleteBuffer(vertexBuffer);if(program)gl.deleteProgram(program);}}
  };
}
