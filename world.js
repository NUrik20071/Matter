/* MATTER / continuous material environment. Input is owned by the application.
   Material responses are artistic approximations of viscosity, capillarity and
   optical scattering, not a CFD or physically exact optical simulation. */
export function createWorld(canvas, { reducedMotion = false, onReady = () => {} } = {}) {
  const materials = { water: 0, amber: 1, metal: 2, glass: 3 };
  const rates = { water: 7.0, amber: 2.0, metal: 9.5, glass: 4.5 };
  let material = 'water', materialValue = 0, paused = false, destroyed = false;
  let gl = null, program = null, buffer = null, fallback = null, contextLost = false;
  let frame = 0, last = 0, time = 4.6, clock = 0, width = 1, height = 1;
  let scale = 1, frameSeconds = 0, frameCount = 0, lowWindows = 0;
  let forceFrames = 3, settled = false;
  let sceneControlled = false, sceneProgress = 0, assembly = 1;
  const trail = [0, 0];
  const materialNames = ['water', 'amber', 'metal', 'glass'];
  const input = { x: .56, y: .45, dx: 0, dy: 0, left: 0, right: 0, energy: 0 };
  const target = { ...input };
  const pulses = [[.5,.5,-30,0], [.5,.5,-30,0], [.5,.5,-30,0]];
  let pulseIndex = 0;
  const uniforms = {};
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const listeners = [];
  const listen = (node,event,handler) => { node.addEventListener(event,handler); listeners.push(()=>node.removeEventListener(event,handler)); };

  const vertex = `attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
  const fragment = `
  precision highp float;
  uniform vec2 uSize;
  uniform vec2 uPointer;
  uniform vec2 uVelocity;
  uniform float uTime;
  uniform float uClock;
  uniform float uLeft;
  uniform float uRight;
  uniform float uEnergy;
  uniform float uMaterial;
  uniform float uProgress;
  uniform float uAssembly;
  uniform vec2 uTrail;
  uniform vec4 uPulses[3];

  mat2 turn(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
  float hash(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
  vec4 weights(){return max(vec4(0.),vec4(1.)-abs(vec4(uMaterial)-vec4(0.,1.,2.,3.)));}
  vec2 point(){return (uPointer*vec2(2.,-2.)+vec2(-1.,1.))*uSize/min(uSize.x,uSize.y);}

  // Glass uses fixed planar coordinates. No clock, ripple or vortex can bend it.
  vec2 glassCoords(vec2 p){
    vec2 g=turn(-.19+uLeft*(uPointer.x-.5)*.045)*p;
    g+=vec2((1.-uAssembly)*.32,uProgress*.38);
    g+=uLeft*vec2((uPointer.x-.5)*.085,(uPointer.y-.5)*.055);
    return g;
  }
  vec4 glassSurface(vec2 p){
    vec2 g=glassCoords(p);
    float a=smoothstep(-.018,.018,g.x+g.y*.18-.15);
    float b=smoothstep(-.018,.018,g.y-g.x*.10+.36);
    float h=.035+a*.13+b*.10+uLeft*dot(p,point())*.006;
    return vec4(h,g.x+g.y*.18,a*.65+b*.35,g.x-.15);
  }

  // Large, continuously connected folds: no spheres, particles, or isolated objects.
  vec4 surface(vec2 p){
    vec4 w=weights();
    vec2 pointer=point();
    vec2 d=p-pointer;
    float r=length(d);
    float reach=exp(-r*r*.72);
    vec2 q=p;
    q+=vec2(uProgress*.85,-uProgress*.5);
    q-=uVelocity*reach*uLeft*.44;
    q-=uTrail*reach*(w.y*.95+w.x*.12);
    q=pointer+turn(uRight*reach*.56)* (q-pointer);
    q+=normalize(d+vec2(.001))*(uLeft*.17+uEnergy*.025)*reach;
    float seam=q.x-pointer.x+sin(q.y*1.8+uTime*.17)*.16+sin(q.y*.75-uTime*.11)*.13;
    q.x+=(seam*3./(1.+abs(seam*3.)))*uRight*.35;
    q=turn(-.40)*q;
    q+=vec2(sin(q.y*1.42+sin(q.x*.76)+uTime*.13),cos(q.x*1.08-sin(q.y*.94)-uTime*.09))*(.67+.10*w.y)*(.35+.65*uAssembly);
    float strata=sin(q.x*1.45+q.y*.47+uTime*.10)+sin(q.y*1.23-q.x*.39-uTime*.085)*.68;
    strata+=(noise(q*2.8+uTime*.018)-.5)*.105*(1.-w.z*.85);
    // High surface tension suppresses small wrinkles and joins broader metal folds.
    float layers=sin(strata*(3.1-w.z*.85)+q.y*.34+uProgress*1.7);
    float height=sin(strata*1.66)*.22 + smoothstep(-.45,.55,layers)*(.24+.07*w.y-.04*w.z-.03*w.w);
    height+=sin(q.x*6.+q.y*3.+strata*4.-uTime*.8)*.010*(1.-w.z*.85);
    height+=sin(q.y*10.-q.x*4.+strata*2.+uTime*.52)*.004*(1.-w.z*.9);
    height-=uLeft*reach*.26;
    height+=sin(r*11.-uTime*1.7)*reach*uEnergy*.012;
    height+=uLeft*sin(r*14.-uTime*2.4)*exp(-r*1.2)*.016*(w.x+.3*w.y+.7*w.z);
    for(int i=0;i<3;i++){
      vec2 pp=(uPulses[i].xy*vec2(2.,-2.)+vec2(-1.,1.))*uSize/min(uSize.x,uSize.y);
      float age=uClock-uPulses[i].z;
      float distanceTo=length(p-pp);
      float front=exp(-pow((distanceTo-age*(1.3*w.x+.45*w.y+1.8*w.z))/(.21+age*.14),2.));
      float damping=exp(-age*(1.25*w.x+.7*w.y+2.8*w.z));
      height+=sin(distanceTo*16.-age*(11.*w.x+3.5*w.y+15.*w.z))*damping*front*.055*uPulses[i].w;
    }
    float channelWidth=.014+uRight*.24;
    float channel=exp(-pow(seam/channelWidth,2.));
    height-=channel*uRight*.34;
    height*=.45+.55*uAssembly;
    return mix(vec4(height,strata,layers,seam),glassSurface(p),w.w);
  }
  vec3 environment(vec3 r, float blur){
    vec3 c=mix(vec3(.012,.023,.030),vec3(.21,.33,.36),smoothstep(-.7,.8,r.y));
    float light=pow(max(0.,dot(r,normalize(vec3(-.6,.85,.6)))),mix(30.,7.,blur));
    float ribbon=exp(-pow((r.x+.25)/(0.045+blur*.10),2.))*(.3+.7*smoothstep(-.5,.5,r.y));
    float rim=pow(max(0.,dot(r,normalize(vec3(.8,-.3,.6)))),mix(38.,10.,blur));
    c+=vec3(.92,1.45,1.55)*light*1.8;
    c+=vec3(1.45,1.77,1.80)*ribbon;
    c+=vec3(.31,.68,.73)*rim;
    return c;
  }
  void main(){
    vec2 p=(gl_FragCoord.xy*2.-uSize)/min(uSize.x,uSize.y);
    vec4 s=surface(p);
    const float e=.005;
    float hx=surface(p+vec2(e,0.)).x;
    float hy=surface(p+vec2(0.,e)).x;
    vec3 n=normalize(vec3((s.x-hx)/e,(s.x-hy)/e,1.25));
    vec4 w=weights();
    vec3 eye=normalize(vec3(p*.14,1.5));
    vec3 reflection=environment(reflect(-eye,n),w.w*.9);
    float face=clamp(dot(eye,n),0.,1.);
    float fresnel=.10+.9*pow(1.-face,3.);
    float stratum=s.y;
    float fold=smoothstep(-.55,.65,s.z);
    float deep=smoothstep(-.12,.65,s.x);
    float hairline=exp(-pow((s.z+.23)/.048,2.));
    float innerline=exp(-pow((s.z-.52)/.024,2.));
    float darkChannel=exp(-pow((s.z+.64)/.17,2.));
    vec3 water=mix(vec3(.008,.032,.044),vec3(.045,.31,.34),fold);
    water+=reflection*(.22+fresnel*.6);
    water+=vec3(.12,.50,.50)*hairline*.38;
    water+=vec3(.55,.84,.80)*innerline*.22;
    water*=1.-darkChannel*.56;
    vec3 amber=mix(vec3(.034,.014,.006),vec3(.42,.17,.035),fold);
    amber+=reflection*vec3(1.,.64,.27)*(.17+fresnel*.51);
    amber+=vec3(.95,.58,.19)*hairline*.30;
    amber+=vec3(1.,.79,.44)*innerline*.27;
    amber*=1.-darkChannel*.55;
    vec3 metal=mix(vec3(.025,.035,.042),vec3(.20,.29,.31),fold);
    metal+=reflection*vec3(.78,.91,1.)*(.61+fresnel*.7);
    metal+=vec3(.65,.83,.90)*hairline*.43;
    metal+=vec3(.82,.92,1.)*innerline*.42;
    metal*=1.-darkChannel*.61;
    vec2 g=glassCoords(p);
    float ga=g.x+g.y*.18-.15,gb=g.y-g.x*.10+.36;
    float paneA=smoothstep(-.018,.018,ga),paneB=smoothstep(-.018,.018,gb);
    vec2 refracted=g+vec2(paneA*.075,paneB*.065);
    float clear=uRight*exp(-dot(p-point(),p-point())*1.8);
    vec3 transmitted=mix(vec3(.025,.10,.12),vec3(.14,.39,.39),smoothstep(-.6,1.,refracted.x+refracted.y*.55));
    float lowerEdge=exp(-abs(refracted.x-refracted.y*.34+.6)/.025);
    transmitted+=vec3(.25,.65,.61)*lowerEdge;
    vec3 frosted=mix(vec3(.12,.20,.21),vec3(.31,.43,.42),.30+paneA*.33+paneB*.25);
    frosted+=reflection*.13+(noise(p*180.)-.5)*.018;
    vec3 glass=mix(frosted,transmitted+reflection*.27,clear*.88);
    // Paired sharp edges and a displaced transmitted image suggest pane thickness.
    float edges=exp(-abs(ga)/.010)+exp(-abs(gb)/.010);
    float innerEdges=exp(-abs(ga-.038)/.007)+exp(-abs(gb-.031)/.007);
    glass+=vec3(.33,.51,.50)*edges*.48;
    glass-=vec3(.04,.065,.065)*innerEdges;
    vec3 color=water*w.x+amber*w.y+metal*w.z+glass*w.w;
    float opening=exp(-pow(s.w/(.014+uRight*.24),2.))*uRight*(1.-w.w);
    float cutEdge=exp(-pow((abs(s.w)-uRight*.24)/.026,2.))*uRight*(1.-w.w);
    vec3 under=mix(vec3(.025,.075,.085),vec3(.09,.40,.36),.5+.5*sin(p.y*1.6+uTime*.2));
    under=mix(under,vec3(.26,.09,.024),w.x*.45+w.z*.25);
    color=mix(color,under,opening*.93);
    color+=cutEdge*vec3(.42,.73,.68)*.50;
    // Broad directional illumination preserves room for the living typography.
    color*=.71+.29*smoothstep(-1.2,1.8,p.x+p.y*.3);
    color=color/(color+vec3(.73));
    color=pow(color,vec3(.92));
    float grain=(hash(gl_FragCoord.xy)-.5)/255.;
    gl_FragColor=vec4(color+grain,1.);
  }`;

  function compile(type, source) {
    const shader=gl.createShader(type); gl.shaderSource(shader,source); gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) { const log=gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(log); }
    return shader;
  }
  function initializeWebGL() {
    gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'high-performance'});
    if(!gl) throw new Error('WebGL unavailable');
    const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
    program=gl.createProgram(); gl.attachShader(program,vs); gl.attachShader(program,fs); gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.deleteShader(vs); gl.deleteShader(fs); gl.useProgram(program);
    buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const attr=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
    for(const name of ['uSize','uPointer','uVelocity','uTime','uClock','uLeft','uRight','uEnergy','uMaterial','uProgress','uAssembly','uTrail','uPulses[0]'])uniforms[name]=gl.getUniformLocation(program,name);
    gl.disable(gl.DEPTH_TEST);gl.clearColor(.015,.03,.035,1);
  }
  function initializeFallback() {
    if(!fallback){
      fallback=document.createElement('canvas'); fallback.setAttribute('aria-hidden','true');
      fallback.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
      canvas.insertAdjacentElement('afterend',fallback);
    }
    canvas.style.opacity='0';fallback.style.display='block';resize();drawFallback();
  }
  function resize() {
    if(destroyed)return;
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.25)*scale;
    let w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
    const limit=Math.min(1,Math.sqrt(700000/(w*h)));width=Math.max(1,Math.round(w*limit));height=Math.max(1,Math.round(h*limit));
    if(canvas.width!==width || canvas.height!==height){canvas.width=width;canvas.height=height;}
    if(fallback){
      fallback.width=width;fallback.height=height;
      const style=getComputedStyle(canvas);
      fallback.style.position=style.position==='fixed'?'fixed':'absolute';
      fallback.style.left=(style.position==='fixed'?rect.left:canvas.offsetLeft)+'px';
      fallback.style.top=(style.position==='fixed'?rect.top:canvas.offsetTop)+'px';
      fallback.style.right='auto';fallback.style.bottom='auto';
      fallback.style.width=rect.width+'px';fallback.style.height=rect.height+'px';fallback.style.zIndex=style.zIndex;
    }
    if(gl&&!contextLost)gl.viewport(0,0,width,height);
    if(paused)render();else wake(2);
  }
  function drawFallback() {
    const ctx=fallback?.getContext('2d');if(!ctx)return;
    const palettes={water:['#061d24','#164f54','#4c9b97','#a6d4c3'],amber:['#1c1008','#623719','#b88539','#eed19a'],metal:['#101b20','#485e65','#9ab1b5','#e0ebea'],glass:['#18363a','#496666','#8aa7a0','#c5d4ca']};
    const lower=Math.floor(materialValue),upper=Math.min(3,lower+1),blend=materialValue-lower;
    const colors=palettes[materialNames[lower]].map((hex,i)=>{
      const other=palettes[materialNames[upper]][i];
      const rgb=[1,3,5].map(offset=>Math.round(parseInt(hex.slice(offset,offset+2),16)*(1-blend)+parseInt(other.slice(offset,offset+2),16)*blend));
      return '#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');
    });
    ctx.fillStyle=colors[0];ctx.fillRect(0,0,width,height);
    const unit=Math.min(width,height);
    for(let layer=0;layer<9;layer++){
      const shift=(layer-3.5)*unit*.24+sceneProgress*unit*.22;
      const gradient=ctx.createLinearGradient(shift,0,shift+unit*.65,height);
      gradient.addColorStop(0,colors[0]);gradient.addColorStop(.42,colors[1]);gradient.addColorStop(.69,colors[2]);gradient.addColorStop(.71,colors[3]);gradient.addColorStop(.76,colors[1]);gradient.addColorStop(1,colors[0]);
      ctx.beginPath();
      for(let y=-30;y<=height+30;y+=12){
        const yy=y/unit;
        const dy=yy-input.y*height/unit;
        const pressure=Math.exp(-dy*dy*4)*input.left*unit*.11;
        const x=shift+unit*(Math.sin(yy*2.5+layer*.49+time*.12)*.26+Math.sin(yy*1.12-layer*.37-time*.09)*.32)*(.35+.65*assembly)+y*.48+pressure+trail[0]*unit*.1;
        y===-30?ctx.moveTo(x,y):ctx.lineTo(x,y);
      }
      ctx.lineTo(width+unit,height+30);ctx.lineTo(width+unit,-30);ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
      ctx.strokeStyle=colors[3]+'80';ctx.lineWidth=.9;ctx.stroke();
    }
    if(input.right>.005){
      ctx.beginPath();for(let y=0;y<=height;y+=8){const x=input.x*width+Math.sin(y/unit*2+time*.1)*unit*.08;y?ctx.lineTo(x,y):ctx.moveTo(x,y);}
      ctx.strokeStyle=colors[3]+'cc';ctx.lineWidth=input.right*unit*.21+3;ctx.stroke();ctx.strokeStyle=colors[0];ctx.lineWidth=input.right*unit*.20;ctx.stroke();
    }
    const glassWeight=clamp(materialValue-2,0,1);
    if(glassWeight>0){
      ctx.save();ctx.globalAlpha=glassWeight;
      const base=ctx.createLinearGradient(0,0,width,height);base.addColorStop(0,'#274347');base.addColorStop(1,'#597470');
      ctx.fillStyle=base;ctx.fillRect(0,0,width,height);
      const x=width*.48+(1-assembly)*unit*.25+input.left*(input.x-.5)*unit*.08;
      const y=height*.44+sceneProgress*unit*.17+input.left*(input.y-.5)*unit*.05;
      ctx.beginPath();ctx.moveTo(x,-10);ctx.lineTo(x+height*.17,height+10);ctx.lineTo(width+10,height+10);ctx.lineTo(width+10,-10);ctx.closePath();
      ctx.fillStyle='#8aa9a33b';ctx.fill();ctx.strokeStyle='#bbdbd18c';ctx.lineWidth=1.5;ctx.stroke();
      ctx.beginPath();ctx.moveTo(-10,y);ctx.lineTo(width+10,y-width*.1);ctx.lineTo(width+10,height+10);ctx.lineTo(-10,height+10);ctx.closePath();
      ctx.fillStyle='#9fb5ae28';ctx.fill();ctx.strokeStyle='#d0e1d88c';ctx.lineWidth=1.3;ctx.stroke();
      ctx.beginPath();ctx.moveTo(x+unit*.026,-10);ctx.lineTo(x+height*.17+unit*.026,height+10);ctx.strokeStyle='#0f303b4c';ctx.stroke();
      if(input.right>.005){
        const clear=ctx.createRadialGradient(input.x*width,input.y*height,0,input.x*width,input.y*height,unit*.38);
        clear.addColorStop(0,`rgba(5,65,72,${input.right*.85})`);clear.addColorStop(.6,`rgba(8,80,83,${input.right*.35})`);clear.addColorStop(1,'rgba(8,80,83,0)');
        ctx.fillStyle=clear;ctx.fillRect(0,0,width,height);
      }
      ctx.restore();
    }
  }
  const pulseData=new Float32Array(12);
  function render() {
    if(fallback&&(!gl||!program||contextLost)){drawFallback();return;}
    if(!gl||contextLost||!program)return;
    gl.useProgram(program);gl.uniform2f(uniforms.uSize,width,height);gl.uniform2f(uniforms.uPointer,input.x,input.y);
    gl.uniform2f(uniforms.uVelocity,input.dx,input.dy);gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uClock,clock);
    gl.uniform1f(uniforms.uLeft,input.left);gl.uniform1f(uniforms.uRight,input.right);gl.uniform1f(uniforms.uEnergy,input.energy);gl.uniform1f(uniforms.uMaterial,materialValue);
    gl.uniform1f(uniforms.uProgress,sceneProgress);gl.uniform1f(uniforms.uAssembly,assembly);gl.uniform2f(uniforms.uTrail,trail[0],trail[1]);
    pulses.forEach((p,i)=>pulseData.set(p,i*4));gl.uniform4fv(uniforms['uPulses[0]'],pulseData);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  function tick(timestamp) {
    frame=0;if(destroyed||paused||document.hidden){last=0;return;}
    const seconds=timestamp/1000,realDelta=last?Math.min(.5,seconds-last):1/60,dt=Math.min(.05,realDelta);last=seconds;clock+=realDelta;
    const follow=1-Math.exp(-realDelta*rates[material]);
    let distance=0;
    for(const k of ['x','y','dx','dy','left','right','energy']){const d=target[k]-input[k];input[k]+=d*follow;distance+=Math.abs(d);}
    const trailDecay=Math.exp(-realDelta*({water:2.1,amber:.48,metal:5.5,glass:12}[material]));
    trail[0]=clamp((trail[0]+input.dx*input.left*dt*.55)*trailDecay,-.65,.65);
    trail[1]=clamp((trail[1]+input.dy*input.left*dt*.55)*trailDecay,-.65,.65);
    const active=input.left>.01||input.right>.01||input.energy>.01;
    if(!reducedMotion||active)time+=dt*({water:1,amber:.27,metal:.65,glass:0}[material]);
    if(!sceneControlled){
      materialValue+=(materials[material]-materialValue)*(1-Math.exp(-realDelta*7));
      if(Math.abs(materialValue-materials[material])<.001)materialValue=materials[material];
    }
    render();forceFrames=Math.max(0,forceFrames-1);
    frameSeconds+=realDelta;frameCount++;
    if(frameSeconds>2){
      if(frameCount/frameSeconds<27)lowWindows++;else lowWindows=0;
      if(lowWindows>=2&&scale>.53){scale*=.82;resize();lowWindows=0;}
      frameSeconds=0;frameCount=0;
    }
    const pulseActive=pulses.some(p=>p[3]&&clock-p[2]<5);
    settled=distance<.002&&(sceneControlled||materialValue===materials[material])&&!pulseActive&&Math.hypot(...trail)<.002;
    const autonomous=!reducedMotion&&materialValue<2.999;
    if(autonomous||active||!settled||forceFrames>0)frame=requestAnimationFrame(tick);else last=0;
  }
  function wake(count=1){forceFrames=Math.max(forceFrames,count);if(!frame&&!destroyed&&!paused&&!document.hidden)frame=requestAnimationFrame(tick);}
  function visibility(){if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;last=0;target.left=target.right=target.energy=0;}else wake(2);}
  listen(document,'visibilitychange',visibility);
  listen(canvas,'webglcontextlost',event=>{event.preventDefault();contextLost=true;initializeFallback();onReady({renderer:'canvas',reason:'context-lost'});});
  listen(canvas,'webglcontextrestored',()=>{try{contextLost=false;initializeWebGL();canvas.style.opacity='';if(fallback)fallback.style.display='none';resize();render();onReady({renderer:'webgl'});}catch{contextLost=true;initializeFallback();}});
  const resizeObserver=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;
  resizeObserver?.observe(canvas);if(!resizeObserver)listen(window,'resize',resize);
  try{initializeWebGL();onReady({renderer:'webgl'});}catch(error){gl=null;program=null;initializeFallback();onReady({renderer:'canvas',reason:'webgl-unavailable'});}
  resize();render();wake(3);
  return {
    setMaterial(id){if(!Object.hasOwn(materials,id))return;sceneControlled=false;material=id;if(paused){materialValue=materials[id];render();return;}wake(3);},
    // Scroll is the source of truth: these values have no temporal easing.
    setScene(value={}){
      const nextMaterial=Number.isFinite(value.materialValue)?clamp(value.materialValue,0,3):materialValue;
      const nextProgress=Number.isFinite(value.progress)?clamp(value.progress,0,1):sceneProgress;
      const nextAssembly=Number.isFinite(value.assembly)?clamp(value.assembly,0,1):assembly;
      const changed=nextMaterial!==materialValue||nextProgress!==sceneProgress||nextAssembly!==assembly;
      sceneControlled=true;materialValue=nextMaterial;sceneProgress=nextProgress;assembly=nextAssembly;
      material=materialNames[Math.round(materialValue)];
      if(!changed)return;
      if(paused)render();else wake(2);
    },
    setInput(value={}){
      const before=[target.x,target.y,target.dx,target.dy,target.left,target.right,target.energy];
      for(const k of ['x','y'])if(Number.isFinite(value[k]))target[k]=clamp(value[k],0,1);
      for(const k of ['dx','dy'])if(Number.isFinite(value[k]))target[k]=clamp(value[k]*8,-1,1);
      for(const k of ['left','right'])if(k in value)target[k]=value[k]?1:0;
      if(Number.isFinite(value.energy))target.energy=clamp(value.energy,0,1);
      if(paused){
        const after=[target.x,target.y,target.dx,target.dy,target.left,target.right,target.energy];
        if(after.some((v,i)=>Math.abs(v-before[i])>.0001)){Object.assign(input,target);render();}
        return;
      }
      if((!reducedMotion&&materialValue<2.999)||target.left||target.right||target.energy>.01||!settled)wake();
    },
    pulse(x=.5,y=.5){pulses[pulseIndex]=[clamp(x,0,1),clamp(y,0,1),clock,1];pulseIndex=(pulseIndex+1)%3;if(paused)render();else wake(3);},
    setPaused(value){paused=Boolean(value);if(paused){if(frame)cancelAnimationFrame(frame);frame=0;last=0;target.left=target.right=target.energy=0;input.left=input.right=input.energy=0;render();}else wake(3);},
    setReducedMotion(value){reducedMotion=Boolean(value);wake(2);},
    destroy(){destroyed=true;if(frame)cancelAnimationFrame(frame);listeners.forEach(remove=>remove());resizeObserver?.disconnect();fallback?.remove();if(gl&&!contextLost){if(program)gl.deleteProgram(program);if(buffer)gl.deleteBuffer(buffer);}}
  };
}
