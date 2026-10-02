"use strict";

/* global ExtensionAPI, ChromeUtils, Services */

// Partie privilégiée : tourne dans le processus parent avec les droits du navigateur,
// seul endroit où l'on peut activer/désactiver une autre extension (AddonManager).

var { AddonManager } = ChromeUtils.importESModule(
  "resource://gre/modules/AddonManager.sys.mjs"
);
var { setTimeout } = ChromeUtils.importESModule(
  "resource://gre/modules/Timer.sys.mjs"
);

// Zen y écrit l'uuid de l'espace actif à chaque changement d'espace.
const ACTIVE_SPACE_PREF = "zen.workspaces.active";
// Au-delà, on lit les espaces sans attendre la fin de l'initialisation de Zen.
const READY_TIMEOUT_MS = 10000;

async function setEnabled(id, enabled) {
  const addon = await AddonManager.getAddonByID(id);
  if (!addon) {
    return;
  }
  if (enabled && addon.userDisabled) {
    await addon.enable();
  } else if (!enabled && !addon.userDisabled) {
    await addon.disable();
  }
}

function activeSpace() {
  return Services.prefs.getStringPref(ACTIVE_SPACE_PREF, "");
}

// Une fenêtre privée n'a pas d'espaces : on prend la première fenêtre qui en a.
function firstSpaces(wins) {
  for (const win of wins) {
    const spaces = win.gZenWorkspaces?.getWorkspaces?.();
    if (spaces?.length) {
      return spaces;
    }
  }
  return null;
}

async function readSpaces() {
  const wins = [...Services.wm.getEnumerator("navigator:browser")];
  let spaces = firstSpaces(wins);
  if (!spaces) {
    // Au démarrage, la liste reste vide tant que Zen n'a pas fini de s'initialiser.
    await Promise.all(
      wins.map(win =>
        Promise.race([
          win.gZenWorkspaces?.promiseInitialized,
          new Promise(resolve => setTimeout(resolve, READY_TIMEOUT_MS)),
        ]).catch(() => {})
      )
    );
    spaces = firstSpaces(wins);
  }
  return spaces ?? [];
}

this.zenSpaceAddons = class extends ExtensionAPI {
  // id d'extension → uuids des espaces où elle est active
  rules = {};
  // extensions qu'on a prises en charge, rendues actives si on cesse de les gérer
  managed = new Set();
  // un changement à la fois : des bascules rapides d'espace ne se chevauchent pas
  queue = Promise.resolve();
  // dernière erreur en appliquant les règles, affichée par checkHealth()
  lastError = null;

  onShutdown(isAppShutdown) {
    if (this.observer) {
      Services.prefs.removeObserver(ACTIVE_SPACE_PREF, this.observer);
    }
    if (isAppShutdown) {
      return;
    }
    // Cette extension est désactivée ou désinstallée : on ne laisse rien désactivé derrière nous.
    for (const id of this.managed) {
      setEnabled(id, true).catch(console.error);
    }
  }

  apply(released = []) {
    this.queue = this.queue
      .then(async () => {
        for (const id of released) {
          await setEnabled(id, true);
        }
        const space = activeSpace();
        for (const [id, spaces] of Object.entries(this.rules)) {
          await setEnabled(id, spaces.includes(space));
        }
        this.lastError = null;
      })
      .catch(e => {
        this.lastError = e;
        console.error("[zen-space-addons]", e);
      });
    return this.queue;
  }

  getAPI(context) {
    const api = this;
    return {
      zenSpaceAddons: {
        async getSpaces() {
          const spaces = await readSpaces();
          return spaces.map(s => ({ uuid: s.uuid, name: s.name }));
        },

        async getActiveSpace() {
          return activeSpace();
        },

        async setRules(rules) {
          const next = { ...rules };
          delete next[context.extension.id];
          const released = [...api.managed].filter(id => !(id in next));
          api.managed = new Set(Object.keys(next));
          api.rules = next;
          // Une seule fois par instance, même si la page des réglages appelle aussi l'API.
          if (!api.observer) {
            api.observer = () => api.apply();
            Services.prefs.addObserver(ACTIVE_SPACE_PREF, api.observer);
          }
          await api.apply(released);
        },

        // Vérifie les détails internes de Zen dont dépend l'extension (voir le README).
        async checkHealth() {
          const problems = [];
          const prefExists =
            Services.prefs.getPrefType(ACTIVE_SPACE_PREF) ===
            Services.prefs.PREF_STRING;
          if (!prefExists) {
            problems.push(
              `Zen n'écrit plus l'espace actif dans le réglage ${ACTIVE_SPACE_PREF} : changer d'espace n'active ni ne désactive plus rien.`
            );
          }

          // Sans fenêtre ouverte, on ne peut pas savoir si les espaces sont lisibles.
          if (Services.wm.getMostRecentWindow("navigator:browser")) {
            let spaces = [];
            try {
              spaces = await readSpaces();
            } catch (e) {
              console.error("[zen-space-addons]", e);
            }
            const valid =
              spaces.length &&
              spaces.every(
                s => typeof s?.uuid === "string" && typeof s?.name === "string"
              );
            if (!valid) {
              problems.push(
                "gZenWorkspaces.getWorkspaces() ne renvoie plus la liste des espaces : la grille ne peut plus les afficher."
              );
            } else if (
              prefExists &&
              !spaces.some(s => s.uuid === activeSpace())
            ) {
              problems.push(
                `Le réglage ${ACTIVE_SPACE_PREF} ne contient plus l'uuid de l'espace actif : les règles risquent de s'appliquer au mauvais espace.`
              );
            }
          }

          if (api.lastError) {
            problems.push(
              `Erreur en appliquant les règles : ${api.lastError.message ?? api.lastError}`
            );
          }
          return problems;
        },
      },
    };
  }
};
