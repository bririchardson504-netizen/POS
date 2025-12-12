// ===== iPad-friendly POS (categories, square menu tiles, mods, manager prompts) =====
const LS = {
  settings: "pos_settings_v3",
  session: "pos_session_v3",
  ticket: "pos_ticket_v3"
};

const settings = {
  restaurantName: "La Stella d’Oro",
  taxRate: 0.08875,
  staffCode: "1111",
  managerCode: "9999"
};

const menu = [
  // APPS
  item("Apps","Burrata Cloud",18, mods([
    one("Bread", true, opt("Charred focaccia",0), opt("Grilled sourdough",0)),
    many("Add-ons", false, opt("Prosciutto di Parma",6), opt("Black truffle honey",5), opt("Marinated olives",4))
  ])),
  item("Apps","Crispy Calamari Fritti",21, mods([ one("Sauce", true, opt("Spicy arrabbiata",0), opt("Lemon aioli",0), opt("Both",2)) ])),
  item("Apps","Arancini Trio",19, mods([ many("Pick 3", true, opt("Porcini & fontina",0), opt("Short rib ragù",0), opt("Saffron pea",0), opt("Cacio e pepe",0), {min:3,max:3}) ])),
  item("Apps","Octopus alla Griglia",26, mods([ one("Finish", true, opt("Lemon & caper",0), opt("Calabrian chili",0)) ])),
  item("Apps","Truffle Polenta Fries",16, mods([ many("Dips", false, opt("Garlic aioli",0), opt("Parmesan cream",1), opt("Spicy ketchup",0)) ])),

  // ENTREES
  item("Entrees","Spaghetti alla Chitarra",29, mods([
    one("Sauce", true, opt("San Marzano pomodoro",0), opt("Basil pesto",2), opt("Spicy vodka rosa",3)),
    one("Add protein", false, opt("None",0), opt("Grilled shrimp",10), opt("Chicken cutlet",8), opt("Meatballs (2)",7)),
    many("Extras", false, opt("Burrata",6), opt("Calabrian chili",1), opt("Parmigiano snow",2))
  ])),
  item("Entrees","Cacio e Pepe (Table Style)",31, mods([
    one("Pasta", true, opt("Tonnarelli",0), opt("Bucatini",0)),
    many("Extras", false, opt("Black truffle",9), opt("Crispy pancetta",5))
  ])),
  item("Entrees","Lobster Ravioli",42, mods([
    one("Sauce", true, opt("Brown butter sage",0), opt("Champagne cream",4)),
    many("Luxury add", false, opt("Black truffle",9), opt("Caviar",18))
  ])),
  item("Entrees","Branzino al Limone",46, mods([
    one("Finish", true, opt("Lemon caper butter",0), opt("Herb salsa verde",0)),
    many("Add-ons", false, opt("Grilled shrimp (3)",12), opt("Roasted artichoke",6))
  ])),
  item("Entrees","Veal Milanese",48, mods([
    one("Side", true, opt("Arugula lemon salad",0), opt("Truffle fries",4), opt("Broccolini",3))
  ])),
  item("Entrees","Osso Buco (Saffron Risotto)",56, mods([
    many("Add-ons", false, opt("Extra risotto",6), opt("Truffle shave",10))
  ])),
  item("Entrees","Chicken Parmigiana",34, mods([
    one("Pasta side", true, opt("Spaghetti",0), opt("Rigatoni",0)),
    many("Extras", false, opt("Add burrata",6), opt("Extra basil",0))
  ])),

  // DRINKS
  item("Drinks","San Pellegrino (Sparkling)",7, mods([ one("Size", true, opt("Small",0), opt("Large",4)) ])),
  item("Drinks","Acqua Panna (Still)",7, mods([ one("Size", true, opt("Small",0), opt("Large",4)) ])),
  item("Drinks","Espresso",5, mods([ one("Style", true, opt("Single",0), opt("Double",2)) ])),
  item("Drinks","Affogato",12, mods([
    one("Gelato", true, opt("Vanilla",0), opt("Pistachio",2)),
    many("Add-on", false, opt("Amaretto splash",6))
  ])),
  item("Drinks","House Limonata",8, mods([ many("Add", false, opt("Mint",0), opt("Sparkling",2)) ])),

  // DESSERTS
  item("Desserts","Tiramisu (House)",14, mods([ many("Make it extra", false, opt("Add espresso shot",2), opt("Extra mascarpone",2)) ])),
  item("Desserts","Cannoli Trio",16, mods([ many("Pick 3", true, opt("Classic",0), opt("Chocolate hazelnut",0), opt("Pistachio",0), opt("Lemon",0), {min:3,max:3}) ])),
  item("Desserts","Pistachio Gelato",12, mods([ many("Toppings", false, opt("Candied orange",2), opt("Amaretti crumble",2), opt("Chocolate drizzle",2)) ])),
  item("Desserts","Olive Oil Cake",13, mods([ many("Add", false, opt("Berries",3), opt("Whipped cream",2)) ]))
];

// ---------- helpers to define menu ----------
function item(cat,name,price,mods){ return {cat,name,price,mods:mods||[]}; }
function mods(arr){ return arr.map(x=>({ ...x })); }
function opt(name,price){ return {name,price}; }
function one(title, required, ...options){ return {title,type:"one",required,options: options.filter(Boolean)}; }
function many(title, required, ...options){
  // allow passing {min,max} as last option object
  let rule = {};
  const last = options[options.length-1];
  if(last && typeof last === "object" && ("min" in last || "max" in last) && !("name" in last)){
    rule = options.pop();
  }
  return {title,type:"many",required,options: options.filter(Boolean), ...rule};
}

const $ = (id)=>document.getElementById(id);
const money = (n)=>Number(n||0).toLocaleString(undefined,{style:"currency",currency:"USD"});

let session = load(LS.session, {role:"none"});
let ticket = load(LS.ticket, newTicket());

let activeCat = "Apps";
let modsIndex = null;

// ---------- storage ----------
function load(k,f){ try{ const r=localStorage.getItem(k); return r?JSON.parse(r):f; }catch{ return f; } }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }

// ---------- ticket model ----------
function newTicket(){
  return {
    id: Date.now().toString(),
    createdAt: new Date().toLocaleString(),
    table: "",
    items: [], // {name, basePrice, qty, mods:[{title, choices:[{name,price}]}], note:""}
    discount: null, // {type, value}
    comped: false,
    voided: false
  };
}

function lineModsTotal(line){
  let t=0;
  for(const g of (line.mods||[])) for(const c of (g.choices||[])) t+=Number(c.price||0);
  return t;
}
function unitPrice(line){ return Number(line.basePrice||0) + lineModsTotal(line); }

function subtotal(){
  return ticket.items.reduce((s,l)=>s + unitPrice(l)*l.qty, 0);
}
function discountAmt(sub){
  if(ticket.comped) return sub;
  if(!ticket.discount) return 0;
  const v=Number(ticket.discount.value||0);
  if(ticket.discount.type==="percent") return Math.min(sub, sub*(v/100));
  return Math.min(sub, v);
}
function taxAmt(taxable){ return taxable * settings.taxRate; }
function totals(){
  const sub=subtotal();
  const disc=discountAmt(sub);
  const taxable=Math.max(0, sub-disc);
  const tax=taxAmt(taxable);
  const total=ticket.comped?0:taxable+tax;
  return {sub,disc,tax,total};
}

// ---------- auth ----------
function setRole(role){
  session={role};
  save(LS.session, session);
  renderAll();
}
function signOut(){
  setRole("none");
}
function isManager(){ return session.role==="manager"; }

// Manager gate prompt (what you asked for)
function requireManager(action){
  if(isManager()) return action();
  const pin = prompt("Manager code required:");
  if(pin === settings.managerCode) return action();
  flashHint();
}
function flashHint(){
  $("hint").hidden=false;
  setTimeout(()=> $("hint").hidden=true, 1500);
}

// ---------- menu rendering ----------
function cats(){
  return ["Apps","Entrees","Drinks","Desserts"];
}
function filteredMenu(){
  const q = ($("menuSearch").value||"").trim().toLowerCase();
  return menu.filter(m => m.cat===activeCat)
             .filter(m => !q || m.name.toLowerCase().includes(q));
}
function renderCats(){
  const bar=$("catBar");
  bar.innerHTML = cats().map(c =>
    `<button class="catBtn ${c===activeCat?"active":""}" data-cat="${c}">${c}</button>`
  ).join("");
  bar.querySelectorAll("[data-cat]").forEach(b=>{
    b.onclick=()=>{ activeCat=b.dataset.cat; renderMenu(); renderCats(); };
  });
}
function renderMenu(){
  const g=$("menuGrid");
  const items=filteredMenu();
  g.innerHTML = items.map(m=>`
    <div class="menuItem">
      <div class="menuName">${escape(m.name)}</div>
      <div class="menuCat">${escape(m.cat)}</div>
      <div class="menuPrice">${money(m.price)}</div>
      <button class="btn" data-add="${escape(m.name)}">Add</button>
    </div>
  `).join("");
  g.querySelectorAll("[data-add]").forEach(b=>{
    b.onclick=()=>{
      const it = menu.find(x=>x.name===b.dataset.add);
      if(it) addLine(it);
    };
  });
}

function addLine(it){
  if(ticket.voided) return;
  ticket.items.push({name:it.name, basePrice:it.price, qty:1, mods:[], note:""});
  save(LS.ticket, ticket);
  renderTicket();
}

// ---------- mods ----------
function openMods(idx){
  const line=ticket.items[idx];
  const it = menu.find(x=>x.name===line.name);
  if(!it || !it.mods?.length){ alert("No mods for this item."); return; }

  modsIndex=idx;
  $("modsTitle").textContent = `Mods: ${line.name}`;
  const current = new Map((line.mods||[]).map(g=>[g.title, new Set((g.choices||[]).map(c=>c.name))]));

  $("modsBody").innerHTML = it.mods.map((g,gi)=>{
    const opts = g.options.map((o,oi)=>{
      const checked = current.get(g.title)?.has(o.name) ? "checked" : "";
      const type = g.type==="one" ? "radio" : "checkbox";
      const nameAttr = `g_${gi}`;
      const price = Number(o.price||0) ? ` (+${money(o.price)})` : "";
      return `
        <label class="modOpt">
          <input type="${type}" name="${nameAttr}" data-gi="${gi}" data-title="${escape(g.title)}"
                 data-oname="${escape(o.name)}" data-price="${Number(o.price||0)}" ${checked}/>
          <span>${escape(o.name)}${price}</span>
        </label>`;
    }).join("");

    const rules = [];
    if(g.required) rules.push("required");
    if(g.min!=null || g.max!=null) rules.push(`pick ${g.min??0}-${g.max??"any"}`);
    return `
      <div class="modGroup">
        <div><strong>${escape(g.title)}</strong> <span class="muted small">${rules.join(" • ")}</span></div>
        ${opts}
      </div>`;
  }).join("");

  $("dlgMods").showModal();
}

function saveMods(){
  const line=ticket.items[modsIndex];
  const it = menu.find(x=>x.name===line.name);
  const chosenByTitle = new Map();

  document.querySelectorAll("#modsBody input").forEach(inp=>{
    if(!inp.checked) return;
    const title = inp.dataset.title;
    const oname = inp.dataset.oname;
    const price = Number(inp.dataset.price||0);
    const arr = chosenByTitle.get(title) || [];
    arr.push({name:oname, price});
    chosenByTitle.set(title, arr);
  });

  // validate required/min/max
  for(const g of it.mods){
    const picks = chosenByTitle.get(g.title) || [];
    const n=picks.length;
    if(g.required && n===0){ alert(`Choose: ${g.title}`); return; }
    if(g.min!=null && n<g.min){ alert(`Pick at least ${g.min} for ${g.title}`); return; }
    if(g.max!=null && n>g.max){ alert(`Pick no more than ${g.max} for ${g.title}`); return; }
    if(g.type==="one" && n>1){ alert(`Pick only one for ${g.title}`); return; }
  }

  line.mods = it.mods.map(g=>({
    title: g.title,
    choices: chosenByTitle.get(g.title) || []
  })).filter(g=>g.choices.length);

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

// ---------- ticket rendering ----------
function renderTicket(){
  const list=$("ticketList");
  if(ticket.voided){
    list.innerHTML = `<div class="muted center" style="padding:18px 0;"><strong>Ticket VOIDED</strong></div>`;
  } else if(!ticket.items.length){
    list.innerHTML = `<div class="muted center" style="padding:18px 0;">Tap menu squares to add items</div>`;
  } else {
    list.innerHTML = ticket.items.map((l,idx)=>{
      const modsText = (l.mods||[]).flatMap(g=>g.choices.map(c=>`${g.title}: ${c.name}`)).join(" • ");
      return `
        <div class="line">
          <div>
            <div><strong>${escape(l.name)}</strong> <span class="muted">(${money(unitPrice(l))} ea)</span></div>
            <div class="meta">${modsText?`Mods: ${escape(modsText)}`:""}</div>
          </div>
          <div class="lineBtns">
            <button class="btn ghost" data-dec="${idx}">−</button>
            <strong>${l.qty}</strong>
            <button class="btn ghost" data-inc="${idx}">+</button>
            <button class="btn ghost" data-mods="${idx}">Mods</button>
          </div>
        </div>`;
    }).join("");

    list.querySelectorAll("[data-dec]").forEach(b=>b.onclick=()=>qty(+b.dataset.dec,-1));
    list.querySelectorAll("[data-inc]").forEach(b=>b.onclick=()=>qty(+b.dataset.inc,+1));
    list.querySelectorAll("[data-mods]").forEach(b=>b.onclick=()=>openMods(+b.dataset.mods));
  }

  const t=totals();
  $("tSubtotal").textContent = money(t.sub);
  $("tDiscount").textContent = "-" + money(t.disc);
  $("tTax").textContent = money(t.tax);
  $("tTotal").textContent = money(t.total);

  save(LS.ticket, ticket);
}

function qty(i, d){
  const l=ticket.items[i]; if(!l) return;
  l.qty += d;
  if(l.qty<=0) ticket.items.splice(i,1);
  renderTicket();
}

// ---------- discounts / comp / void ----------
function openDiscount(){
  requireManager(()=>{
    $("discType").value = ticket.discount?.type || "percent";
    $("discValue").value = ticket.discount?.value ?? "";
    $("dlgDiscount").showModal();
  });
}
function applyDiscount(){
  requireManager(()=>{
    const type=$("discType").value;
    const val=Number(($("discValue").value||"").replace(/[^0-9.]/g,""));
    if(!isFinite(val) || val<0){ alert("Enter a valid value."); return; }
    ticket.discount={type,value:val};
    ticket.comped=false;
    $("dlgDiscount").close();
    renderTicket();
  });
}
function clearDiscount(){
  requireManager(()=>{
    ticket.discount=null;
    $("dlgDiscount").close();
    renderTicket();
  });
}
function toggleComp(){
  requireManager(()=>{
    ticket.comped = !ticket.comped;
    if(ticket.comped) ticket.discount=null;
    renderTicket();
  });
}
function voidTicket(){
  requireManager(()=>{
    if(confirm("Void this entire ticket?")){
      ticket.voided=true;
      renderTicket();
    }
  });
}

// ---------- receipt ----------
function showReceipt(){
  $("viewPos").hidden=true;
  $("viewReceipt").hidden=false;

  $("rName").textContent = settings.restaurantName;
  $("rMeta").textContent = `${ticket.createdAt}${ticket.table?` • ${ticket.table}`:""}${ticket.comped?" • COMP":""}${ticket.voided?" • VOID":""}`;

  const t=totals();
  $("rItems").innerHTML = ticket.items.map(l=>{
    const modsText=(l.mods||[]).flatMap(g=>g.choices.map(c=>`• ${g.title}: ${c.name}${c.price?` (+${money(c.price)})`:""}`)).join("<br>");
    return `
      <div class="row space"><span>${l.qty} × ${escape(l.name)}</span><span>${money(l.qty*unitPrice(l))}</span></div>
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

// ---------- render ----------
function renderAll(){
  $("roleBadge").textContent = session.role==="none" ? "Signed out" : (session.role==="manager"?"Manager":"Staff");
  $("btnSignOut").hidden = session.role==="none";

  $("viewLogin").hidden = session.role!=="none";
  $("viewPos").hidden = session.role==="none";
  $("viewReceipt").hidden = true;

  if(session.role!=="none"){
    renderCats();
    renderMenu();
    renderTicket();
  }
}

function escape(s){
  return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

// ---------- wire up ----------
$("btnStaff").onclick=()=>{
  if(($("staffCode").value||"").trim()===settings.staffCode) setRole("staff");
  else alert("Wrong staff code.");
};
$("btnManager").onclick=()=>{
  if(($("managerCode").value||"").trim()===settings.managerCode) setRole("manager");
  else alert("Wrong manager code.");
};
$("btnSignOut").onclick=signOut;

$("menuSearch").oninput=renderMenu;

$("tableSelect").onchange=()=>{
  ticket.table = $("tableSelect").value;
  save(LS.ticket, ticket);
};

$("btnNew").onclick=()=>{
  if(ticket.items.length && !confirm("Start a new ticket?")) return;
  ticket=newTicket();
  save(LS.ticket, ticket);
  renderTicket();
};

$("btnDiscount").onclick=openDiscount;
$("btnComp").onclick=toggleComp;
$("btnVoid").onclick=voidTicket;

$("btnDiscApply").onclick=applyDiscount;
$("btnDiscClear").onclick=clearDiscount;

$("btnReceipt").onclick=showReceipt;
$("btnBack").onclick=backToPos;
$("btnPrint").onclick=()=>window.print();

$("btnModsSave").onclick=saveMods;
$("btnModsClear").onclick=clearMods;

// boot
save(LS.settings, settings);
renderAll();
