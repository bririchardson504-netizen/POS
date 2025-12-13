// ===== Toast-like iPad POS (tiles, categories, keypad, manager-gated actions) =====
const LS = { session:"pos_session_v4", ticket:"pos_ticket_v4" };

const settings = {
  restaurantName: "La Stella d’Oro",
  taxRate: 0.08875,
  staffCode: "1111",
  managerCode: "9999"
};

// MENU (big + fancy). Add more here anytime.
const menu = [
  // Apps
  M("Apps","Burrata Cloud",18, mods([
    one("Bread", true, opt("Charred focaccia",0), opt("Grilled sourdough",0)),
    many("Add-ons", false, opt("Prosciutto di Parma",6), opt("Black truffle honey",5), opt("Marinated olives",4))
  ])),
  M("Apps","Crispy Calamari Fritti",21, mods([ one("Sauce", true, opt("Spicy arrabbiata",0), opt("Lemon aioli",0), opt("Both",2)) ])),
  M("Apps","Arancini Trio",19, mods([ many("Pick 3", true, opt("Porcini & fontina",0), opt("Short rib ragù",0), opt("Saffron pea",0), opt("Cacio e pepe",0), rule(3,3)) ])),
  M("Apps","Octopus alla Griglia",26, mods([ one("Finish", true, opt("Lemon & caper",0), opt("Calabrian chili",0)) ])),
  M("Apps","Truffle Polenta Fries",16, mods([ many("Dips", false, opt("Garlic aioli",0), opt("Parmesan cream",1), opt("Spicy ketchup",0)) ])),

  // Entrees
  M("Entrees","Spaghetti alla Chitarra",29, mods([
    one("Sauce", true, opt("San Marzano pomodoro",0), opt("Basil pesto",2), opt("Spicy vodka rosa",3)),
    one("Add protein", false, opt("None",0), opt("Grilled shrimp",10), opt("Chicken cutlet",8), opt("Meatballs (2)",7)),
    many("Extras", false, opt("Burrata",6), opt("Calabrian chili",1), opt("Parmigiano snow",2))
  ])),
  M("Entrees","Cacio e Pepe (Table Style)",31, mods([
    one("Pasta", true, opt("Tonnarelli",0), opt("Bucatini",0)),
    many("Extras", false, opt("Black truffle",9), opt("Crispy pancetta",5))
  ])),
  M("Entrees","Lobster Ravioli",42, mods([
    one("Sauce", true, opt("Brown butter sage",0), opt("Champagne cream",4)),
    many("Luxury add", false, opt("Black truffle",9), opt("Caviar",18))
  ])),
  M("Entrees","Branzino al Limone",46, mods([
    one("Finish", true, opt("Lemon caper butter",0), opt("Herb salsa verde",0)),
    many("Add-ons", false, opt("Grilled shrimp (3)",12), opt("Roasted artichoke",6))
  ])),
  M("Entrees","Veal Milanese",48, mods([ one("Side", true, opt("Arugula lemon salad",0), opt("Truffle fries",4), opt("Broccolini",3)) ])),
  M("Entrees","Osso Buco (Saffron Risotto)",56, mods([ many("Add-ons", false, opt("Extra risotto",6), opt("Truffle shave",10)) ])),
  M("Entrees","Chicken Parmigiana",34, mods([ one("Pasta side", true, opt("Spaghetti",0), opt("Rigatoni",0)), many("Extras",false,opt("Add burrata",6)) ])),

  // Drinks
  M("Drinks","San Pellegrino (Sparkling)",7, mods([ one("Size", true, opt("Small",0), opt("Large",4)) ])),
  M("Drinks","Acqua Panna (Still)",7, mods([ one("Size", true, opt("Small",0), opt("Large",4)) ])),
  M("Drinks","Espresso",5, mods([ one("Style", true, opt("Single",0), opt("Double",2)) ])),
  M("Drinks","Affogato",12, mods([ one("Gelato", true, opt("Vanilla",0), opt("Pistachio",2)), many("Add-on", false, opt("Amaretto splash",6)) ])),
  M("Drinks","House Limonata",8, mods([ many("Add", false, opt("Mint",0), opt("Sparkling",2)) ])),

  // Desserts
  M("Desserts","Tiramisu (House)",14, mods([ many("Make it extra", false, opt("Add espresso shot",2), opt("Extra mascarpone",2)) ])),
  M("Desserts","Cannoli Trio",16, mods([ many("Pick 3", true, opt("Classic",0), opt("Chocolate hazelnut",0), opt("Pistachio",0), opt("Lemon",0), rule(3,3)) ])),
  M("Desserts","Pistachio Gelato",12, mods([ many("Toppings", false, opt("Candied orange",2), opt("Amaretti crumble",2), opt("Chocolate drizzle",2)) ])),
  M("Desserts","Olive Oil Cake",13, mods([ many("Add", false, opt("Berries",3), opt("Whipped cream",2)) ]))
];

// ---------- helpers ----------
const $ = (id)=>document.getElementById(id);
const money = (n)=>Number(n||0).toLocaleString(undefined,{style:"currency",currency:"USD"});
const esc = (s)=>String(s).replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
function toast(msg){ const el=$("toastMsg"); el.textContent=msg; el.hidden=false; setTimeout(()=>el.hidden=true,1500); }

// Menu item constructors
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

// ---------- state ----------
let session = load(LS.session, {role:"none"});
let ticket = load(LS.ticket, newTicket());
let activeCat = "Apps";
let selectedLine = null; // index
let modsIndex = null;

// ---------- storage ----------
function load(k,f){ try{ const r=localStorage.getItem(k); return r?JSON.parse(r):f; }catch{ return f; } }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }

function newTicket(){
  return {
    id: String(Date.now()),
    createdAt: new Date().toLocaleString(),
    table: "",
    items: [], // {name, basePrice, qty, note, mods, voided, comped, overridePrice}
    discount: null,
    comped: false,
    voided: false
  };
}

function isManager(){ return session.role==="manager"; }

// Manager gate (prompt keypad preferred)
async function requireManager(action){
  if(isManager()) return action();
  const pin = await keypad("Manager code required", "", {mask:true});
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
    const lineTotal = lineUnitPrice(l) * Number(l.qty||0);
    return s + (l.comped ? 0 : lineTotal);
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
function renderAll(){
  $("restName").textContent = settings.restaurantName;
  $("rName").textContent = settings.restaurantName;

  $("roleBadge").textContent = session.role==="none" ? "Signed out" : (session.role==="manager"?"Manager":"Staff");
  $("btnSignOut").hidden = session.role==="none";
  $("btnManagerPanel").hidden = session.role==="none";

  $("viewLogin").hidden = session.role!=="none";
  $("viewPos").hidden = session.role==="none";
  $("viewReceipt").hidden = true;

  if(session.role!=="none"){
    renderCats();
    renderMenu();
    renderTicket();
  }
}

function renderCats(){
  $("catBar").innerHTML = ["Apps","Entrees","Drinks","Desserts"].map(c=>
    `<button class="catBtn ${c===activeCat?"active":""}" data-cat="${esc(c)}">${esc(c)}</button>`
  ).join("");
  $("catBar").querySelectorAll("[data-cat]").forEach(b=>{
    b.onclick=()=>{ activeCat=b.dataset.cat; renderCats(); renderMenu(); };
  });
}

function renderMenu(){
  const q = ($("menuSearch").value||"").trim().toLowerCase();
  const items = menu.filter(m=>m.cat===activeCat).filter(m=>!q || m.name.toLowerCase().includes(q));
  $("menuGrid").innerHTML = items.map(m=>`
    <div class="tile">
      <div class="tileName">${esc(m.name)}</div>
      <div class="tileSub">${esc(m.cat)}</div>
      <div class="tilePrice">${money(m.price)}</div>
      <button class="btn tileBtn" data-add="${esc(m.name)}">Add</button>
    </div>
  `).join("");
  $("menuGrid").querySelectorAll("[data-add]").forEach(b=>{
    b.onclick=()=>{ const it=menu.find(x=>x.name===b.dataset.add); if(it) addLine(it); };
  });
}

function renderTicket(){
  const list=$("ticketList");
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
            <div class="lineMeta">
              ${l.voided?`<span class="muted">Voided</span>`:`${l.qty} × ${money(lineUnitPrice(l))}`}
              ${modsText?` • Mods: ${esc(modsText)}`:""}
            </div>
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

  const t=totals();
  $("tSubtotal").textContent = money(t.sub);
  $("tDiscount").textContent = "-" + money(t.disc);
  $("tTax").textContent = money(t.tax);
  $("tTotal").textContent = money(t.total);

  save(LS.ticket, ticket);
}

function addLine(it){
  if(ticket.voided) return;
  ticket.items.push({
    name: it.name,
    basePrice: it.price,
    qty: 1,
    note: "",
    mods: [],
    voided: false,
    comped: false,
    overridePrice: null
  });
  selectedLine = ticket.items.length-1;
  save(LS.ticket, ticket);
  renderTicket();
}

function qty(i,d){
  const l=ticket.items[i]; if(!l || l.voided) return;
  l.qty += d;
  if(l.qty<=0){ ticket.items.splice(i,1); selectedLine=null; }
  renderTicket();
}

// ---------- mods ----------
function openMods(idx){
  const line=ticket.items[idx];
  const it = menu.find(x=>x.name===line.name);
  if(!it?.mods?.length){ toast("No mods for this item."); return; }

  modsIndex=idx;
  $("modsTitle").textContent = `Mods: ${line.name}`;

  const current = new Map((line.mods||[]).map(g=>[g.title, new Set((g.choices||[]).map(c=>c.name))]));
  $("modsBody").innerHTML = it.mods.map((g,gi)=>{
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

  $("dlgMods").showModal();
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
  save(LS.ticket, ticket);
  $("dlgMods").close();
  renderTicket();
}
function clearMods(){
  ticket.items[modsIndex].mods=[];
  save(LS.ticket, ticket);
  $("dlgMods").close();
  renderTicket();
}

// ---------- manager actions ----------
async function openDiscount(){
  await requireManager(async ()=>{
    const type = await keypadChoice("Discount type", ["Percent (%)","Amount ($)"]);
    if(!type) return;
    const val = await keypad(type.startsWith("Percent") ? "Enter % discount" : "Enter $ discount", "", {decimal: !type.startsWith("Percent")});
    if(val==null) return;
    const num = Number(val);
    if(!isFinite(num) || num<0){ toast("Invalid discount."); return; }
    ticket.discount = { type: type.startsWith("Percent") ? "percent":"amount", value: num };
    ticket.comped = false;
    renderTicket();
  });
}

async function compTicket(){
  await requireManager(()=>{
    ticket.comped = !ticket.comped;
    if(ticket.comped) ticket.discount=null;
    renderTicket();
  });
}

async function voidTicket(){
  await requireManager(()=>{
    if(confirm("Void this entire ticket?")){
      ticket.voided = true;
      renderTicket();
    }
  });
}

async function reopenTicket(){
  await requireManager(()=>{
    ticket.voided = false;
    renderTicket();
  });
}

async function clearDiscount(){
  await requireManager(()=>{
    ticket.discount = null;
    renderTicket();
  });
}

async function setQtySelected(){
  if(selectedLine==null){ toast("Select an item first."); return; }
  const line = ticket.items[selectedLine];
  if(line.voided){ toast("That line is voided."); return; }
  const v = await keypad("Enter quantity", String(line.qty||1), {integer:true});
  if(v==null) return;
  const n = Math.max(1, Math.min(99, Number(v)));
  line.qty = n;
  renderTicket();
}

async function compSelectedItem(){
  if(selectedLine==null){ toast("Select an item first."); return; }
  await requireManager(()=>{
    const l=ticket.items[selectedLine];
    if(!l || l.voided) return;
    l.comped = !l.comped;
    renderTicket();
  });
}

async function voidSelectedItem(){
  if(selectedLine==null){ toast("Select an item first."); return; }
  await requireManager(()=>{
    const l=ticket.items[selectedLine];
    if(!l) return;
    l.voided = !l.voided;
    renderTicket();
  });
}

async function priceOverrideSelected(){
  if(selectedLine==null){ toast("Select an item first."); return; }
  await requireManager(async ()=>{
    const l=ticket.items[selectedLine];
    if(!l || l.voided){ toast("Cannot override a voided item."); return; }
    const v = await keypad("New base price ($)", l.overridePrice!=null ? String(l.overridePrice) : String(l.basePrice), {decimal:true});
    if(v==null) return;
    const n = Number(v);
    if(!isFinite(n) || n<0){ toast("Invalid price."); return; }
    l.overridePrice = n;
    renderTicket();
  });
}

// ---------- receipt ----------
function showReceipt(){
  $("viewPos").hidden=true;
  $("viewReceipt").hidden=false;

  $("rMeta").textContent = `${ticket.createdAt}${ticket.table?` • ${ticket.table}`:""}${ticket.comped?" • COMP":""}${ticket.voided?" • VOID":""}`;

  const t=totals();
  $("rItems").innerHTML = ticket.items.map(l=>{
    if(l.voided) return `<div class="trow"><span>${l.qty} × ${esc(l.name)} (VOID)</span><span>${money(0)}</span></div>`;
    const modsText=(l.mods||[]).flatMap(g=>g.choices.map(c=>`• ${g.title}: ${c.name}${c.price?` (+${money(c.price)})`:""}`)).join("<br>");
    const lineTotal = l.comped ? 0 : (lineUnitPrice(l)*l.qty);
    return `
      <div class="trow"><span>${l.qty} × ${esc(l.name)}${l.comped?" (COMP)":""}</span><span>${money(lineTotal)}</span></div>
      ${modsText?`<div class="muted small">${modsText}</div>`:""}
    `;
  }).join("") || `<div class="muted center">No items</div>`;

  $("rSubtotal").textContent = money(t.sub);
  $("rDiscount").textContent = "-" + money(t.disc);
  $("rTax").textContent = money(t.tax);
  $("rTotal").textContent = money(t.total);
}
function backToPos(){
  $("viewReceipt").hidden=true;
  $("viewPos").hidden=false;
}

// ---------- keypad (no keyboard needed) ----------
let padResolve = null;
let padMode = {mask:false, decimal:false, integer:false};
let padValue = "";

function buildPad(){
  const keys = ["1","2","3","4","5","6","7","8","9"];
  // for decimal mode, show ".", else show blank
  const mid = padMode.decimal ? "." : "";
  const row4 = [mid,"0","00"].filter(x=>x!=="" || padMode.decimal);
  const all = [...keys, ...row4];
  $("padGrid").innerHTML = all.map(k=>`<button class="padKey" type="button" data-k="${k}">${k}</button>`).join("");
  $("padGrid").querySelectorAll("[data-k]").forEach(b=>{
    b.onclick=()=>{ addPadChar(b.dataset.k); };
  });
}

function setPadDisplay(){
  $("padDisplay").value = padMode.mask ? "•".repeat(padValue.length) : padValue;
}

function addPadChar(ch){
  if(padMode.integer){
    if(!/^\d+$/.test(ch)) return;
  }
  if(ch==="." && !padMode.decimal) return;
  if(ch==="." && padValue.includes(".")) return;
  // limit length
  if(padValue.length >= 8) return;
  padValue += ch;
  setPadDisplay();
}

function keypad(title, initial="", opts={}){
  padMode = {mask:!!opts.mask, decimal:!!opts.decimal, integer:!!opts.integer};
  padValue = String(initial ?? "");
  $("padTitle").textContent = title;
  buildPad();
  setPadDisplay();
  $("dlgPad").showModal();
  return new Promise(resolve => { padResolve = resolve; });
}

async function keypadChoice(title, choices){
  // simple choice using confirm chain? we’ll do a keypad-as-choice later if you want.
  // For now: prompt-free choices using iPad confirm:
  const a = choices[0], b = choices[1];
  const ok = confirm(`${title}\n\nOK = ${a}\nCancel = ${b}`);
  return ok ? a : b;
}

$("padClear").onclick=()=>{ padValue=""; setPadDisplay(); };
$("padBack").onclick=()=>{ padValue=padValue.slice(0,-1); setPadDisplay(); };
$("padOk").onclick=()=>{
  const out = padValue;
  $("dlgPad").close();
  if(padResolve){ const r=padResolve; padResolve=null; r(out); }
};

// ---------- auth ----------
function setRole(role){
  session = {role};
  save(LS.session, session);
  renderAll();
}
function signOut(){
  setRole("none");
}

$("btnStaffKeypad").onclick=async ()=>{ $("staffCode").value = await keypad("Enter staff code", "", {mask:true,integer:true}); };
$("btnManagerKeypad").onclick=async ()=>{ $("managerCode").value = await keypad("Enter manager code", "", {mask:true,integer:true}); };

$("btnStaff").onclick=()=>{
  if(($("staffCode").value||"") === settings.staffCode) setRole("staff");
  else toast("Wrong staff code.");
};
$("btnManager").onclick=()=>{
  if(($("managerCode").value||"") === settings.managerCode) setRole("manager");
  else toast("Wrong manager code.");
};

$("btnSignOut").onclick=signOut;
$("btnManagerPanel").onclick=()=> $("dlgManager").showModal();

$("menuSearch").oninput=renderMenu;
$("tableSelect").onchange=()=>{ ticket.table = $("tableSelect").value; save(LS.ticket, ticket); };

$("btnNew").onclick=()=>{
  if(ticket.items.length && !confirm("Start a new ticket?")) return;
  ticket = newTicket();
  selectedLine = null;
  save(LS.ticket, ticket);
  renderTicket();
};

$("btnQty").onclick=setQtySelected;
$("btnDiscount").onclick=openDiscount;
$("btnComp").onclick=compTicket;
$("btnVoid").onclick=voidTicket;
$("btnReceipt").onclick=showReceipt;

$("btnBack").onclick=backToPos;
$("btnPrint").onclick=()=>window.print();

$("btnModsSave").onclick=saveMods;
$("btnModsClear").onclick=clearMods;

// Manager panel buttons
$("btnMgrReopen").onclick=reopenTicket;
$("btnMgrClearDisc").onclick=clearDiscount;
$("btnMgrCompTicket").onclick=compTicket;
$("btnMgrVoidTicket").onclick=voidTicket;
$("btnMgrCompItem").onclick=compSelectedItem;
$("btnMgrVoidItem").onclick=voidSelectedItem;
$("btnMgrPriceOverride").onclick=priceOverrideSelected;

// boot
renderAll();
