"use strict";

const api = browser.zenSpaceAddons;

async function loadRules() {
  const { rules = {} } = await browser.storage.local.get("rules");
  return rules;
}

async function toggle(id, uuid, checked, spaces) {
  const rules = await loadRules();
  const all = spaces.map(s => s.uuid);
  const allowed = new Set(rules[id] ?? all);
  if (checked) {
    allowed.add(uuid);
  } else {
    allowed.delete(uuid);
  }
  // Cochée partout : on ne la gère plus, elle reste active quel que soit l'espace.
  if (all.every(u => allowed.has(u))) {
    delete rules[id];
  } else {
    rules[id] = all.filter(u => allowed.has(u));
  }
  await browser.storage.local.set({ rules });
}

// Des clics rapides s'enregistrent l'un après l'autre, sans s'écraser.
let saving = Promise.resolve();

async function render() {
  const [spaces, active, self, installed, rules] = await Promise.all([
    api.getSpaces(),
    api.getActiveSpace(),
    browser.management.getSelf(),
    browser.management.getAll(),
    loadRules(),
  ]);
  const table = document.getElementById("grid");

  if (!spaces.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Aucun espace trouvé.";
    table.replaceWith(empty);
    return;
  }

  const addons = installed
    .filter(a => a.type === "extension" && a.id !== self.id)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const head = table.createTHead().insertRow();
  head.append(document.createElement("th"));
  for (const space of spaces) {
    const th = document.createElement("th");
    th.textContent = space.name;
    th.classList.toggle("active", space.uuid === active);
    head.append(th);
  }

  const body = table.createTBody();
  for (const addon of addons) {
    const row = body.insertRow();
    const name = row.insertCell();
    name.className = "name";
    name.textContent = name.title = addon.name;

    for (const space of spaces) {
      const cell = row.insertCell();
      cell.className = "box";
      cell.classList.toggle("active", space.uuid === active);

      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = !rules[addon.id] || rules[addon.id].includes(space.uuid);
      box.setAttribute("aria-label", `${addon.name} dans ${space.name}`);
      box.addEventListener("change", () => {
        saving = saving
          .then(() => toggle(addon.id, space.uuid, box.checked, spaces))
          .catch(console.error);
      });
      cell.append(box);
    }
  }
}

function showProblems(problems) {
  if (!problems.length) {
    return;
  }
  const list = document.createElement("ul");
  for (const problem of problems) {
    const item = document.createElement("li");
    item.textContent = problem;
    list.append(item);
  }
  const help = document.createElement("p");
  help.textContent =
    "Voir « Si une mise à jour de Zen casse l'extension » dans le README.";
  const box = document.getElementById("problems");
  box.replaceChildren(list, help);
  box.hidden = false;
}

async function main() {
  const problems = await checkHealth();
  try {
    await render();
  } catch (e) {
    console.error(e);
    // Si la partie privilégiée manque, checkHealth l'a déjà expliqué.
    if (!problems.length) {
      problems.push(`La grille n'a pas pu s'afficher : ${e.message}`);
    }
  }
  showProblems(problems);
}

main();
