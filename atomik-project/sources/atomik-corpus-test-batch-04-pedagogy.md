# Atomik DSL — Sonde pédagogique (lot 04)

## Le troisième axe

Les lots précédents ont couvert deux axes : **expressivité** (que peut *dire* le langage — lots 01–02) et **générabilité** (que *produit* fidèlement le générateur — lot 03). Il reste un angle mort que j'avais nommé : on a échantillonné des *types de diagrammes*, pas des *gestes pédagogiques*. Une explication qui « fait tilt » n'est souvent pas le diagramme final — c'est le *dévoilement progressif*, le « voici le modèle faux qu'on a en tête, corrigeons-le », le fait de partir de ce que l'apprenant croit déjà. Ce sont des structures **rhétoriques et temporelles**, pas des formes visuelles, et une énumération de diagrammes en est structurellement aveugle.

Ce lot teste donc la **chorégraphie** : atomik sait-il exprimer *ce que fait l'explication dans le temps, en relation avec l'esprit de l'apprenant* ? L'entrée n'est ni un passage ni un sujet, mais une **situation** : croyance Y → cible X → geste. Nouvelles ruptures **Ped-1…Ped-5**.

**Caveat.** C'est une analyse de niveau design. La validation réelle passerait par des explications chorégraphiées mesurées sur des *résultats d'apprentissage* (ou au moins une revue pédagogique experte) — hors périmètre d'une spec de langage. Mais le constat catégoriel tient sans éval : le jeu de commandes actuel a **zéro** primitive chorégraphique.

## Carte des gestes testés

Tirés de la littérature du changement conceptuel (Posner, diSessa, Chi), de la théorie de la variation (Marton), du texte de réfutation, et de predict-observe-explain :
1. **Élicitation → confrontation → résolution** (le geste canonique du changement conceptuel)
2. **Réfutation** (énoncer *et nier* explicitement la méprise — plus efficace que juste énoncer le correct)
3. **Dévoilement progressif** (révéler par couches, cacher la complexité jusqu'à maturité)
4. **Analogie puis rupture** (cartographier X ~ familier, *puis montrer où l'analogie casse*)
5. **Contraste / variation** (le concept vit dans ce qui *varie* vs ce qui est *invariant* à travers un jeu d'exemples)
6. **Prédiction d'abord** (poser une question, faire s'engager l'apprenant, *puis* révéler)

---

## P1 — « Les objets lourds tombent plus vite » (élicitation → confrontation → résolution)

Situation : Y = « lourd tombe plus vite » ; X = « en l'absence d'air, tout tombe ensemble ; c'est la résistance de l'air, pas la masse » ; geste = éliciter la croyance, la confronter à un événement discordant (marteau + plume dans le vide), résoudre.

```atomik
scene falling_objects
# je veux TROIS BEATS. atomik n'a ni beat ni reveal. Hack le plus proche :
state phase = slider 1..3 default 1 label "Step"

node belief "Heavy objects fall faster"      # c'est FAUX — mais tone=caution n'est qu'une couleur
node vacuum "Hammer + feather in a vacuum"    # l'événement discordant
node truth  "Both land together"              # la résolution
node reason "Air resistance, not mass, made the difference"

# rule déclenche des NOTES, pas un reveal structurel :
rule phase == 1 => note "You might think heavier falls faster."
rule phase == 2 => note "But watch this vacuum experiment."
rule phase == 3 => note "They land together — mass wasn't the cause."
```

**Inexprimable dans le geste.**
- **Pas de dévoilement structurel ordonné** *(Ped-1)* : je ne peux PAS n'afficher que `belief` au beat 1, *ajouter* `vacuum` au beat 2, *révéler* `truth` au beat 3. `rule` change des notes/valeurs, jamais quelle *structure* est visible. (Distinct de F/M du lot 02 : ici ce n'est pas l'animation d'un état de contenu, mais la *séquence de dévoilement authoriale* de l'explication.)
- **Pas d'objet « croyance antérieure / méprise » marqué FAUX** *(Ped-2)* : `belief` doit être « tenu-mais-faux ». Aucun `status: false/misconception`, seulement une couleur. Et — écho direct de G3 (lot 03) — un diagramme montrant « lourd → tombe plus vite » *sans marquage FAUX* est épistémiquement dangereux : il ressemble à une affirmation.
- `phase = slider` est un leurre : il est *piloté par l'apprenant* (il fait glisser), pas une séquence narrative authoriale — et il ne pilote de toute façon aucun reveal structurel.

---

## P2 — « Après 5 rouges, le noir est “dû” » (réfutation)

Situation : Y = sophisme du joueur ; X = indépendance des tirages ; geste = *réfuter* explicitement en reconnaissant l'intuition.

```atomik
scene gamblers_fallacy
node belief "After 5 reds, black is 'due'"       # intuitif mais FAUX
node pull   "It FEELS like black is overdue"      # l'intuition à reconnaître
node truth  "Each spin is independent: P(black) ≈ 48.6%"
relation truth -> belief refutes                  # 'refutes' inventé ; belief sans statut 'faux'
```

**Inexprimable dans le geste.**
- **Pas de relation de réfutation** *(Ped-3)* : le « cette croyance est fausse PARCE QUE les tirages sont indépendants » — le *parce que* d'une réfutation — n'a pas de type. Les relations d'atomik *affirment* ; aucune ne *réfute*.
- **Pas de marquage « piège intuitif »** : `pull` (« ça *paraît* dû ») est justement ce qu'une bonne réfutation reconnaît. Aucun statut « intuitif-mais-faux ».
- (Récidive Ped-2 : `belief` sans statut « faux ».)

---

## P3 — « Comment un réseau de neurones apprend » (dévoilement progressif)

Situation : pas de méprise — un *unfold* pur. Même diagramme final, révélé en 4 couches : entrée→sortie, puis poids, puis perte, puis rétropropagation.

```atomik
scene nn_learning
node io       "Input -> Output"            # reveal étape 1
node weights  "Weights"                    # reveal étape 2
node loss     "Loss (error)"               # reveal étape 3
node backprop "Backprop adjusts weights"   # reveal étape 4
relation io -> weights uses
relation loss -> backprop drives
relation backprop -> weights adjusts
```

**Inexprimable dans le geste.**
- **Pas d'attribut de reveal-étape** *(Ped-1, cas le plus net)* : je veux `node weights ... reveal 2`. N'existe pas. `state step = slider 1..4` + `rule` ne peut ni cacher ni montrer des nœuds. Le diagramme est **tout-ou-rien**. Toute la pédagogie du feuilletage — révéler la complexité par paliers — est perdue. C'est la démonstration la plus propre qu'atomik n'a **aucune dimension de dévoilement/séquence** (comparable aux « fragments » de reveal.js / overlays Beamer, sans analogue ici).

---

## P4 — Superposition quantique (analogie puis rupture)

Situation : Y = intuition classique ; geste = cartographier « qubit ~ pièce qui tourne » *puis montrer où l'analogie casse*.

```atomik
scene superposition_analogy
claim "A qubit is like a spinning coin — both/neither until it lands." status analogy
node coin  "Spinning coin"
node qubit "Qubit in superposition"
relation coin ~ qubit maps-to

# LA RUPTURE — où l'analogie échoue :
node break1 "Measurement isn't just 'looking'"
node break2 "Entanglement has no coin counterpart"
```

**Inexprimable dans le geste.**
- **Pas de marquage « valide ici / CASSE là »** sur une arête d'analogie *(Ped-3, variante frontière)* : impossible de dire qu'un `maps-to` tient sur tel aspect et rompt sur tel autre.
- **Pas de « cette caractéristique de X n'a AUCUN analogue »** : l'intrication n'a pas de contrepartie-pièce — et c'est *ça* la leçon. Une analogie non bornée **sur-affirme** (thème confabulation du lot 03, mais authorié cette fois). **La frontière de l'analogie EST la pédagogie**, et elle est inexprimable. (Le lot 01 §10 faisait le mapping *statique* ; le geste — « et voici où ça casse » — est une autre chose.)

---

## P5 — « Qu'est-ce qui fait un mammifère ? » (contraste / variation)

Situation : Y = « vit sur terre » ou « a des poils » ; geste = contraste minimal où la *dimension de différence* porte le concept.

```atomik
scene what_is_a_mammal
node bat      "Bat — flies"
node whale    "Whale — swims"
node platypus "Platypus — lays eggs"
node shark    "Shark — swims, NOT a mammal"
# critérial (invariant) : produit du lait / à sang chaud
# incident (varie) : habitat terre/air/eau, ponte (platypus !)
```

**Inexprimable dans le geste.**
- **Pas de marquage critérial vs incident** *(Ped-4)* : impossible de dire que « produit du lait » est *critérial* (définitoire) et « habitat » *incident* (fausse piste). Or c'est le marquage qui enseigne.
- **Pas de séquence de variation** : la théorie de la variation enseigne en *faisant varier l'incident tout en tenant le critérial constant* à travers les exemples — un mouvement chorégraphié — inexprimable (ni séquence, ni criterialité). (S'appuierait sur la matrice manquante — rupture I du lot 02 — plus une couche pédagogique de criterialité par-dessus.)

---

## P6 — « Que devient le volume de la glace en fondant ? » (prédiction d'abord)

Situation : geste = poser une question, faire prédire, *puis* révéler (l'eau est plus dense ; la glace flotte ; le volume diminue).

```atomik
scene ice_melting
state guess = choice "sinks" | "floats" | "no change" label "Predict:"   # 'choice' existe-t-il ? spec ne montre que slider
# LE SEUL GESTE QUI MARCHE EN PARTIE — car il se réduit à entrée-apprenant -> sortie conditionnelle :
rule guess == "sinks"  => note "Actually ice floats — water is densest at 4°C."
rule guess == "floats" => note "Right! And its volume DECREASES on melting."
```

**Ce que ça révèle — l'asymétrie clé.**
- C'est **le seul geste qu'atomik approche**, précisément parce qu'il se *réduit* à « entrée de l'apprenant → réponse conditionnelle » — le cœur de la couche réactive (`state`/`rule`), la zone forte.
- Mais même ici : **pas d'objet « question de prédiction » de premier ordre** *(Ped-5)* ; **pas de porte d'engagement** (rien ne cache la réponse tant que l'apprenant n'a pas commis sa prédiction) ; et la « révélation » reste une *note*, pas un dévoilement structurel.
- Micro-trouvaille : `state guess = choice …` — `state` n'est montré que comme `slider` ; les types énumérés/choix pour prédictions sont non spécifiés.

---

# L'asymétrie centrale

**La couche réactive (`state`/`derive`/`rule`) couvre par accident exactement UN geste — la prédiction d'abord — parce que ce geste se réduit à « entrée de l'apprenant → sortie conditionnelle ». Tous les autres gestes exigent (a) un dévoilement ordonné authorié, (b) un objet croyance-antérieure/méprise marqué FAUX, ou (c) un marquage de criterialité/frontière — dont atomik n'a rien.** Cela reproduit le motif des lots 01–02 (« fort au milieu, faible aux bouts ») sur un troisième axe : fort sur le geste qui ressemble à du réglage de paramètre, faible sur tout geste réellement rhétorique.

---

# Synthèse — la famille chorégraphique / rhétorique

**Ped-1 — Pas d'ordonnancement de dévoilement (beats/reveal).** Une explication est chorégraphiée en temps (éliciter→confronter→résoudre ; couche 1→2→3→4). atomik décrit un état final ; aucune séquence authoriale, et la couche réactive pilote *valeurs/notes*, pas *reveal structurel*. Distinct de F/M (lot 02, animation d'état de contenu) : ici c'est la *séquence pédagogique de dévoilement*. *(P1, P3)*

**Ped-2 — Pas d'objet « croyance antérieure / méprise » avec statut FAUX/tenu-mais-faux.** Le changement conceptuel *exige* de représenter ce que l'apprenant croit à tort, marqué faux, montré pour être corrigé. atomik n'a aucun statut « faux / méprise / intuitif-mais-faux » — et rendre une méprise non marquée est épistémiquement dangereux (écho G3). **C'est le lien le plus aigu au différenciateur : l'outil qui prétend se soucier de la vérité ne peut même pas représenter une *fausseté marquée*, ce dont l'enseignement contre les méprises a précisément besoin.** *(P1, P2)*

**Ped-3 — Pas de relation de réfutation / confrontation / frontière.** Le « faux PARCE QUE… », l'événement discordant qui brise Y, le « voici où l'analogie casse » — des relations *rhétoriques* dont le rôle est de *défaire* quelque chose. Les relations d'atomik affirment ; aucune ne réfute ni ne borne. *(P2, P4)*

**Ped-4 — Pas de marquage criterialité / figure-fond.** Enseigner un concept = marquer les traits *critériaux* (définitoires) vs *incidents* (fausses pistes) et chorégraphier la variation. atomik ne peut pas marquer un attribut comme « celui qui compte ». *(P5)*

**Ped-5 — Pas d'objet question / prédiction / engagement.** Socratique et predict-observe-explain veulent une question posée *avant* révélation et une porte d'engagement. La couche réactive approche la moitié « entrée » mais n'a ni objet question ni porte. *(P6)*

---

# Recadrage de niveau design

**1. Un troisième axe orthogonal existe : chorégraphie/rhétorique.** Expressivité (ce que l'artefact *est*), générabilité (ce que le générateur *produit*), et maintenant pédagogie (ce que l'explication *fait* dans le temps, face à l'esprit de l'apprenant). **atomik est conçu comme un langage d'artefact ; or le but déclaré du produit est l'*apprentissage*, et l'apprentissage est chorégraphique.** Un langage de diagramme-artefact est nécessaire mais pas suffisant pour un outil d'*apprentissage*. Reformulé crûment : **atomik est aujourd'hui un DSL de *visualisation*, mais le produit a besoin d'un DSL de *pédagogie* — et ce ne sont pas la même chose.** Tu l'avais dit d'emblée — « DSL de visualisation universelle *par rapport à l'apprentissage* » — et c'est la partie *apprentissage* qui a été sous-servie par le cadrage « visualisation ».

**2. Le cas de la méprise est le point de convergence des TROIS axes — donc la meilleure étoile polaire.** Pour enseigner contre une méprise, il faut (a) représenter une *fausseté marquée* [épistémique, Ped-2], (b) la générer sans que le générateur ne l'aplatisse en « juste la bonne réponse » ni en « affirmation fausse non marquée » [générabilité, G3/G4], et (c) chorégraphier éliciter→confronter→résoudre [rhétorique, Ped-1/3]. **Les problèmes les plus durs des trois axes s'intersectent ici.** Donc le cas changement-conceptuel/méprise est le **meilleur test d'acceptation unique** de tout le design : si langage+pipeline savent faire *ça*, ils savent presque tout ; sinon, c'est un outil de diagramme, pas d'apprentissage.

**3. La couche réactive est le *germe* d'une couche de chorégraphie — mal pointée.** `state`/`derive`/`rule` est « la zone forte », et couvre par accident la prédiction d'abord. Cela suggère de ne pas ajouter un mécanisme séparé mais d'*étendre* la couche réactive pour piloter (a) le reveal structurel (montrer/cacher des sous-graphes par étape), (b) le séquencement de beats (un `step` *authorié* et ordonné, pas un simple slider apprenant), et (c) les portes de prédiction. On réutilise le validé au lieu d'empiler.

**4. Tension de design (encore, plus nette) : séquence authoriale vs no-programmabilité.** Une chorégraphie (`step 1 reveal X ; step 2 reveal Y ; on wrong-guess show Z`) commence à ressembler à un mini-langage de script/automate. Même tension que Q (récursion) et R (spatial) du lot 02 : là où le déclaratif rencontre l'invariant no-JS. La réponse est probablement de même forme : un vocabulaire de chorégraphie *borné et déclaratif* (jeu fixe de beat/reveal/gate), pas du script arbitraire — comme la couche réactive est bornée (slider/derive/rule) et non du JS libre. Mais il faut le *décider*, pas le laisser implicite.

**5. Boucle bouclée avec le tout premier tour.** J'avais posé que les primitives devraient être des *structures cognitives d'explication*, pas des formes ni des types de diagrammes. Les lots 01–02 ont testé la moitié *structurelle* (cycle, hiérarchie…). Cette sonde révèle la moitié *chorégraphique* que j'avais effleurée sans l'isoler : **expliquer, ce n'est pas juste de la structure, c'est de la structure déployée dans le temps contre une croyance antérieure.** La sonde pédagogique complète la thèse initiale.

---

# La convergence, maintenant à trois axes

La cible n'est plus « couverture d'archétypes » ni même le couple du lot 03. C'est un **triplet** : *expressivité structurelle* × *générabilité fidèle* × *pédagogie chorégraphique* — avec une acceptation nord = **le cas de la méprise**, où les trois s'intersectent.

Chemin constructif minimal (à éprouver, pas à graver) :
- Reconnaître la chorégraphie comme axe de premier ordre.
- **Étendre** (pas empiler sur) la couche réactive en un vocabulaire de chorégraphie borné : beats/étapes authoriés, reveal structurel par étape, portes de prédiction.
- Ajouter un statut `misconception`/`false-held` — qui sert **deux axes d'un coup** (épistémique + pédagogique).
- Ajouter des types de relation de réfutation/frontière (`refutes`, `breaks-here`) et un marquage critérial/incident.
- Utiliser le cas de la méprise comme test d'acceptation de tout le langage+pipeline.

**Étape empirique** (pour sortir de l'analyse) : au-delà de l'éval de générabilité du lot 03, une évaluation *pédagogique* — faire chorégraphier quelques explications-contre-méprise et les soumettre à une revue experte (ou, ambitieusement, à une mesure de résultats d'apprentissage) — dirait si le vocabulaire chorégraphique borné suffit avant de figer la v0.3.
