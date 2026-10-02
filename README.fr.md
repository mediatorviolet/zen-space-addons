# Extensions par espace (Zen)

[English](README.md)

Extension pour [Zen Browser](https://zen-browser.app) qui n'active certaines extensions que dans certains espaces.

Dans Zen, les extensions sont communes à tous les espaces, et les conteneurs ne les isolent pas non plus. Cette extension active ou désactive les autres extensions à chaque changement d'espace.

## Utilisation

Le bouton « Extensions par espace » ouvre une grille : une ligne par extension, une colonne par espace. L'espace actif est surligné. La même grille est disponible dans `about:addons` → Extensions par espace → Options.

- **Case cochée :** l'extension est active dans cet espace.
- **Ligne cochée partout :** l'extension n'est pas gérée, on n'y touche jamais.
- **Nouvel espace :** une extension gérée y est désactivée tant que sa case n'est pas cochée. C'est volontaire, pour qu'un gestionnaire de mots de passe ne s'active pas dans un espace qu'on n'a pas choisi.
- **Désactivation ou désinstallation de cette extension :** elle réactive d'abord tout ce qu'elle gérait.

L'extension utilise `AddonManager`, qui active et désactive l'extension pour tout le navigateur, et pas onglet par onglet. Ça suffit parce qu'on ne voit qu'un espace à la fois. Avec deux fenêtres ouvertes sur deux espaces différents, c'est le dernier changement d'espace qui décide.

## Installation

L'extension n'est pas signée et utilise une API expérimentale pour obtenir les droits du navigateur : c'est le seul moyen d'activer ou de désactiver une autre extension, car `management.setEnabled()` ne fonctionne que pour les thèmes. Zen respecte les deux réglages ci-dessous parce qu'il est compilé avec `MOZ_REQUIRE_SIGNING: false`. Firefox, lui, les ignore.

1. Dans `about:config`, régler :
   - `extensions.experiments.enabled` → `true`
   - `xpinstall.signatures.required` → `false`. Ce réglage vaut pour tout le navigateur : n'importe quelle extension non signée installée à la main sera acceptée, avec potentiellement tous les droits. N'installer que les siennes.
2. Télécharger `zen-space-addons.xpi` depuis la page [Releases](../../releases), ou le construire :
   ```sh
   mkdir -p dist && rm -f dist/zen-space-addons.xpi \
     && zip -qr dist/zen-space-addons.xpi manifest.json background.js health.js grid.* icon.svg api
   ```
3. Dans `about:addons`, cliquer sur l'engrenage, puis « Installer un module depuis un fichier… », et choisir le `.xpi`.

Pour une mise à jour, installer le nouveau `.xpi` de la même façon. Les règles enregistrées sont conservées. Si on construit soi-même le `.xpi`, incrémenter d'abord `version` dans `manifest.json`.

**Pour développer** (seul le réglage `extensions.experiments.enabled` est nécessaire) : ouvrir `about:debugging#/runtime/this-firefox`, cliquer sur « Charger un module complémentaire temporaire… » et choisir `manifest.json`. Le chargement temporaire disparaît au redémarrage, avec ses règles.

## Structure

- `api/parent.js` : la partie privilégiée, qui tourne dans le processus parent. Elle surveille le changement d'espace, applique les règles et liste les espaces.
- `api/schema.json` : l'API `browser.zenSpaceAddons` exposée au reste de l'extension.
- `background.js` : transmet les règles de `storage.local` à `api/parent.js` au démarrage et à chaque modification, puis signale les problèmes sur le bouton.
- `health.js` : vérifie que l'extension fonctionne, pour le bouton et la grille.
- `grid.html`, `grid.js`, `grid.css` : la grille.

## Si une mise à jour de Zen casse l'extension

L'extension s'appuie sur des détails internes de Zen, pas sur une API publique. Ils se trouvent dans `modules/zen/ZenSpaceManager.mjs`, à l'intérieur de `browser/omni.ja` (une archive zip) dans le dossier d'installation de Zen :

- **Le réglage `zen.workspaces.active`,** où Zen écrit l'uuid de l'espace actif à chaque changement. S'il disparaît, changer d'espace n'active ni ne désactive plus rien.
- **La fonction `gZenWorkspaces.getWorkspaces()`,** qui renvoie la liste des espaces. Si elle change, la grille affiche « Aucun espace trouvé. ».

L'extension vérifie ces détails au démarrage du navigateur et à chaque modification des règles. Si l'un d'eux ne répond plus, ou si la partie privilégiée ne se charge pas, un « ! » apparaît sur son bouton (l'infobulle donne le premier problème) et la grille liste les problèmes en haut. Une erreur survenue en changeant d'espace s'affiche à la prochaine ouverture de la grille.

Le détail des erreurs se trouve dans la console du navigateur (menu Outils → Outils de navigateur), préfixé par `[zen-space-addons]`.

## Pourquoi pas fx-autoconfig

fx-autoconfig permet aussi d'exécuter du JS avec les droits du navigateur, mais il écrit des fichiers dans le dossier d'installation de Zen, avec deux inconvénients :
- **la signature de l'app est cassée,** ce qui risque de casser les extensions qui la vérifient pour communiquer avec leur app de bureau (certains gestionnaires de mots de passe, par exemple) ;
- **chaque mise à jour de Zen efface ces fichiers.**

L'extension, elle, vit dans le profil et ne modifie pas Zen.

## Licence

[MIT](LICENSE)
