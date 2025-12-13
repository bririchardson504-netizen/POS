// ===== POS app.js (iPad-safe keypad + manager gating) =====
const LS = { session:"pos_session_v5", ticket:"pos_ticket_v5" };

const settings = {
  restaurantName: "La Stella d’Oro",
  taxRate: 0.08875,
  staffCode: "1111",
  managerCode: "9999"
};

// Big fancy Italian menu (edit anytime)
const menu = [
  M("Apps","Burrata Cloud",18, mods([
    one("Bread", true, opt("Charred focaccia",0), opt("Grilled sourdough",0)),
    many("Add-ons", false, opt("Prosciutto di Parma",6), opt("Black truffle honey",5), opt("Marinated olives",4))
  ])),
  M("Apps","Crispy Calamari Fritti",21, mods([ one("Sauce", true, opt("Spicy arrabbiata",0), opt("Lemon aioli",0), opt("Both",2)) ])),
  M("Apps","Arancini Trio",19, mods([ many("Pick 3", true, opt("Porcini & fontina",0), opt("Short rib ragù",0), opt("Saffron pea",0), opt("Cacio e pepe",0), rule(3,3)) ])),

  M("Entrees","Spaghetti alla Chitarra",29, mods([
    one("Sauce", true, opt("San Marzano pomodoro",0), opt("Basil pesto",2), opt("Spicy vodka rosa",3)),
    one("Add protein", false, opt("None",0), opt("Grilled shrimp",10), opt("Chicken cutlet",8), opt("Meatballs (2)",7)),
    many("Extras", false, opt("Burrata",6), opt("Calabrian chili",1), opt("Parmigiano snow",2))
  ])),
  M("Entrees","Veal Milanese",48, mods([ one("Side", true, opt("Arugula lemon salad",0), opt("Truffle fries",4), opt("Broccolini",3)) ])),
  M("Entrees","Branzino al Limone",46, mods([ one("Finish", true, opt("Lemon caper butter",0), opt("Herb salsa verde",0)) ])),

  M("Drinks","Espresso",5, mods([ one("Style", true, opt("Single",0), opt("Double",2)) ])),
  M("Drinks","San Pellegrino (Sparkling)",7, mods([ one("Size", true, opt("Small",0), opt("Large",4)) ])),

  M("Desserts","Tiramisu (House)",14, mods([ many("Make it extra", false, opt("Add espresso shot",2), opt("Extra mascarpone",2)) ])),
  M("Desserts","Cannoli Trio",16, mods([ many("Pick 3", true, opt("Classic",0), opt("Chocolate hazelnut",0), opt("Pistachio",0), opt("Lemon",0), rule(3,3)) ]))
];

// ---------- tiny helpers ----------
const $ = (id)=>document.getElementById(id);
const money = (n)=>Number(n||0).toLocaleString(undefined,{style:"currency",currency:"USD"});
const esc = (s)=>String(s).replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
function toast(msg){
  const el = $("toastMsg");
  if(!el) { alert(msg); return; }
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> el.hidden = true, 1600);
}

// Menu constructors
function M(cat,name,price,mods){ return {cat,name,price,mods:mods||[]}; }
function mods(arr){ return arr.map(x=>({ ...x })); }
function opt(name,price){ return {name,price}; }
function rule(min,max){ return {min,max, __rule:true}; }
function one(title, required, ...options){ return {title,type:"one",required,options: options.filter(Boolean)}; }
function many(title, required, ...options){
  let r={};
  const last = options[options.length-1];
  if(last && typeof last==="object" && last.__rule){ r={min:last.min,max:last.max}; options.pop(); }
  return {title,type:"many",required,options: options.filter(Boolean), ...r};
}

// ---------- storage ----------
function load(k,f){ try{ const r=localStorage.getItem(k); return r?JSON.parse(r):f; }catch{ return f; } }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }

// ---------- state ----------
let session = load(LS.session, {role:"none"});
let ticket = load(LS.ticket, newTicket());
let activeCat = "Apps";
let selectedLine = null;
let modsIndex = null;

function newTicket(){
  return {
    id: String(Date.now()),
    createdAt: new Date().toLocaleString(),
    table: "",
    items: [], // {name, basePrice, qty, mods, voided, comped, overridePrice}
    discount: null,
    comped: false,
    voided: false
  };
}
function isManager(){ return session.role === "manager"; }

// ---------- iPad-safe KEYPAD (this fixes your issue) ----------
let padResolve = null;
let padValue = "";
let padMode = {mask:false, decimal:false, integer:false};

function openPad(title, initial="", opts={}){
  padMode = {mask:!!opts.mask, decimal:!!opts.decimal, integer:!!opts.integer};
  padValue = String(initial ?? "");
  // dialog elements must exist in your index.html
  const dlg = $("dlgPad");
  const titleEl = $("padTitle");
  const disp = $("padDisplay");
  const grid = $("padGrid");
  if(!dlg || !titleEl || !disp || !grid){
    // If your HTML doesn't include keypad dialog yet, fallback:
    const v = prompt(title, initial);
    return Promise.resolve(v ?? "");
  }

  titleEl.textContent = title;
  renderPadKeys();
  setPadDisplay();

  // Always open after rendering
  try { dlg.showModal(); } catch { dlg.open = true; }

  return new Promise(resolve => { padResolve = resolve; });
}

function setPadDisplay(){
  const disp = $("padDisplay");
  if(!disp) return;
  disp.value = padMode.mask ? "•".repeat(padValue.length) : padValue;
}

function renderPadKeys(){
  const grid = $("padGrid");
  if(!grid) return;
  const keys = ["1","2","3","4","5","6","7","8","9"];
  const row4 = padMode.decimal ? [".","0","00"] : ["0","00"];
  const all = [...keys, ...row4];
  grid.innerHTML = all.map(k=>`<button class="padKey" type="button" data-k="${k}">${k}</button>`).join("");
}

// Event delegation = iPad reliable (no dead buttons)
function wireKeypadOnce(){
  const grid = $("padGrid");
  if(grid && !wireKeypadOnce.done){
    grid.addEventListener("click", (e)=>{
      const btn = e.target.closest("[data-k]");
      if(!btn) return;
      addChar(btn.dataset.k);
    });
    wireKeypadOnce.done = true;
  }

  const clearBtn = $("padClear");
  const backBtn = $("padBack");
  const okBtn = $("padOk");

  if(clearBtn && !clearBtn._wired){
    clearBtn._wired = true;
    clearBtn.addEventListener("click", ()=>{
      padValue = "";
      setPadDisplay();
    });
  }
  if(backBtn && !backBtn._wired){
    backBtn._wired = true;
    backBtn.addEventListener("click", ()=>{
      padValue = padValue.slice(0,-1);
      setPadDisplay();
    });
  }
  if(okBtn && !okBtn._wired){
    okBtn._wired = true;
    okBtn.addEventListener("click", ()=>{
      const out = padValue;
      const dlg = $("dlgPad");
      if(dlg) dlg.close();
      if(padResolve){ const r = padResolve; padResolve = null; r(out); }
    });
  }
}

function addChar(ch){
  if(padMode.integer && !/^\d+$/.test(ch)) return;
  if(ch==="." && (!padMode.decimal || padValue.includes("."))) return;
  if(padValue.length >= 10) return;
  padValue += ch;
  setPadDisplay();
}

// Manager gate using keypad
async function requireManager(action){
  if(isManager()) return action();
  const pin = await openPad("Manager code required", "", {mask:true, integer:true});
  if(pin === settings.managerCode) return action();
  toast("Manager code required.");
}

// ---------- pricing ----------
function lineModsTotal(line){
  let t=0;
  for(const g of (line.mods||[])) for(const c of (g.choices||[])) t += Number(c.price||0);
  return t;
}
function lineUnitPrice(line){
  const base = (line.overridePrice!=null) ? Number(line.overridePrice) : Number(line.basePrice||0);
  return base + lineModsTotal(line);
}
function subtotal(){
  return ticket.items.reduce((s,l)=>{
    if(l.voided) return s;
    const total = lineUnitPrice(l) * Number(l.qty||0);
    return s + (l.comped ? 0 : total);
  },0);
}
function discountAmt(sub){
  if(ticket.comped) return sub;
  if(!ticket.discount) return 0;
  const v=Number(ticket.discount.value||0);
  if(ticket.discount.type==="percent") return Math.min(sub, sub*(v/100));
  return Math.min(sub, v);
}
function totals(){
  const sub=subtotal();
  const disc=discountAmt(sub);
  const taxable=Math.max(0, sub-disc);
  const tax=taxable * settings.taxRate;
  const total=ticket.comped?0:taxable+tax;
  return {sub,disc,tax,total};
}

// ---------- render ----------
function renderCats(){
  const bar = $("catBar");
  if(!bar) return;
  bar.innerHTML = ["Apps","Entrees","Drinks","Desserts"]
    .map(c=>`<button class="catBtn ${c===activeCat?"active":""}" data-cat="${esc(c)}">${esc(c)}</button>`)
    .join("");
  bar.querySelectorAll("[data-cat]").forEach(b=>{
    b.onclick=()=>{ activeCat=b.dataset.cat; renderCats(); renderMenu(); };
  });
}

function renderMenu(){
  const grid = $("menuGrid");
  if(!grid) return;
  const q = ($("menuSearch")?.value||"").trim().toLowerCase();
  const items = menu.filter(m=>m.cat===activeCat).filter(m=>!q || m.name.toLowerCase().includes(q));
  grid.innerHTML = items.map(m=>`
    <div class="tile">
      <div class="tileName">${esc(m.name)}</div>
      <div class="tileSub">${esc(m.cat)}</div>
      <div class="tilePrice">${money(m.price)}</div>
      <button class="btn tileBtn" data-add="${esc(m.name)}">Add</button>
    </div>
  `).join("");
  grid.querySelectorAll("[data-add]").forEach(b=>{
    b.onclick=()=>{ const it=menu.find(x=>x.name===b.dataset.add); if(it) addLine(it); };
  });
}

function renderTicket(){
  const list = $("ticketList");
  if(!list) return;

  if(ticket.voided){
    list.innerHTML = `<div class="muted center" style="padding:16px 0;"><strong>Ticket VOIDED</strong></div>`;
  } else if(!ticket.items.length){
    list.innerHTML = `<div class="muted center" style="padding:16px 0;">Tap menu tiles to add items</div>`;
  } else {
    list.innerHTML = ticket.items.map((l,idx)=>{
      const modsText=(l.mods||[]).flatMap(g=>g.choices.map(c=>`${g.title}: ${c.name}`)).join(" • ");
      const flags = `${l.voided?"VOID ":""}${l.comped?"COMP ":""}${l.overridePrice!=null?"OVERRIDE ":""}`.trim();
      return `
        <div class="line ${idx===selectedLine?"selected":""}" data-sel="${idx}">
          <div>
            <div class="lineTitle">${esc(l.name)} ${flags?`<span class="muted small">(${esc(flags)})</span>`:""}</div>
            <div class="lineMeta">${l.voided?`Voided`:`${l.qty} × ${money(lineUnitPrice(l))}`} ${modsText?` • Mods: ${esc(modsText)}`:""}</div>
          </div>
          <div class="lineBtns">
            <button class="lbtn" data-dec="${idx}">−</button>
            <button class="lbtn" data-inc="${idx}">+</button>
            <button class="lbtn" data-mods="${idx}">Mods</button>
          </div>
        </div>
      `;
    }).join("");

    list.querySelectorAll("[data-sel]").forEach(div=>{
      div.onclick=()=>{ selectedLine=Number(div.dataset.sel); renderTicket(); };
    });
    list.querySelectorAll("[data-dec]").forEach(b=>b.onclick=(e)=>{e.stopPropagation(); qty(+b.dataset.dec,-1);});
    list.querySelectorAll("[data-inc]").forEach(b=>b.onclick=(e)=>{e.stopPropagation(); qty(+b.dataset.inc,+1);});
    list.querySelectorAll("[data-mods]").forEach(b=>b.onclick=(e)=>{e.stopPropagation(); openMods(+b.dataset.mods);});
  }

  const t = totals();
  $("tSubtotal").textContent = money(t.sub);
  $("tDiscount").textContent = "-" + money(t.disc);
  $("tTax").textContent = money(t.tax);
  $("tTotal").textContent = money(t.total);

  save(LS.ticket, ticket);
}

function addLine(it){
  if(ticket.voided) return;
  ticket.items.push({name:it.name, basePrice:it.price, qty:1, mods:[], voided:false, comped:false, overridePrice:null});
  selectedLine = ticket.items.length-1;
  renderTicket();
}

function qty(i,d){
  const l=ticket.items[i]; if(!l || l.voided) return;
  l.qty += d;
  if(l.qty<=0){ ticket.items.splice(i,1); selectedLine=null; }
  renderTicket();
}

// ---------- mods dialog ----------
function openMods(idx){
  const dlg = $("dlgMods");
  const body = $("modsBody");
  const title = $("modsTitle");
  if(!dlg || !body || !title){ toast("Mods UI missing."); return; }

  const line=ticket.items[idx];
  const it = menu.find(x=>x.name===line.name);
  if(!it?.mods?.length){ toast("No mods for this item."); return; }

  modsIndex = idx;
  title.textContent = `Mods: ${line.name}`;

  const current = new Map((line.mods||[]).map(g=>[g.title, new Set((g.choices||[]).map(c=>c.name))]));
  body.innerHTML = it.mods.map((g,gi)=>{
    const opts = g.options.map(o=>{
      const checked = current.get(g.title)?.has(o.name) ? "checked" : "";
      const type = g.type==="one" ? "radio" : "checkbox";
      const price = Number(o.price||0) ? ` (+${money(o.price)})` : "";
      return `
        <label class="modOpt">
          <input type="${type}" name="g_${gi}" data-title="${esc(g.title)}" data-oname="${esc(o.name)}" data-price="${Number(o.price||0)}" ${checked}/>
          <span>${esc(o.name)}${price}</span>
        </label>`;
    }).join("");

    const rules=[];
    if(g.required) rules.push("required");
    if(g.min!=null || g.max!=null) rules.push(`pick ${g.min??0}-${g.max??"any"}`);
    return `<div class="modGroup"><div><strong>${esc(g.title)}</strong> <span class="muted small">${rules.join(" • ")}</span></div>${opts}</div>`;
  }).join("");

  dlg.showModal();
}

function saveMods(){
  const line=ticket.items[modsIndex];
  const it = menu.find(x=>x.name===line.name);
  const chosen = new Map();

  document.querySelectorAll("#modsBody input").forEach(inp=>{
    if(!inp.checked) return;
    const title=inp.dataset.title, oname=inp.dataset.oname, price=Number(inp.dataset.price||0);
    const arr=chosen.get(title)||[];
    arr.push({name:oname, price});
    chosen.set(title, arr);
  });

  for(const g of it.mods){
    const picks = chosen.get(g.title) || [];
    if(g.required && picks.length===0){ toast(`Choose: ${g.title}`); return; }
    if(g.min!=null && picks.length<g.min){ toast(`Pick at least ${g.min} for ${g.title}`); return; }
    if(g.max!=null && picks.length>g.max){ toast(`Pick no more than ${g.max} for ${g.title}`); return; }
    if(g.type==="one" && picks.length>1){ toast(`Pick only one for ${g.title}`); return; }
  }

  line.mods = it.mods.map(g=>({title:g.title, choices: chosen.get(g.title)||[]})).filter(g=>g.choices.length);
  $("dlgMods").close();
  renderTicket();
}

function clearMods(){
  ticket.items[modsIndex].mods=[];
  $("dlgMods").close();
  renderTicket();
}

// ---------- buttons / flows ----------
function setRole(role){ session={role}; save(LS.session,session); renderAll(); }
function signOut(){ setRole("none"); }

function renderAll(){
  $("roleBadge").textContent = session.role==="none" ? "Signed out" : (session.role==="manager"?"Manager":"Staff");
  $("btnSignOut").hidden = session.role==="none";
  $("btnManagerPanel") && ($("btnManagerPanel").hidden = session.role==="none");
  $("viewLogin").hidden = session.role!=="none";
  $("viewPos").hidden = session.role==="none";
  $("viewReceipt").hidden = true;

  if(session.role!=="none"){
    renderCats();
    renderMenu();
    renderTicket();
  }
}

// Manager actions (basic set)
async function doDiscount(){
  await requireManager(async ()=>{
    const type = confirm("OK = % discount\nCancel = $ discount") ? "percent":"amount";
    const v = await openPad(type==="percent" ? "Enter % discount" : "Enter $ discount", "", {decimal: type==="amount", integer: type==="percent"});
    const num = Number(v);
    if(!isFinite(num) || num<0){ toast("Invalid discount"); return; }
    ticket.discount = {type, value:num};
    ticket.comped = false;
    renderTicket();
  });
}
async function doComp(){
  await requireManager(()=>{
    ticket.comped = !ticket.comped;
    if(ticket.comped) ticket.discount=null;
    renderTicket();
  });
}
async function doVoid(){
  await requireManager(()=>{
    if(confirm("Void entire ticket?")){
      ticket.voided = true;
      renderTicket();
    }
  });
}
async function doQty(){
  if(selectedLine==null){ toast("Select an item first."); return; }
  const line = ticket.items[selectedLine];
  const v = await openPad("Enter quantity", String(line.qty||1), {integer:true});
  const n = Math.max(1, Math.min(99, Number(v)));
  line.qty = n;
  renderTicket();
}

// Receipt
function showReceipt(){
  $("viewPos").hidden=true;
  $("viewReceipt").hidden=false;
  $("rName").textContent = settings.restaurantName;
  $("rMeta").textContent = `${ticket.createdAt}${ticket.table?` • ${ticket.table}`:""}${ticket.comped?" • COMP":""}${ticket.voided?" • VOID":""}`;

  const t=totals();
  $("rItems").innerHTML = ticket.items.map(l=>{
    const modsText=(l.mods||[]).flatMap(g=>g.choices.map(c=>`• ${g.title}: ${c.name}${c.price?` (+${money(c.price)})`:""}`)).join("<br>");
    const lineTotal = l.voided ? 0 : (l.comped ? 0 : (lineUnitPrice(l)*l.qty));
    return `
      <div class="trow"><span>${l.qty} × ${esc(l.name)}${l.comped?" (COMP)":""}${l.voided?" (VOID)":""}</span><span>${money(lineTotal)}</span></div>
      ${modsText?`<div class="muted small">${modsText}</div>`:""}
    `;
  }).join("") || `<div class="muted center">No items</div>`;

  $("rSubtotal").textContent = money(t.sub);
  $("rDiscount").textContent = "-" + money(t.disc);
  $("rTax").textContent = money(t.tax);
  $("rTotal").textContent = money(t.total);
}
function backToPos(){ $("viewReceipt").hidden=true; $("viewPos").hidden=false; }

// ---------- wire up safely ----------
function wire(){
  // keypad dialog wiring (safe even if missing)
  wireKeypadOnce();

  $("btnStaffKeypad")?.addEventListener("click", async ()=>{
    const v = await openPad("Enter staff code", "", {mask:true, integer:true});
    $("staffCode").value = v || "";
  });
  $("btnManagerKeypad")?.addEventListener("click", async ()=>{
    const v = await openPad("Enter manager code", "", {mask:true, integer:true});
    $("managerCode").value = v || "";
  });

  $("btnStaff")?.addEventListener("click", ()=>{
    if(($("staffCode").value||"") === settings.staffCode) setRole("staff");
    else toast("Wrong staff code.");
  });
  $("btnManager")?.addEventListener("click", ()=>{
    if(($("managerCode").value||"") === settings.managerCode) setRole("manager");
    else toast("Wrong manager code.");
  });

  $("btnSignOut")?.addEventListener("click", signOut);

  $("menuSearch")?.addEventListener("input", renderMenu);
  $("tableSelect")?.addEventListener("change", ()=>{ ticket.table = $("tableSelect").value; save(LS.ticket,ticket); });

  $("btnNew")?.addEventListener("click", ()=>{
    if(ticket.items.length && !confirm("Start a new ticket?")) return;
    ticket=newTicket(); selectedLine=null; save(LS.ticket,ticket); renderTicket();
  });

  $("btnQty")?.addEventListener("click", doQty);
  $("btnDiscount")?.addEventListener("click", doDiscount);
  $("btnComp")?.addEventListener("click", doComp);
  $("btnVoid")?.addEventListener("click", doVoid);
  $("btnReceipt")?.addEventListener("click", showReceipt);

  $("btnBack")?.addEventListener("click", backToPos);
  $("btnPrint")?.addEventListener("click", ()=>window.print());

  $("btnModsSave")?.addEventListener("click", saveMods);
  $("btnModsClear")?.addEventListener("click", clearMods);

  // select line via event delegation for iPad
  $("ticketList")?.addEventListener("click", (e)=>{
    const sel = e.target.closest("[data-sel]");
    if(sel){ selectedLine = Number(sel.dataset.sel); renderTicket(); }
  });
}

// boot after DOM is ready
document.addEventListener("DOMContentLoaded", ()=>{
  wire();
  renderAll();
});
