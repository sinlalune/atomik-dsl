# Atomik DSL — Test de corpus, lot 02

## But

Suite du lot 01. Dix nouvelles explications (11–20), choisies pour heurter les archétypes **non couverts** au lot 01 et pousser les cas épistémiques durs. Objectif : faire émerger de *nouvelles* ruptures (nommées K–R), pas reconfirmer A–J — tout en notant où A–J **récidivent**, ce qui prouve qu'elles sont systématiques.

Mêmes conventions : mots-clés anglais, contenu anglais (comparabilité), prose française, `# ...` = mur d'expressivité. J'utilise `project as <archetype>` (proposition v0.3) là où `layout` seul ne suffit plus.

---

## 11. Arbre du vivant — *partie-tout profond / containment* (biologie)

Archétype visé : hiérarchie de containment à plusieurs niveaux.

```atomik
scene tree_of_life
claim "Living things are classified in a nested hierarchy from domain to species."
subject [[Biological classification]]

node life "Life"
node eukarya "Eukarya"
node animalia "Animalia"
node chordata "Chordata"
node mammalia "Mammalia"
node primates "Primates"
node homo "Homo sapiens"

relation life -> eukarya contains
relation eukarya -> animalia contains
relation animalia -> chordata contains
relation chordata -> mammalia contains
relation mammalia -> primates contains
relation primates -> homo contains
# un domaine contient PLUSIEURS règnes — où va le "plusieurs" ?
project as tree     # ou project as nested-boxes — même modèle, deux projections
```

**Tient.** La chaîne `contains` donne une hiérarchie propre, projetable en arbre indenté *ou* en boîtes imbriquées : encore un « même modèle, deux projections » (renforce A).

**Casse.**
- **Multiplicité/cardinalité absente** *(NEW K)* : « un domaine contient plusieurs règnes » — le 1-à-N / N-à-N n'a aucune expression ; `contains` est une arête sans compte. Crucial pour taxonomies, schémas entité-relation, UML, toute structure partie-tout.
- *(récurrence C)* : imbrication visuelle profonde = besoin d'une primitive de conteneur, absente.

---

## 12. « Faut-il réessayer une requête échouée ? » — *organigramme décisionnel*

Archétype visé : branches, losanges de décision, retour de boucle.

```atomik
scene retry_decision
claim "Retry transient failures with backoff, but give up after a limit."
subject [[Retry policy]]

node start "Request fails"
node check "Transient error?"     # DÉCISION — un losange, pas une boîte
node count "Retries left?"        # DÉCISION
node wait "Wait with backoff"     # traitement
node retry "Retry request"        # traitement
node fail "Report failure"        # terminal

relation start -> check then
relation check -> count yes       # étiquette de branche "yes"
relation check -> fail no
relation count -> wait yes
relation count -> fail no
relation wait -> retry then
relation retry -> check then      # retour de boucle
```

**Casse.**
- **Rôle/forme structurelle du nœud absent** *(NEW L)* : losange (décision), ovale (départ), rectangle (traitement), terminal — des *rôles sémantiques* distincts. `tone` ne code qu'une humeur de couleur, pas la forme/rôle. Impossible : `node check role decision`. Or l'organigramme *est* défini par ces rôles.
- Étiquettes `yes`/`no` : traitées comme types de relation alors que ce sont des labels de sortie de décision *(récurrence G)*.
- Retour `retry -> check` : boucle-arrière, layout non trivial *(récurrence A)*.

---

## 13. Osmose — *avant/après, même système à deux instants*

Archétype visé : mêmes entités montrées dans deux états côte à côte.

```atomik
scene osmosis
claim "Water moves across a membrane until solute concentration equalizes."
subject [[Osmosis]]

# AVANT
node left_before "Left: low solute"
node right_before "Right: high solute"
relation right_before -> left_before "net water flow"

# APRÈS
node left_after "Left: equalized"
node right_after "Right: equalized"
# left_before et left_after sont le MÊME compartiment à deux temps.
# j'ai dû DUPLIQUER les nœuds — l'identité est perdue.
# comment afficher deux panneaux côte à côte (t0 et t1) ?
```

**Casse.**
- **Aucune construction cadre/panneau ni identité inter-états** *(NEW M)* : montrer le *même* système à t0 puis t1 force à dupliquer chaque nœud (`left_before`/`left_after`), perdant l'identité. Aucun `frame`/`panel`/`snapshot`, aucun « ce nœud est le même à travers deux états ». Bloque avant/après, comparaison-dans-le-temps, petits multiples — archétype majeur (entropie, mitose, diff git, marché avant/après un choc).
- *(lien F)* : l'alternative — *un* panneau animé piloté par le state — est déjà impossible (F : pas d'élément actif pilotable).

---

## 14. Couches internes de la Terre — *concentrique / imbriqué*

Archétype visé : couches concentriques ordonnées vers le centre.

```atomik
scene earth_layers
claim "Earth is structured in concentric layers of increasing density toward the core."
subject [[Structure of Earth]]

node crust "Crust"
node mantle "Mantle"
node outer "Outer core"
node inner "Inner core"

relation crust -> mantle encloses
relation mantle -> outer encloses
relation outer -> inner encloses

project as concentric   # anneaux imbriqués — projection distincte de cycle/tree
# chaque couche a une plage de profondeur (0–35 km, 35–2890 km…) — taille par valeur ?
```

**Casse.**
- **Projection concentrique/anneaux imbriqués** *(NEW, membre nouveau de A)* : distincte de cycle (boucle) et tree (branches). Non définie. Utile pour couches (Terre, atmosphère), diagrammes en oignon, ensembles imbriqués.
- **Épaisseur/plage par valeur** : chaque couche a une profondeur qui devrait dicter sa taille radiale *(récurrence B)*.
- *(récurrence C)* : anneaux = conteneurs imbriqués.

---

## 15. √2 est irrationnel — *preuve linéaire justifiée* (maths)

Archétype visé : étapes séquentielles, chacune découlant de la précédente *par une règle nommée*.

```atomik
scene sqrt2_irrational
claim "The square root of 2 is irrational." status established

node s1 "Assume √2 = a/b in lowest terms."          # HYPOTHÈSE (pour contradiction)
node s2 "Then 2 = a²/b², so a² = 2b²."
node s3 "So a² is even, hence a is even: a = 2k."
node s4 "Then 4k² = 2b², so b² = 2k², b is even."
node s5 "a and b share factor 2 — contradicts 'lowest terms'."   # CONTRADICTION

relation s1 -> s2 "square both sides"     # chaque pas : justifié par une RÈGLE
relation s2 -> s3 "even square => even"
relation s3 -> s4 "substitute"
relation s4 -> s5 "both even"
# s1 est une HYPOTHÈSE, s5 une CONTRADICTION qui la décharge — aucun moyen de le marquer.
```

**Casse.**
- **Structure de preuve absente** *(NEW N)* : « supposer pour contradiction », « donc contradiction », « QED » sont des rôles logiques distincts d'une simple étape. Impossible de marquer `s1` comme hypothèse déchargée par `s5`. Reductio, induction, disjonction de cas — aucune représentation.
- **Warrant (justification) sur la transition** : « en élevant au carré », « pair²⇒pair » sont les *garanties* de chaque pas — le cœur d'une preuve. Traité comme un label de relation non spécifié *(récurrence G)*, alors qu'ici c'est le contenu épistémique central.
- `claim … status established` : re-butée E — statut sur claim non défini dans la grammaire.

---

## 16. Rétroaction glace–albédo — *réseau causal signé (CLD)* (climat)

Archétype visé : boucle causale avec signes (+/−) et type (renforçante/équilibrante).

```atomik
scene ice_albedo_feedback
claim "Melting ice reduces reflectivity, causing further warming — a reinforcing loop."
subject [[Ice–albedo feedback]]

node temp "Temperature"
node ice "Ice cover"
node albedo "Albedo (reflectivity)"
node absorbed "Absorbed sunlight"

relation temp -> ice decreases        # SIGNE : + ou − ?
relation ice -> albedo increases
relation albedo -> absorbed decreases
relation absorbed -> temp increases
# forme une boucle RENFORÇANTE (R). Les boucles ÉQUILIBRANTES (B) existent aussi.
# "increases/decreases" détournés en types — pas de vraie polarité, pas de label de boucle.
```

**Casse.**
- **Polarité/signe des arêtes absent** *(NEW O)* : un lien causal + (augmente) vs − (diminue) est fondamental en pensée systémique. Ici les signes sont des *types* bricolés, sans sémantique exploitable ni propagation.
- **Identification de boucle** : renforçante (R) vs équilibrante (B) — notation établie des causal loop diagrams — inatteignable.
- Poids/force du lien : idem *(récurrence G)*. Graphe dense cyclique = stress de layout maximal *(récurrence A)*.

---

## 17. « Combien de planètes ? » — *fait contesté, sources en désaccord* (le test épistémique dur)

Archétype visé : un claim factuel porté par plusieurs sources contradictoires, avec leur désaccord comme donnée.

```atomik
scene planet_count
claim "The Solar System has eight planets." status disputed

node iau2006 "IAU 2006: 8 planets (Pluto reclassified)."
node pre2006 "Pre-2006 consensus: 9 planets."
node dwarf "Pluto is a dwarf planet."

relation iau2006 -> claim supports        # une relation peut-elle viser le CLAIM ?
relation pre2006 -> claim contradicts
relation iau2006 -> pre2006 supersedes    # source-contre-source
# iau2006 / pre2006 sont des ITEMS DE PREUVE, chacun avec provenance & date.
# node n'a ni source, ni date, ni autorité. Et "the claim" n'est pas un objet.
# un fait contesté = PLUSIEURS sources + leur désaccord comme donnée de premier ordre.
```

**Casse — au cœur du différenciateur :**
- **Items de preuve non first-class** *(NEW P)* : un fait contesté a besoin de *plusieurs* sources, chacune avec provenance/date/autorité, et de relations *entre preuves* (`contradicts`, `supersedes`). Ici les sources sont des `node` sans provenance, et « the claim » n'est même pas adressable.
- **On ne peut ni viser le `claim` par une relation, ni attacher N sources à un claim.** La proposition v0.3 `node x source [[…]]` n'attache qu'*une* source ; le désaccord source-contre-source est hors de portée.
- **Le désaccord lui-même comme donnée** est précisément ce que le Truth Lens doit inspecter, et il n'a aucune grammaire. *(récurrence E, poussée au maximum : c'est LA raison d'être d'atomik, et c'est le moins outillé.)*

---

## 18. Récursion — *l'arbre d'appels de Fibonacci*

Archétype visé : structure auto-similaire, motif qui se répète.

```atomik
scene fib_recursion
claim "fib(n) computes by summing two smaller recursive calls."
subject [[Recursion]]

node f4 "fib(4)"
node f3 "fib(3)"
node f2a "fib(2)"
node f2b "fib(2)"
node f1a "fib(1)"
node f1b "fib(1)"
node f1c "fib(1)"
node f0a "fib(0)"
node f0b "fib(0)"
# …j'énumère à la main un arbre à croissance exponentielle.
relation f4 -> f3 calls
relation f4 -> f2a calls
relation f3 -> f2b calls
relation f3 -> f1a calls
# …et ainsi de suite, indéfiniment.
# aucun moyen de dire "fib(n) se déploie en une copie de lui-même pour n-1 et n-2".
```

**Casse.**
- **Répétition paramétrique / expansion récursive absente** *(NEW Q)* : impossible de dire « ce nœud se déploie en une copie du motif ». Pour enseigner récursion, diviser-pour-régner, fractales, arbres génératifs — énumérer chaque nœud à la main est ingérable et illisible. Un `for`/`repeat`/`expand` (borné, sans JS arbitraire) manque.
- **Tension de design réelle** : cela frôle la programmabilité, que l'invariant « no arbitrary JavaScript » restreint volontairement. Jusqu'où va la génération déclarative sans devenir un langage de programmation ?

---

## 19. Anatomie du thorax / carte de métro — *savoir intrinsèquement spatial*

Archétype visé : la position relative (au-dessus, à gauche, adjacent) *est* le contenu.

```atomik
scene thorax_anatomy
claim "In the thorax, the heart sits between the lungs, above the diaphragm."
subject [[Thorax]]

node heart "Heart"
node left_lung "Left lung"
node right_lung "Right lung"
node diaphragm "Diaphragm"

relation heart -> diaphragm above       # relation spatiale comme CONTENU
relation left_lung -> heart left-of
relation right_lung -> heart right-of
# "above / left-of / below / adjacent" SONT le savoir ici, pas de la décoration.
# mais l'invariant dit que l'auteur n'écrit jamais de position — le moteur décide.
# comment porter des contraintes topologiques/spatiales sans devenir un outil de dessin ?
```

**Casse.**
- **Contraintes spatiales/topologiques relatives absentes** *(NEW R)* : anatomie, carte de métro, tectonique — la position relative (au-dessus, à gauche, adjacent, entouré-par) *est* le contenu. Rien ne l'exprime.
- **Tension avec l'invariant « l'auteur n'écrit jamais de coordonnées »** : juste pour les schémas conceptuels, faux pour le savoir spatial. Il faut soit un système de *contraintes* relatives (à la Penrose : `above(heart, diaphragm)`), soit accepter que le spatial-réel est hors périmètre. Décision de design, pas un simple ajout de commande.

---

## 20. Répartition d'un budget — *données catégorielles (bar/pie)*, distinct du tracé de fonctions

Archétype visé : bar/pie de N catégories avec valeurs — un trou quantitatif *différent* de §2/§5.

```atomik
scene budget_pie
claim "Most of the budget goes to salaries and infrastructure."
subject [[Annual budget]]

# je veux un pie/bar de 5 catégories avec valeurs.
mark meter "Salaries" value 45 max 100     # une valeur à la fois
mark meter "Infrastructure" value 25 max 100
mark meter "Marketing" value 15 max 100
mark meter "R&D" value 10 max 100
mark meter "Other" value 5 max 100
# cinq marks écrits à la main. Aucun dataset. Aucun archétype pie/bar.
# si les données venaient d'une table/fichier, aucun moyen de les lier.
```

**Casse.**
- **Série de données catégorielles absente** *(NEW, scinde D → D2)* : un bar/pie de N catégories = N `mark` à la main. Aucun `data`/`series`/`dataset`, aucun archétype `bar`/`pie`. Distinct du trou §2/§5 (courbes de fonctions, **D1**) : ici ce sont des *données catégorielles* — un manque différent, **D2**.
- **Pas de liaison à une source de données** : si les valeurs venaient d'une note/table/fichier (cœur du modèle file-first !), rien ne les lie. Une scène de données devrait pouvoir *référencer* des données comme un nœud référence un claim.

---

# Synthèse — les ruptures se regroupent en TROIS FAMILLES

Après 20 exemples, la liste plate devient un motif. Les nouveaux manques K–R (+ D2, + projection concentrique) et les récidives A/C/E/F/G se rangent en trois familles cohérentes — bien plus utile pour l'initialisation qu'une liste.

## Famille 1 — Expressivité **structurelle** (le modèle est trop maigre)

Le vocabulaire node/relation/tone ne porte pas les distinctions structurelles des schémas réels.

- **K — Multiplicité/cardinalité** sur les relations (1-à-N, N-à-N) : absente. *(§11)*
- **L — Rôle/forme du nœud** (décision, départ, traitement, terminal) : seul `tone` (humeur de couleur) existe, pas le rôle sémantique. *(§12)*
- **O — Polarité/signe et poids** des arêtes (+/−, force), et typage de boucle (R/B) : absents. *(§16)*
- **G (récidive) — Attributs/labels de relation** en général : non spécifiés. *(§12, §15, §16)*
- **C (récidive) — Conteneur/groupe** : aucune primitive pour border un ensemble. *(§11, §14)*
- **R — Contraintes spatiales/topologiques relatives** (above/left-of/adjacent) : absentes, et en *tension* avec l'invariant no-coordonnées. *(§19)*
- **Jeu de projections** à compléter : `tree`, `nested-boxes`, `concentric`, `flow`, `cycle`, `timeline`, `axis`, `matrix`… tous nécessaires, aucun défini *(A, récidive massive)*.

## Famille 2 — Expressivité **temporelle / dynamique** (décrire le changement)

atomik décrit un arrangement statique unique ; il peine à décrire le changement.

- **M — Cadre/panneau/snapshot + identité inter-états** : montrer le même système avant/après force la duplication et perd l'identité. *(§13)*
- **F (récidive) — Élément actif piloté par le state** : impossible de surligner/activer un nœud selon le state (pas-à-pas, automate, animation). *(§13, et §4 du lot 01)*
- **Q — Répétition paramétrique / expansion récursive** : impossible ; on énumère à la main. Tension avec no-JS. *(§18)*

## Famille 3 — Expressivité **épistémique** (le différenciateur, le moins bâti)

Ce qui rend atomik non substituable reste de la prose dans le doc de design.

- **P — Items de preuve non first-class** : impossible d'attacher N sources à un claim, de relier preuve-à-preuve (`contradicts`, `supersedes`), ou de viser le claim par une relation. *(§17)*
- **N — Structure de preuve/argument** : hypothèse, warrant sur la transition, contradiction/QED — sans représentation. *(§15, et §3 du lot 01)*
- **E (récidive) — Statut épistémique sans grammaire** : `claim` ne porte pas de statut ; nœuds et arêtes n'ont pas de tonalité épistémique (fait vs analogie vs interprétation). *(§15, §17, et §3/§10 du lot 01)*

## Trou quantitatif, maintenant scindé en deux

- **D1 — Tracé de fonctions** (courbes, tangentes, intersections) : absent. *(lot 01 §2, §5)*
- **D2 — Séries de données catégorielles** (bar/pie) + liaison à une source de données : absent. *(§20)*

---

# Deux lectures de niveau design (après 20 exemples)

**1. Le langage est fort au « milieu » et faible aux deux bouts — or les deux bouts sont toute sa raison d'être.** Point fort : un graphe conceptuel statique + un curseur (photosynthèse, offre/demande, cycle). Points faibles : le bout *riche-structurel* (Famille 1) ET le bout *épistémique* (Famille 3). Mais c'est précisément la structure qui rendrait atomik *universel* et l'épistémique qui le rendrait *non substituable*. Mermaid et D2 possèdent déjà le milieu. **La raison d'exister d'atomik vit aux deux bouts qu'il sous-sert aujourd'hui.**

**2. Deux invariants sont justes au cœur mais faux aux bords, et il faut une *posture* explicite, pas une règle absolue.** « No arbitrary JavaScript » (buté par Q, récursion) et « l'auteur n'écrit jamais de coordonnées » (buté par R, spatial) sont sains pour le schéma conceptuel, mais bloquants pour le savoir récursif et spatial. La voie de sortie existe et a un précédent : Penrose sépare *Substance* (contenu, sans géométrie) et résout la disposition par *contraintes* (`above`, `disjoint`, `contains`) via optimisation. Adopter des **contraintes relatives déclaratives** répond à R sans coordonnées et à Q sans JS — et reste dans l'esprit « l'auteur décrit l'intention, le moteur résout la géométrie » validé au lot 01.

---

# État de l'inventaire après 20 exemples

**Archétypes couverts** : processus/flux linéaire, cycle, arbre d'argument, machine à états, quantitatif-explorable, matrice de comparaison, chronologie, spectre/axe 1D, analogie/mapping, containment profond, décision/branches, avant/après, concentrique, preuve linéaire, réseau causal signé, fait contesté multi-sources, récursion, spatial relatif, données catégorielles.

**Familles de ruptures** : Structurelle (K, L, O, G, C, R, jeu de projections) · Temporelle/dynamique (M, F, Q) · Épistémique (P, N, E) · Quantitatif scindé (D1, D2).

**Zone saine confirmée** : `state`/`derive`/`rule` sur valeurs discrètes (feedback, notes conditionnelles).

---

# Prochains exemples (lot 03, pour approcher 30–50)

Viser ce qui reste non couvert et fermer J :
- **Pile en couches avec encapsulation** (modèle OSI, paquet qui descend/remonte) — teste encapsulation + chemin actif à travers des couches.
- **Chevauchement d'ensembles / Venn** — régions qui se recoupent, distinct du containment (intersection, pas inclusion).
- **Gantt / planning** — barres de durée sur un axe temps : combine B (position par valeur) + durée.
- **Concurrence fork/join** — processus à branches parallèles qui se rejoignent (teste le parallélisme, pas juste la séquence).
- **Notation de domaine** (formule chimique développée, ou mesure musicale) — teste si atomik doit *héberger des sous-notations* à la Penrose (sub-DSLs), ou déléguer.
- **Réseau N-à-N dense** (graphe de dépendances avec cycles) — stress de layout + K (multiplicité) à grande échelle.
- **Un exemple à contenu français accentué** — pour clore **J** (parser Unicode-propre, apostrophes/accents dans les guillemets).
