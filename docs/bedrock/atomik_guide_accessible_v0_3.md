# atomik v0.3 — Le guide accessible

> **Ce guide n'est pas normatif.** C'est la couche d'apprentissage : elle simplifie volontairement. En cas de doute ou de conflit, `atomik_dsl_spec_v0_3.md` (v0.3.1) fait foi. La `pocket_spec` est la version destinée aux modèles générateurs ; ce guide-ci est pour les humains.

---

## La scène en 30 secondes

Un fichier atomik décrit une **scène** : une petite explication visuelle qui affirme quelque chose. Voici une scène complète et valide :

```atomik
atomik 0.3
scene ma_premiere_scene
claim "L'eau bout à 100 °C au niveau de la mer." [status established]
node eau "Eau à 100 °C"
```

Trois idées à retenir, et vous savez déjà l'essentiel :

1. **Une ligne = une phrase.** Chaque ligne se lit, se comprend et se corrige seule.
2. **Une scène affirme UNE chose** (le `claim`), avec un niveau de confiance (`[status …]`).
3. **Les crochets `[clé valeur]` en fin de ligne sont des précisions optionnelles.** On peut presque toujours les ignorer au début.

Les mots-clés sont en anglais (c'est l'interlangue du format). **Tout votre contenu — labels, types de liens — est dans votre langue.**

---

## Le modèle mental : quatre plans

Une scène atomik empile quatre plans. On peut s'arrêter à n'importe quel étage.

| Plan | Question à laquelle il répond | Mots-clés |
|---|---|---|
| **Le cadre** | *Qu'est-ce que cette scène affirme, et avec quelle confiance ?* | `scene` `claim` `subject` |
| **Le modèle** | *Quelles idées, quels liens entre elles ?* | `node` `evidence` `relation` `group` `place` `data` |
| **La projection** | *Sous quelle forme l'afficher ?* (cycle ? frise ? tableau ?) | `project` |
| **La vie** | *Comment ça bouge, comment ça s'enseigne ?* | `input` `derive` `rule` `step` `mark` |

Règle d'or : **le modèle est la colonne vertébrale**. La projection n'est qu'un habit — la même scène peut se réafficher en cycle, en arbre ou en flux en changeant *une seule ligne*.

---

## Niveau 1 — Des idées et des liens

```atomik
atomik 0.3
scene cycle_eau
claim "L'eau circule en boucle entre mer, air et sol." [status established]
subject [[Cycle de l'eau]]

node evap "Évaporation"
node cond "Condensation"
node pluie "Précipitations"
node coll "Ruissellement"

relation evap -> cond puis
relation cond -> pluie puis
relation pluie -> coll puis
relation coll -> evap puis
```

- `node <id> "<label>"` : une idée. L'`id` (court, sans espaces) sert à la relier ; le label est ce qui s'affiche.
- `relation a -> b <type>` : un lien orienté. **Le type est un mot libre, dans votre langue** (`puis`, `cause`, `contient`, `soutient`…).
- `~` au lieu de `->` pour un lien symétrique (une correspondance, pas une flèche).
- `subject [[…]]` relie la scène à une note existante de votre coffre.

## Niveau 2 — Dire le vrai du douteux (la spécialité d'atomik)

C'est ce qu'aucun autre langage de diagramme ne sait faire : porter le **statut épistémique**.

```atomik
atomik 0.3
scene nombre_planetes
claim "Le Système solaire compte huit planètes." [status contested]

evidence uai2006 "UAI 2006 : huit planètes, Pluton reclassée" [source [[Résolution UAI 2006]]] [date 2006]
evidence avant2006 "Consensus pré-2006 : neuf planètes" [date 1930]

relation uai2006 -> claim supports
relation avant2006 -> claim contradicts
relation r1: uai2006 -> avant2006 supersedes
```

- **Statuts** (sur claim, node, evidence, relation) : `established · supported · contested · hypothesis · speculative · reported · misconception · unspecified`. Deux à connaître par cœur : `reported` = « la source le dit, non vérifié » (le défaut prudent) ; `misconception` = « croyance tenue mais fausse » — le moteur la **barre visiblement**, toujours.
- **`claim` est une cible** : une preuve peut pointer vers lui (`-> claim supports`).
- **Une relation peut avoir un nom** (`r1:`) — et d'autres relations peuvent alors la viser. C'est ce qui permet « cette objection attaque le raisonnement, pas la conclusion » ou « l'analogie casse ici ».
- **`[as …]`** classe le lien épistémiquement : `fact · inference · hypothesis · analogy · interpretation · refutation · boundary`. Le type reste votre mot (`réfute`), la classe dit au moteur *comment le dessiner* (une réfutation se dessine comme un « défaire », pas comme une assertion).

## Niveau 3 — Choisir la forme

```atomik
project as cycle
```

Une ligne. Optionnelle (sans elle : graphe générique). Et **flippable** : changez `cycle` en `flow` et la même scène se réaffiche autrement.

Les 11 projections : `graph · flow · cycle · tree · nested · concentric · timeline · axis · matrix · bar · map`.

Trois outils accompagnent la forme :

```atomik
# Positionner par valeur (frises, échelles) :
node sang "Sang"
place sang at 7.4
project as axis 0..14 [scale log] [label "pH"]

# Positionner par relation spatiale (anatomie, plans) — jamais de coordonnées :
place coeur above diaphragme
project as map

# Tableaux et barres :
data protocoles cols "Protocole" | "Fiabilité" | "Vitesse"
data protocoles row "TCP" | "fiable" | "plus lent"
data protocoles row "UDP" | "au mieux" | "rapide"
project as matrix from protocoles
```

Et `group` pour délimiter des régions (`[kind lane]` : deux couloirs côte à côte — parfait pour les deux moitiés d'une analogie ; membre via `[in <groupe>]` sur les nœuds).

## Niveau 4 — Rendre vivant

```atomik
input intensite = slider 0..100 [default 60] [label "Intensité lumineuse %"]
derive production = intensite * 0.9
mark meter "Production de glucose" value production [max 100]
rule intensite < 15 => note "Trop sombre pour une photosynthèse nette."
```

- `input` : ce que l'apprenant manipule (`slider`, `choice "a" | "b"`, `toggle`).
- `derive` : une valeur calculée (arithmétique simple : `+ - * / ( )` — rien d'autre, c'est voulu).
- `rule <condition> => <effet>` : réagit aux changements. Comparaisons et `and / or / not`.
- Une `rule` peut `note`, `reveal`, `hide`, `highlight` — mais **jamais `set`** : écrire un input depuis une rule créerait des boucles. `set` vit dans les `step` (appliqué une fois, à l'entrée de l'étape).
- `mark meter` : une jauge de sortie.
- Attention aux flèches : **`->` pour les relations, `=>` pour les rules.**

## Niveau 5 — Enseigner (la chorégraphie)

Le geste complet « croyance fausse → prédiction → confrontation → résolution » :

```atomik
atomik 0.3
scene chute_des_corps
claim "Sans air, tous les corps tombent à la même vitesse." [status established]

node croyance "Les objets lourds tombent plus vite" [status misconception]
node video "Marteau et plume lâchés dans le vide" [role evidence]
node verite "Ils atterrissent ensemble"
node raison "C'était la résistance de l'air, pas la masse"

relation video -> croyance réfute [as refutation]
relation raison -> verite explique [as inference]

input pari = choice "le marteau d'abord" | "ensemble" [label "Votre prédiction :"]

step 1 reveal croyance
step 1 note "L'intuition dit : le lourd gagne."
step 2 require pari
step 2 reveal video
step 3 reveal verite
step 3 highlight verite
step 4 reveal raison
rule pari == "ensemble" => note "Bien vu — voici pourquoi."
rule pari != "ensemble" => note "Intuition très répandue. Regardez."
```

- `step <n> <effet>` : la séquence **d'auteur** (le déroulé pédagogique). Plusieurs lignes par étape.
- Effets : `reveal · hide · highlight · note · set · require`.
- `require pari` : **porte d'engagement**, et elle protège toute son étape. Un step qui contient un `require` est un *step à porte* : ses propres `reveal` **attendent la réponse** (ici, la vidéo n'apparaît qu'après le pari), et on ne passe à l'étape suivante qu'une fois l'engagement pris. C'est exactement le geste « prédire d'abord, voir ensuite » — écrivez-le naturellement sur une seule étape, le moteur fait le reste. Et c'est l'engagement qui ouvre la porte, pas la bonne réponse.
- Dès qu'un `reveal x` existe quelque part — dans un `step` **ou dans une `rule`** — `x` démarre **caché**. Tout le reste est visible d'emblée.
- Les `note` sont **transitoires** : on voit celles de l'étape courante et celles des rules actuellement vraies. En avançant, les anciennes s'effacent — une note est un murmure du moment, pas une légende permanente.
- `[status misconception]` + `[as refutation]` : la croyance fausse est *montrée barrée*, et la flèche qui la défait ne ressemble pas à une flèche qui affirme.

---

## Les recettes (« je veux… »)

**…une frise chronologique** → des `node`, un `place <id> at <année>` chacun, `project as timeline`.
**…un tableau comparatif** → `data <id> cols …` puis des `row …`, `project as matrix from <id>`.
**…un cycle** → des `relation a -> b` qui bouclent, `project as cycle`.
**…un fait contesté** → `claim … [status contested]`, une `evidence` par source (avec `[source]` `[date]`), relations vers `claim`.
**…corriger une idée reçue** → `node … [status misconception]`, une `relation … réfute [as refutation]`, des `step`, un `require`.
**…une analogie honnête** → deux `group [kind lane]`, des `~ … [as analogy]` entre les côtés, et **là où ça casse** : `relation limite -> <nom_du_mapping> casse [as boundary]`.
**…une échelle (pH, spectre politique)** → `place <id> at <valeur>`, `project as axis <min>..<max>`.
**…un schéma anatomique/spatial** → `place a above b`, `place c left-of a`, `project as map`.
**…une boucle causale (climat, économie)** → relations avec `[sign +]` / `[sign -]`, `group [kind loop] [polarity reinforcing]`.
**…un explorable à curseur** → `input … slider`, `derive`, `rule`, `mark meter`.

---

## L'antisèche

```
scene <id>                                    claim "<texte>" [status s]
subject [[Note]]                              node <id> "<label>" [role r] [status s] [in g]
evidence <id> "<txt>" [source …] [date …]     relation [id:] a ->|~ b <type> [as c] [sign ±]
group <id> "<label>" [kind cluster|lane|loop] place <id> at <v>  |  place <id> above|below|left-of|right-of|inside|adjacent <id>
data <id> cols "a" | "b"   data <id> row …    project as <archétype> [from d] [lo..hi] [suggested]
input <id> = slider lo..hi | choice "a"|"b" | toggle     derive <id> = <expr>
rule <expr> => <effet>                        step <n> <effet>
mark meter "<label>" value <id> [max v]       effets : note reveal hide highlight · require et set : steps uniquement
statuts : established supported contested hypothesis speculative reported misconception unspecified
classes [as] : fact inference hypothesis analogy interpretation refutation boundary
rôles : process decision start terminal question evidence assumption contradiction
projections : graph flow cycle tree nested concentric timeline axis matrix bar map
```

---

## Les dix pièges

1. **Un seul `claim` par scène.** C'est l'unité de sens. Deux affirmations = deux scènes.
2. **`[[Liens]]` uniquement vers des notes qui existent.** Sinon, un simple `"texte"`. (Les modèles générateurs ont interdiction d'inventer des liens — donnez-vous la même règle.)
3. **`misconception` est un statut, pas une couleur.** `tone` colore ; `status misconception` engage le moteur à barrer. Pour une idée fausse, c'est le statut qu'il faut.
4. **Ne vous battez pas sur la projection.** Elle est optionnelle, et changer d'avis coûte une ligne.
5. **`->` relie, `=>` réagit.** Relation vs rule.
6. **`reveal` cache d'abord — même dans une `rule`.** Mentionner un élément dans n'importe quel `reveal` (step *ou* rule), c'est le rendre invisible au départ. Un élément visé à la fois par `reveal` et `hide` démarre caché.
7. **Le statut du claim : prenez l'habitude.** Optionnel à la main (`unspecified` par défaut), obligatoire pour les scènes générées. `reported` est le réflexe honnête.
8. **Les expressions sont volontairement pauvres.** `+ - * /`, comparaisons, `and/or/not`. Pas de fonctions, pas de boucles. Si vous en avez besoin, c'est que la scène en fait trop.
9. **Un attribut inconnu est ignoré avec un simple avertissement.** Vos fichiers survivront aux versions futures — mais une faute de frappe dans `[staus …]` ne criera pas fort : lisez les warnings.
10. **Jamais de coordonnées.** Dites `at 7.4` ou `above coeur` ; le moteur dessine. Si vous cherchez à placer au pixel, c'est le mauvais outil.

---

## Du texte à l'écran — le moteur de rendu

Vous n'avez pas besoin de comprendre le moteur pour écrire. Mais savoir ce qu'il *garantit* aide à écrire avec confiance.

**Le trajet d'une scène.** Votre texte est lu et transformé en une structure intermédiaire (l'« IR ») où tout est explicite : les défauts remplis, les liens résolus, les étapes normalisées, chaque élément relié à sa ligne source — c'est ce qui permet aux diagnostics de pointer *votre* ligne et aux corrections IA de ne toucher qu'elle. Ensuite seulement, le moteur choisit la géométrie (l'anneau d'un `cycle`, les couloirs d'un `flow`) et dessine. Conséquence pratique : **vous ne placez jamais rien au pixel, et le même fichier redonne exactement le même dessin.**

**Ce que vous verrez toujours, quel que soit le thème.** Une `misconception` est barrée **et** porte un badge « croyance fausse », dans toutes les projections et à toutes les étapes où elle est visible — corrigée, jamais effacée. Le statut du `claim` s'affiche en pastille près du titre. Une `refutation` se termine par une **butée ⊣**, jamais par une pointe de flèche : défaire n'est pas affirmer. Une `boundary` marque visuellement l'endroit où une analogie casse. Et le `tone` ne peut jamais maquiller un statut : le vernis ne dit pas le vrai.

**Petites lois utiles du dessin.** Une flèche ne s'affiche que quand ses *deux* extrémités sont visibles — révéler un nœud fait donc apparaître ses liens vers ce qui est déjà là, sans effet supplémentaire. La mise en page est calculée sur la scène *complète* : les `reveal` font apparaître les éléments à leur place définitive, sans que rien ne saute. Et l'**export** (SVG/impression) montre toujours *tout*, portes ignorées, avec un petit badge d'étape sur les éléments révélés progressivement — une scène imprimée ne cache pas silencieusement son contenu pédagogique.

**Le prototype à essayer** : `apps/prototype-cycle/index.html` — un seul fichier, s'ouvre dans le navigateur, sans installation. À gauche la source (éditez, ça recompile en direct), avec deux autres onglets honnêtes : l'**IR** (la structure exacte que voit le moteur) et les **Diagnostics** (cliquez sur une erreur, la ligne se sélectionne). À droite le rendu : pastille de claim, scène SVG, notes, inputs, navigateur d'étapes avec verrou 🔒 (flèches ← → au clavier), jauges, et le sélecteur de projection — sur une projection `[suggested]`, le changer **réécrit la ligne `project` dans votre source** : le fichier reste la seule vérité. Quatre préréglages : la démo complète (cycle + méprise + porte), un explorable à curseur, la scène étoile-polaire du fixture, et une scène volontairement cassée. *Limites assumées du prototype : seul l'archétype `cycle` a son vrai layout (le reste tombe sur une grille de secours), et les `[[liens]]` sont résolus en simulé — pas encore branchés sur un vrai coffre de notes. Le cœur, lui, est testé : 62 tests, dont la reproduction à l'identique de l'IR du fixture doré et les sept assertions de l'oracle runtime.*

---

## Où aller ensuite

- **La spec formelle** (`atomik_dsl_spec_v0_3.md`) : §4 la grammaire exacte, §5 les vocabulaires complets, §6 les sémantiques fines (steps, groupes, visibilité), §7 ce que tout moteur de rendu doit garantir, §8 comment les scènes sont générées par IA, §11 la traçabilité vers le corpus de test, §12 ce qui est volontairement absent (tracé de fonctions, récursion, petits multiples), §14 le journal des changements (v0.3 → v0.3.1).
- **La spec du moteur** (`atomik_render_core_spec_v0_1.md`) : l'IR, les contrats de layout des onze archétypes, le runtime pur, les jetons de thème — et les errata C1–C4 (intégrés à la spec de langage en v0.3.1) que ce guide reflète déjà.
- **Le fixture doré** (`atomik_scene_ir_golden_northstar_v0_1.json`) : la scène étoile-polaire en trois exemplaires — source canonique, IR attendu, oracle runtime. C'est le test d'acceptation vivant des deux specs.
- **Le prototype** (`apps/prototype-cycle/index.html`, cœur dans `packages/dsl-core/src/` — `lang.js` / `render.js` / `index.js`, tests dans `test_atomik_core.js`) : la preuve par le geste.
- **La pocket spec** (`atomik_pocket_spec_v0_3.md`) : la même chose compressée en ≈1,2K tokens, pour le contexte des modèles.
- Un réflexe pour apprendre : **partez d'une recette, faites-la tourner en la lisant à voix haute.** Si le fichier ne se lit pas comme un plan sensé, il est mal écrit — c'est un invariant du langage, pas un conseil de style.
