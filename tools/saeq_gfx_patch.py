# Graphics upgrade for apps/saeq-albatal (sky, water, god rays, "ultra" quality).
# When a new version of the game arrives, apply it to the new file:
#   python3 tools/saeq_gfx_patch.py apps/saeq-albatal/index.html
# The sleep-mode block and the portal hook live after the portal-sdk.js marker and are
# carried over automatically by the update procedure.
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()


def rep(old, new, cnt=1):
    global s
    n = s.count(old)
    assert n == cnt, (n, old[:90])
    s = s.replace(old, new)


# ---------- SKY: atmosphere + lit, warped clouds + cirrus ----------
rep("uniform float uCloud,uTime,uStars,uSunVis,uMoonVis;out vec4 o;",
    "uniform float uCloud,uTime,uStars,uSunVis,uMoonVis,uQ;out vec4 o;")
rep(""" vec3 c=mix(uSkyHor,uSkyTop,pow(clamp(y,0.,1.),.5));if(y<0.)c=uSkyHor*(.8+.2*exp(y*8.));
 float sd=max(dot(d,uSunDir),0.);c+=uSunCol*(pow(sd,900.)*8.+pow(sd,14.)*.3)*uSunVis;""",
""" float sd=max(dot(d,uSunDir),0.);float sunH=clamp(uSunDir.y,0.,1.);
 vec3 c=mix(uSkyHor,uSkyTop,pow(clamp(y,0.,1.),.5));
 float hz=exp(-abs(y)*9.);c=mix(c,uSkyHor*1.1+uSunCol*.06*uSunVis,hz*.5*uQ);
 vec3 warm=mix(vec3(1.,.5,.25),vec3(1.,.9,.78),smoothstep(.04,.45,sunH));
 c+=warm*uSunVis*uQ*(pow(sd,5.)*.2+pow(sd,40.)*.35)*(.55+.9*hz);
 c+=uSunCol*(pow(sd,900.)*8.+pow(sd,14.)*.3)*uSunVis;
 if(y<0.)c=mix(c,uSkyHor*(.8+.2*exp(y*8.)),smoothstep(0.,-.03,y));""")
rep(""" if(y>.005&&uCloud>0.){vec2 cp=d.xz/(y+.04)*1.1+vec2(uTime*.012,uTime*.005);float n=fbm(cp);float cov=smoothstep(1.-uCloud,1.-uCloud+.38,n);float sh=fbm(cp*1.3+vec2(.2,.1));
  vec3 cc=uCloudCol*(1.05-.45*sh)+uSunCol*.25*uSunVis*pow(sd,3.);c=mix(c,cc,cov*smoothstep(0.,.12,y)*.96);}""",
""" if(y>.005&&uCloud>0.){vec2 cp=d.xz/(y+.04)*1.1+vec2(uTime*.012,uTime*.005);float fh=smoothstep(0.,.12,y);
  if(uQ>.5){vec2 wq=vec2(fbm(cp*.55+uTime*.004),fbm(cp*.55+vec2(5.2,1.3)-uTime*.003));vec2 cw=cp+wq*.6;
   float n=fbm(cw);float cov=smoothstep(1.-uCloud,1.-uCloud+.36,n);
   vec2 sv=uSunDir.xz;float sl=length(sv);sv=sl>1e-3?sv/sl:vec2(0.,1.);float ns=fbm(cw+sv*.14);float lit=clamp((n-ns)*5.+.55,0.,1.);
   float sh=fbm(cw*1.35+vec2(.2,.1));float edge=1.-smoothstep(0.,.25,cov);
   vec3 cc=uCloudCol*(.7+.45*lit-.28*sh)+uSunCol*uSunVis*mix(warm,vec3(1.),.4)*(.22*pow(sd,3.)+.3*lit*pow(sd,1.5)+.9*edge*pow(sd,8.));
   c=mix(c,cc,cov*fh*.96);
   vec2 cp2=d.xz/(y+.09)*.42+vec2(uTime*.018,0.);float n2=fbm(cp2*vec2(1.,3.2));float c2=smoothstep(.56,.86,n2)*.32*(1.-cov)*fh*min(1.,uCloud+.35);
   c=mix(c,uCloudCol*1.08+warm*.12*uSunVis,c2);}
  else{float n=fbm(cp);float cov=smoothstep(1.-uCloud,1.-uCloud+.38,n);float sh=fbm(cp*1.3+vec2(.2,.1));
   vec3 cc=uCloudCol*(1.05-.45*sh)+uSunCol*.25*uSunVis*pow(sd,3.);c=mix(c,cc,cov*fh*.96);}}""")
rep("setU(q,'uStars',T.stars?1:0);", "setU(q,'uStars',T.stars?1:0);setU(q,'uQ',S.quality==='eco'?0:1);")

# ---------- WATER: multi-octave waves, shore->deep colour, crests, sun glitter ----------
rep("uniform float uFogD,uNight,uWet,uTime,uEmis,uEmisHead,uEmisTail,uHead,uWinLit,uAlpha;",
    "uniform float uFogD,uNight,uWet,uTime,uEmis,uEmisHead,uEmisTail,uHead,uWinLit,uAlpha;uniform vec2 uWOff;")
rep("vec3 emis=vec3(0);float alpha=1.;float caus=0.;", "vec3 emis=vec3(0);float alpha=1.;float caus=0.;float glit=0.;")
rep(""" else if(m==4){vec2 w=vPos.xz+vec2(uTime*.4,0.);float t=uTime;N=normalize(vec3(.14*cos(vUv.y*.35+t*1.3)+.08*(vn(w*1.1+t*.3)-.5),1.,.1*cos(vUv.x*.27-t*1.1)+.08*(vn(w*1.7-t*.2)-.5)));
  base=vCol;spec=1.;rough=.05;float foam=smoothstep(2.2,0.,vUv.x+sin(t*1.3+vUv.y*.3)*.7);base=mix(base,vec3(.93),foam*.85);}""",
""" else if(m==4){float t=uTime;vec2 g=vPos.xz+uWOff;float dist=length(vPos);float df=1.-smoothstep(35.,240.,dist);
  float n1=vn(g*.33+vec2(t*.22,t*.09)),n2=vn(g*.85-vec2(t*.37,-t*.18)),n3=vn(g*2.2+vec2(t*.62,t*.27)),n4=vn(g*5.3-vec2(t*.9,t*.4));
  vec2 dn=vec2(.13*cos(vUv.y*.35+t*1.3),.09*cos(vUv.x*.27-t*1.1))+(vec2(n1,n2)-.5)*.22+(vec2(n2,n3)-.5)*.13*df+(vec2(n3,n4)-.5)*.09*df*df;
  N=normalize(vec3(dn.x,1.,dn.y));
  float deep=smoothstep(1.5,42.,vUv.x);vec3 shallow=vCol*vec3(.72,1.22,1.12)+vec3(.02,.075,.065);
  base=mix(shallow,vCol*.82,deep);spec=1.;rough=.035;
  float foam=smoothstep(2.2,0.,vUv.x+sin(t*1.3+vUv.y*.3)*.7)*(.75+.5*vn(g*3.1+t));base=mix(base,vec3(.95),clamp(foam,0.,1.)*.85);
  float crest=smoothstep(.74,.92,n1*.55+n2*.5)*df*.22;base=mix(base,vec3(.92),crest);glit=1.;}""")
rep(""" c+=emis+base*caus*1.6*(uSunCol+.25);""",
""" if(glit>0.){vec3 R=reflect(-V,N);float rs=max(dot(R,uSunDir),0.);float sp=step(.86,h21(floor((vPos.xz+uWOff)*5.)+floor(uTime*7.)));
  c+=uSunCol*(pow(rs,160.)*1.6+pow(rs,900.)*sp*22.)*(1.-uNight);}
 c+=emis+base*caus*1.6*(uSunCol+.25);""")
rep("setU(p,'uCamPos',[0,0,0])", "setU(p,'uCamPos',[0,0,0]);setU(p,'uWOff',[eye[0]%2000,eye[2]%2000])")

# ---------- COMPOSITE: god rays ----------
rep("uniform float uBloomK,uTime,uGrain,uVig,uFloat,uCA,uSat,uCon,uExp;uniform vec3 uLift,uGain;out vec4 o;",
    "uniform float uBloomK,uTime,uGrain,uVig,uFloat,uCA,uSat,uCon,uExp,uRays;uniform vec3 uLift,uGain;uniform vec2 uSunP;out vec4 o;")
rep(""" c+=texture(uBloom,vUv).rgb*uBloomK;c*=uExp;""",
""" c+=texture(uBloom,vUv).rgb*uBloomK;
 if(uRays>0.){vec2 dv=(vUv-uSunP)/28.;vec2 uv=vUv;float dec=1.;vec3 r=vec3(0);for(int i=0;i<28;i++){uv-=dv;r+=max(texture(uBloom,uv).rgb-.3,0.)*dec;dec*=.92;}c+=r*uRays*.028*exp(-length((vUv-uSunP)*vec2(1.,.65))*2.4);}
 c*=uExp;""")
rep("""  // ---- composite
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,Wp,Hp);const q=P.comp;""",
"""  // ---- composite
  let sunP=[.5,.5],rays=0;{const m=VP,x=m[0]*sunDir[0]+m[4]*sunDir[1]+m[8]*sunDir[2],y=m[1]*sunDir[0]+m[5]*sunDir[1]+m[9]*sunDir[2],w=m[3]*sunDir[0]+m[7]*sunDir[1]+m[11]*sunDir[2];
   if(w>.01&&S.quality!=='eco'){sunP=[x/w*.5+.5,y/w*.5+.5];const e=Math.max(Math.abs(sunP[0]-.5),Math.abs(sunP[1]-.5));rays=(night?0:sunVis)*(T.sun?1.35:.85)*Math.max(0,1-Math.max(0,e-.5)/.45);}}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,Wp,Hp);const q=P.comp;""")
rep("setU(q,'uBloomK',(lit?1.1:.55)*G.bloom);setU(q,'uTime',t);",
    "setU(q,'uBloomK',(lit?1.1:.55)*G.bloom);setU(q,'uTime',t);setU(q,'uRays',rays);setU(q,'uSunP',sunP);")
rep("setU(q,'uBloomK',(lit?1.3:.7)*G.bloom);setU(q,'uTime',performance.now()/1000);",
    "setU(q,'uBloomK',(lit?1.3:.7)*G.bloom);setU(q,'uTime',performance.now()/1000);setU(q,'uRays',0);")
old = "setU(P.bright,'uThr',isFloat?1:.82);gl.drawArrays(gl.TRIANGLES,0,3);\n  gl.useProgram(P.blur);gl.uniform1i(U(P.blur,'uT'),0);for(let k=0;k<2;k++)"
rep(old, old.replace("k<2", "k<(S.quality==='ultra'?3:2)"))
# ---------- quality: new "ultra" tier ----------
rep("const s=Math.min(V.dpr||1,S.quality==='eco'?1:1.6);",
    "const s=Math.min(V.dpr||1,S.quality==='eco'?1:S.quality==='ultra'?2:1.6);", 2)
rep("[['high','عالية'],['eco','موفّرة للبطارية 🔋']]",
    "[['ultra','فائقة ✨'],['high','عالية'],['eco','موفّرة للبطارية 🔋']]")
# expose the game's own audio so sleep mode can lower it
rep("master.connect(AC.destination);", "master.connect(AC.destination);window.__gameMaster=master;window.__gameAC=AC;")
open(p, 'w', encoding='utf-8').write(s)
print("graphics patch OK")
