import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()


def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:90])
    s = s.replace(a, b)


# ---- new body shapes (generic parametric builder), registered next to the originals ----
rep("""  ['car','suv','truck','small'].forEach(k=>M[k]=upload(car(k)));""",
"""  ['car','suv','truck','small'].forEach(k=>M[k]=upload(car(k)));
  // Saudi-favourite body styles (generic shapes, no brands): family sedan, big SUV, pickup, hatchback, modern EV, crossover, sports coupe
  const CARX={
   family:{Wd:.93,Lh:2.42,H1:.82,H2:1.45,bz0:-.62,bz1:.47,tz0:-.4,tz1:.08,tw:.8,grille:[.62,.64,.68],gw:.55,bar:false},
   luxsuv:{Wd:1.03,Lh:2.55,H1:1.15,H2:2.0,bz0:-.68,bz1:.42,tz0:-.64,tz1:.27,tw:.86,grille:[.75,.77,.8],gw:.7,rails:true,rideH:.42},
   pickup:{Wd:.98,Lh:2.65,H1:1.02,H2:1.86,bz0:-.12,bz1:.42,tz0:-.1,tz1:.25,tw:.84,grille:[.2,.21,.23],gw:.62,bed:true,rideH:.4},
   hatch:{Wd:.84,Lh:1.95,H1:.8,H2:1.52,bz0:-.93,bz1:.42,tz0:-.8,tz1:.1,tw:.8,grille:[.08,.08,.09],gw:.45},
   ev:{Wd:.95,Lh:2.45,H1:.8,H2:1.44,bz0:-.86,bz1:.48,tz0:-.34,tz1:.06,tw:.78,grille:null,bar:true,roof:[.06,.07,.09]},
   crossover:{Wd:.95,Lh:2.25,H1:.98,H2:1.72,bz0:-.7,bz1:.44,tz0:-.5,tz1:.2,tw:.8,grille:[.12,.12,.14],gw:.62,roof:[.07,.07,.08],rideH:.38},
   sport:{Wd:.97,Lh:2.3,H1:.66,H2:1.14,bz0:-.78,bz1:.5,tz0:-.28,tz1:.02,tw:.72,grille:[.06,.06,.07],gw:.6,spoiler:true,rideH:.26,bar:true}};
  const carX=k=>{const o=CARX[k],b=MB(),p=(x,y,z)=>[x,y,z],{Wd,Lh,H1,H2}=o,y0=o.rideH||.32,dk=[.07,.07,.08];
   b.box(-Wd,y0,-Lh,Wd,H1,Lh,W,0);
   const bz0=Lh*o.bz0,bz1=Lh*o.bz1,tz0=Lh*o.tz0,tz1=Lh*o.tz1,bw=Wd*.94,tw=Wd*o.tw;
   b.quad(p(-bw,H1,bz1),p(bw,H1,bz1),p(tw,H2,tz1),p(-tw,H2,tz1),W,7);b.quad(p(bw,H1,bz0),p(-bw,H1,bz0),p(-tw,H2,tz0),p(tw,H2,tz0),W,7);
   b.quad(p(bw,H1,bz1),p(bw,H1,bz0),p(tw,H2,tz0),p(tw,H2,tz1),W,7);b.quad(p(-bw,H1,bz0),p(-bw,H1,bz1),p(-tw,H2,tz1),p(-tw,H2,tz0),W,7);
   if(o.roof)b.quad(p(-tw,H2+.005,tz1),p(tw,H2+.005,tz1),p(tw,H2+.005,tz0),p(-tw,H2+.005,tz0),o.roof,1);else b.quad(p(-tw,H2,tz1),p(tw,H2,tz1),p(tw,H2,tz0),p(-tw,H2,tz0),W,0);
   if(o.bed){b.box(-Wd,H1,-Lh,-Wd+.08,H1+.32,bz0-.05,W,0);b.box(Wd-.08,H1,-Lh,Wd,H1+.32,bz0-.05,W,0);b.box(-Wd,H1,-Lh,Wd,H1+.32,-Lh+.08,W,0);b.box(-Wd+.08,H1-.02,-Lh+.08,Wd-.08,H1+.01,bz0-.05,dk,1);}
   if(o.rails)for(const sx of[-1,1])b.box(sx*tw*.86-.04,H2,tz0+.1,sx*tw*.86+.04,H2+.07,tz1-.1,[.55,.57,.6],1);
   if(o.spoiler){b.box(-Wd*.85,H1+.18,-Lh+.05,Wd*.85,H1+.23,-Lh+.38,dk,1);for(const sx of[-1,1])b.box(sx*Wd*.6-.03,H1,-Lh+.15,sx*Wd*.6+.03,H1+.19,-Lh+.25,dk,1);}
   b.box(-Wd*1.01,y0-.04,-Lh-.07,Wd*1.01,y0+.2,-Lh+.25,dk,1);b.box(-Wd*1.01,y0-.04,Lh-.25,Wd*1.01,y0+.18,Lh+.07,dk,1);
   if(o.bar){b.quad(p(-Wd*.92,H1-.13,-Lh-.012),p(Wd*.92,H1-.13,-Lh-.012),p(Wd*.92,H1-.07,-Lh-.012),p(-Wd*.92,H1-.07,-Lh-.012),[1,.07,.04],14);
    b.quad(p(-Wd*.9,H1-.11,Lh+.012),p(Wd*.9,H1-.11,Lh+.012),p(Wd*.9,H1-.07,Lh+.012),p(-Wd*.9,H1-.07,Lh+.012),[1,.97,.9],12);}
   else{for(const [a1,a2] of[[-.95,-.45],[.45,.95]])b.quad(p(Wd*a1,H1-.24,-Lh-.012),p(Wd*a2,H1-.24,-Lh-.012),p(Wd*a2,H1-.06,-Lh-.012),p(Wd*a1,H1-.06,-Lh-.012),[1,.07,.04],14);
    for(const [a1,a2] of[[-.92,-.55],[.55,.92]])b.quad(p(Wd*a1,H1-.2,Lh+.012),p(Wd*a2,H1-.2,Lh+.012),p(Wd*a2,H1-.07,Lh+.012),p(Wd*a1,H1-.07,Lh+.012),[1,.97,.88],12);}
   if(o.grille){const gh=o.rideH>.35?.32:.18;b.quad(p(-Wd*o.gw,H1-.08-gh,Lh+.01),p(Wd*o.gw,H1-.08-gh,Lh+.01),p(Wd*o.gw,H1-.08,Lh+.01),p(-Wd*o.gw,H1-.08,Lh+.01),o.grille,1);}
   b.box(-.27,y0+.24,-Lh-.09,.27,y0+.38,-Lh-.07,[.95,.95,.95],1);
   b.box(-Wd-.12,H1-.05,bz1-.15,-Wd,H1+.12,bz1,W,0);b.box(Wd,H1-.05,bz1-.15,Wd+.12,H1+.12,bz1,W,0);
   const wr=o.rideH>.35?.4:o.rideH<.3?.33:.35;for(const sx of[-1,1])for(const zz of[-Lh*.64,Lh*.64])b.wheelX(sx*(Wd-.08),wr,zz,wr,.14,12);return b;};
  Object.keys(CARX).forEach(k=>M[k]=upload(carX(k)));""")

# ---- player car: use the new meshes ----
rep("""M[{small:'small',suv:'suv',truck:'truck',cyber:'cyber'}[S.vehicle]||'car']""",
    """M[{small:'small',suv:'suv',truck:'truck',cyber:'cyber',family:'family',luxsuv:'luxsuv',pickup:'pickup',hatch:'hatch',ev:'ev',crossover:'crossover',sport:'sport'}[S.vehicle]||'car']""")
# eye height inside each car
rep("""({small:1.1,sedan:1.22,suv:1.62,truck:2.45,cyber:1.5}[S.vehicle]||1.22)""",
    """({small:1.1,sedan:1.22,suv:1.62,truck:2.45,cyber:1.5,family:1.22,luxsuv:1.75,pickup:1.68,hatch:1.12,ev:1.2,crossover:1.45,sport:.98}[S.vehicle]||1.22)""")
# ---- traffic: a Saudi-looking road mix ----
TR = "type:Math.random()<.15?'truck':(Math.random()<.3?'suv':'car')"
rep(TR, "type:pickTraffic()", 2)
rep("const m=M[c.type==='truck'?'truck':c.type==='suv'?'suv':'car'];", "const m=M[c.type]||M.car;")
rep("function autopilot(W_,dt){", """// traffic mix loosely following what is common on Saudi roads (family sedans, big SUVs, pickups...)
const TRAFFIC=[['family',22],['luxsuv',14],['car',10],['pickup',12],['suv',8],['crossover',10],['hatch',8],['ev',6],['truck',8],['sport',2]];
function pickTraffic(){let r=Math.random()*100;for(const [k,w] of TRAFFIC){if((r-=w)<=0)return k;}return 'car';}
function autopilot(W_,dt){""")
# ---- the picker ----
rep("""[['small','صغيرة 🚗'],['sedan','سيدان 🚘'],['suv','جيب 🚙'],['truck','شاحنة 🚚'],['cyber','سايبر ⚡ (المضلّعة)']]""",
    """[['family','عائلية 🚘 (مثل كامري)'],['luxsuv','جيب كبير 🚙 (مثل لاندكروزر)'],['pickup','غمارة 🛻 (مثل هايلكس)'],['crossover','كروس أوفر (مثل جيلي)'],['ev','كهربائية ⚡ (مثل BYD)'],['hatch','هاتشباك صغيرة (مثل يارس)'],['sport','رياضية 🏎️'],['sedan','سيدان كلاسيك'],['small','صغيرة 🚗'],['suv','جيب 🚙'],['truck','شاحنة 🚚'],['cyber','سايبر ⚡ (المضلّعة)']]""")
open(p, 'w', encoding='utf-8').write(s)
print('cars patch OK')
