"use strict";

// Transmet les règles enregistrées à la partie privilégiée, au démarrage puis à chaque modification.
async function sendRules() {
  const { rules = {} } = await browser.storage.local.get("rules");
  await browser.zenSpaceAddons.setRules(rules);
}

// Signale un problème sur le bouton de l'extension ; l'infobulle donne le premier.
async function showHealth() {
  const [problem] = await checkHealth();
  await browser.browserAction.setBadgeText({ text: problem ? "!" : "" });
  await browser.browserAction.setTitle({
    title: problem ? `Extensions par espace : ${problem}` : null,
  });
}

function update() {
  sendRules()
    .catch(console.error)
    .then(showHealth)
    .catch(console.error);
}

browser.browserAction.setBadgeBackgroundColor({ color: "#d70022" });

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.rules) {
    update();
  }
});

update();
