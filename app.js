const staffPin = "1111";
const managerPin = "9999";
const taxRate = 0.08875;

let role = null;
let ticket = [];

const menu = [
  { cat:"Apps", name:"Burrata", price:18 },
  { cat:"Apps", name:"Calamari", price:21 },
  { cat:"Entrees", name:"Spaghetti Pomodoro", price:28 },
  { cat:"Entrees", name:"Veal Milanese", price:48 },
  { cat:"Drinks", name:"Espresso", price:5 },
  { cat:"Desserts", name:"Tiramisu", price:14 }
];

const $ = id => document.getElementById(id);
const money = n => "$" + n.toFixed(2);

$("staffLogin").onclick = () => {
  if ($("staffCode").value === staffPin) login("staff");
};

$("managerLogin").onclick = () => {
  if ($("managerCode").value === managerPin) login("manager");
};

$("logout").onclick = () => location.reload();

function login(r) {
  role = r;
  $("login").hidden = true;
  $("pos").hidden = false;
  $("sessionRole").innerText = r.toUpperCase();
  drawMenu();
}

function drawMenu() {
  const menuDiv = $("menu");
  menuDiv.innerHTML = "";
  menu.forEach(item => {
    const btn = document.createElement("button");
    btn.innerText = `${item.cat} – ${item.name} ${money(item.price)}`;
    btn.onclick = () => addItem(item);
    menuDiv.appendChild(btn);
  });
}

function addItem(item) {
  ticket.push(item);
  drawTicket();
}

function drawTicket() {
  const t = $("ticket");
  t.innerHTML = "";
  let subtotal = 0;

  ticket.forEach(i => {
    subtotal += i.price;
    t.innerHTML += `<div>${i.name} ${money(i.price)}</div>`;
  });

  const tax = subtotal * taxRate;
  $("subtotal").innerText = money(subtotal);
  $("tax").innerText = money(tax);
  $("total").innerText = money(subtotal + tax);
}

$("print").onclick = () => window.print();
