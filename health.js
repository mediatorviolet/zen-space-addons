"use strict";

// Problèmes qui empêchent l'extension de fonctionner, à montrer ailleurs que dans la console.
// Si la partie privilégiée ne s'est pas chargée, browser.zenSpaceAddons est absent ou ne répond pas.
async function checkHealth() {
  try {
    return await browser.zenSpaceAddons.checkHealth();
  } catch (e) {
    console.error(e);
    return [
      `La partie privilégiée de l'extension (api/parent.js) ne répond pas : ${e.message}. Vérifier que extensions.experiments.enabled vaut true dans about:config.`,
    ];
  }
}
