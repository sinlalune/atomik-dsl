# Atomik DSL — Test de corpus, lot 01

## But de ce document

Éprouver les **dix commandes actuelles** (`scene claim subject state derive node relation mark rule layout`, spec `atomik_dsl_reserved_spec_v0_2`) en encodant à la main dix explications réelles, choisies pour heurter des structures cognitives *différentes*. Ce n'est pas une démonstration : c'est un test de rupture. Chaque exemple montre la source « telle qu'un auteur l'écrirait » puis, en prose, **ce qui tient** et **ce qui casse**.

Convention : mots-clés en anglais (c'est la langue du DSL — l'interlangue). Contenu en anglais pour rester comparable aux exemples de la spec. Les `# ...` dans les blocs signalent un mur d'expressivité — noter au passage que **la syntaxe de commentaire elle-même n'est pas définie dans la spec** (première micro-trouvaille).

Méthode inspirée de tes investigation records : brutal, pas cher, et bien plus informatif qu'une spec a priori.

---

## 1. Photosynthèse — *processus + réactif* (référence)

Archétype visé : flux d'entrées convergentes → sorties, avec un curseur.

```atomik
scene photosynthesis
claim "Plants convert light, water, and CO2 into glucose and oxygen."
subject [[Photosynthesis]]

node light "Sunlight" tone accent
node water [[Water]]
node co2 [[Carbon dioxide]]
node chloro [[Chloroplast]] tone neutral
node glucose [[Glucose]] tone success
node oxygen [[Oxygen]] tone success

relation light -> chloro provides
relation water -> chloro enters
relation co2 -> chloro enters
relation chloro -> glucose produces
relation chloro -> oxygen releases

state intensity = slider 0..100 default 60 label "Light intensity %"
derive output = intensity * 0.9
mark meter "Glucose output" value output max 100
rule intensity < 15 => note "Too dark for net photosynthesis."
layout flow left-to-right
```

**Tient.** Le tronc modèle (`node`/`relation`) + la couche réactive (`state`/`derive`/`mark`/`rule`) exprime proprement l'essentiel. C'est la meilleure zone du langage.

**Casse.**
- `layout flow left-to-right` : `flow` est inventé. La spec ne montre que `layout chart`. **Vocabulaire d'archétypes de layout non défini.**
- Trois entrées convergent, deux sorties divergent : aucun moyen de dire au moteur « ceci est un groupe d'entrées, cela un groupe de sorties ». **Pas de primitive de regroupement.** Le rendu sera lisible ou non selon le seul moteur.
- `derive output = intensity * 0.9` : coefficient arbitraire sans signification. La couche réactive invite à la fausse précision (mineur).

---

## 2. La dérivée — *quantitatif explorable* (l'exemple phare de la spec)

Archétype visé : courbe + tangente pilotées par un curseur. C'est *l'exemple vitrine* de la spec.

```atomik
scene derivative
claim "A derivative measures the local rate of change of a function."
subject [[Derivative]]

state x = slider -5..5 default 1 label "x"
derive fx = x * x
derive slope = 2 * x

layout chart x -5..5 y 0..25
mark point "Point" at x fx        # ??? "point" est-il un mark ? "at" existe-t-il ?
mark line "Tangent" through x fx slope slope   # ??? on invente une géométrie
rule slope > 0 => note "The function is increasing here."
rule slope < 0 => note "The function is decreasing here."
```

**Casse — et c'est grave.**
- **Impossible de tracer la courbe f(x)=x².** `derive fx = x*x` calcule *une* valeur au x courant, pas la courbe sur tout le domaine. Il n'existe aucun `plot`/`curve`. Le `layout chart` pose des axes… et rien ne dessine la parabole.
- `mark point at x fx` et `mark line through x fx slope slope` : j'invente un sous-langage géométrique entier (points, droites, pentes, ordonnées à l'origine) pour dessiner une tangente. **C'est exactement le « mini-Desmos » redouté**, matérialisé.
- Constat majeur : **l'exemple phare de la spec est le moins exprimable avec les dix commandes.** Le langage est vendu sur son cas le plus faible.

---

## 3. Argument philosophique — *arbre d'inférence + conclusion contestée* (le trolley)

Archétype visé : prémisses → conclusion, avec objection. Domaine où la couche épistémique (le différenciateur) doit briller.

```atomik
scene trolley_argument
claim "One ought to divert the trolley to save five at the cost of one." tone disputed
# ??? "claim" accepte-t-il un tone ? La spec le montre en texte nu.

node p1 "Five deaths are worse than one death."
node p2 "One ought to bring about the less bad outcome."
node c  "One ought to divert the trolley."
node obj "Using a person merely as a means violates their dignity." tone caution

relation p1 -> c supports
relation p2 -> c supports
relation obj -> c objects
# p1 ET p2 entraînent CONJOINTEMENT c — ici lu comme deux soutiens indépendants.
# obj attaque l'INFÉRENCE, pas l'objet-conclusion.
```

**Casse — dans le domaine qui devrait être le point fort.**
- **`claim` n'a aucun emplacement pour le statut épistémique.** Le doc *dit* qu'une scène expose la dispute ; la *grammaire* ne le permet pas. Le « disputed » vit en prose dans le doc de design, sans syntaxe.
- **Pas de primitive d'inférence** : impossible d'exprimer « p1 ∧ p2 ⊢ c » comme une unité. Deux `supports` indépendants ≠ une conjonction qui entraîne.
- **Impossible d'attacher une relation à une relation** : l'objection vise l'inférence ou une prémisse, mais `relation` ne relie que des `node`. Les cartes d'argument (objection-à-une-inférence) sont inatteignables.
- **`node` n'a pas d'emplacement d'attribution** au-delà du `[[wikilink]]` : pas moyen de dire « ceci est le cadrage de Foot, cela l'objection de Thomson ». La provenance promise par le doc n'a pas de foyer.

---

## 4. Feu tricolore — *machine à états*

Archétype visé : états + transitions déclenchées. Le diagramme CS le plus courant.

```atomik
scene traffic_light
claim "A traffic light cycles through fixed states on timers."
subject [[Traffic light]]

node green  "Green"
node yellow "Yellow"
node red    "Red"

relation green  -> yellow after "30s"   # ??? une relation peut-elle porter un attribut ?
relation yellow -> red    after "5s"
relation red    -> green  after "45s"

state current = ???   # l'état COURANT est un des NODES, pas un scalaire
```

**Casse.**
- **Collision de noms sur `state`.** Les « états » de l'automate (green/yellow/red) sont des `node`, alors que la commande `state` désigne une variable-apprenant. Le mot le plus naturel du domaine est pris par autre chose. Piège pour les auteurs *et* pour les petits modèles.
- **Aucun moyen de lier une variable runtime à « quel nœud/arête est actif ».** `state` est défini pour scalaires/sliders, pas pour une référence de nœud. Or « l'élément actif » est nécessaire pour *toute* diagramme animé ou pas-à-pas (automates, étapes d'algo, walkthrough de processus).
- **Attributs de relation non définis** : `after "30s"` — `after` est-il un type, `"30s"` un argument ? Garde, label, poids : rien de spécifié.

---

## 5. Offre et demande — *deux courbes + équilibre* (économie)

Archétype visé : deux droites qui se croisent, point d'équilibre, feedback pénurie/surplus.

```atomik
scene supply_demand
claim "Price settles where supply meets demand."
subject [[Market equilibrium]]

state price = slider 0..100 default 50 label "Price"
derive qty_demanded = 100 - price
derive qty_supplied = price

layout chart price 0..100 y 0..100   # price sur x — mais la convention éco met price en y
# encore : rien ne dessine les deux droites sur le domaine
# l'équilibre = intersection = un fait géométrique dérivé — inexprimable
rule qty_demanded > qty_supplied => note "Shortage: price will rise."
rule qty_supplied > qty_demanded => note "Surplus: price will fall."
```

**Tient.** Les `rule` de feedback (pénurie/surplus) sont élégants et exacts. Confirme que `state`/`derive`/`rule` est la couche la plus mûre.

**Casse.**
- Même trou qu'au §2 : deux fonctions de `price`, **aucun tracé de droite**. Confirme que le plotting de fonctions est un trou *systématique*, pas un accident.
- **Pas de point d'intérêt dérivé** (intersection, maximum) : l'équilibre est l'intersection, un calcul géométrique que `derive` ne fait pas.
- **Affectation des axes rigide** : `layout chart price ... y ...` force price en x ; impossible de choisir quel variable va sur quel axe.

---

## 6. Chronologie de l'informatique — *frise temporelle* (histoire)

Archétype visé : événements datés le long d'un axe temporel.

```atomik
scene computing_timeline
claim "General-purpose computing emerged in stages across the 20th century."

node eniac      "ENIAC"
node transistor "Transistor"
node ic         "Integrated circuit"
node micro      "Microprocessor"
node web        "World Wide Web"

relation eniac      -> transistor then   # on simule la chronologie par des arêtes "then"
relation transistor -> ic         then
relation ic         -> micro      then
relation micro      -> web        then

layout timeline   # ??? existe ?
# et les DATES (1945, 1947, 1958, 1971, 1989) ? un node n'a ni date ni position.
# les 44 ans ENIAC→web sont inégaux : impossible d'espacer proportionnellement.
```

**Casse.**
- **Aucune primitive temporelle.** Ni `event`, ni `when`, ni champ date. On falsifie avec `node` + `relation then`, en perdant les dates réelles et tout espacement proportionnel.
- La chronologie est l'une des structures d'apprentissage les plus fréquentes (histoire, biologie, géologie, gestion de projet) et elle a **zéro support de premier ordre**.
- C'est au fond le même manque que « positionner un nœud à une valeur sur un axe » (voir §9).

---

## 7. TCP vs UDP — *matrice de comparaison* (informatique)

Archétype visé : tableau à colonnes (protocole × attribut).

```atomik
scene tcp_vs_udp
claim "TCP and UDP trade reliability against speed."
subject [[Transport protocol]]

node tcp "TCP"
node udp "UDP"
# attributs : connection, ordering, reliability, speed, use case
# un tableau = des cellules indexées par (attribut, protocole).
# ni node ni relation ne colle. Aucun row / column / cell / matrix.
layout matrix ???
```

**Casse — et c'est énorme.**
- Une matrice est fondamentalement des **cellules indexées en 2D**, pas un graphe nœud/arête. Aucun `row`/`column`/`cell`, aucun archétype `table`/`matrix`.
- « Comparer et contraster » est sans doute **la structure pédagogique la plus fréquente de toutes**, toutes disciplines confondues. Elle n'a aucune représentation. On abuserait des nœuds-comme-cellules en perdant la sémantique de grille.

---

## 8. Cycle de l'eau — *cycle* (test de la projection)

Archétype visé : boucle fermée disposée en anneau.

```atomik
scene water_cycle
claim "Water continuously cycles between land, sea, and atmosphere."
subject [[Water cycle]]

node evaporation   "Evaporation"
node condensation  "Condensation"
node precipitation "Precipitation"
node collection    "Collection"

relation evaporation   -> condensation  then
relation condensation  -> precipitation then
relation precipitation -> collection    then
relation collection    -> evaporation   then

layout cycle   # ??? défini ? et comment le moteur SAIT-il de fermer l'anneau radialement ?
```

**Tient — presque, et c'est instructif.** Si `layout cycle` était un archétype défini, le split modèle+projection fonctionnerait *magnifiquement* : même vocabulaire nœud/relation, une projection dédiée. Cet exemple **valide la recommandation** d'un jeu d'archétypes curé.

**Casse.** Les quatre relations forment une boucle, mais rien ne dit au moteur « dispose en anneau ». Sans un `layout cycle` défini, un layout de graphe générique produira une ligne ou une bouillie. **Confirme que l'archétype de projection (cycle vs flux vs arbre) est le concept manquant crucial**, et que `layout` est son seul foyer — non défini. C'est mon « 70 % du problème, c'est le layout », rendu concret.

---

## 9. Échelle de pH — *spectre / axe 1D* (science)

Archétype visé : objets positionnés sur un axe 0–14 par leur valeur.

```atomik
scene ph_scale
claim "pH measures acidity on a logarithmic scale from 0 to 14."
subject [[pH]]

node lemon "Lemon juice"
node water "Pure water"
node blood "Blood"
node bleach "Bleach"
# chacun siège à une POSITION : lemon ~2, blood ~7.4, water 7, bleach ~13
# mais node n'a aucun champ de position/valeur.
layout axis 0..14 label "pH"   # ??? "axis" existe ? échelle log possible ?
```

**Casse.**
- **Placer un nœud à une valeur sur un axe est impossible** : `node` n'a pas de fente numérique de position. Ce manque sous-tend *à la fois* les frises (position par date, §6) et les spectres (position par valeur). **Une seule primitive corrigerait les deux** — p.ex. `place blood at 7.4` ou un slot `node blood [[Blood]] at 7.4`.
- `layout axis` : vocabulaire non défini (récurrent).
- Le pH est logarithmique : aucun contrôle du type d'échelle (mineur mais réel en science).

---

## 10. « L'électricité comme l'eau » — *analogie / mapping* (le cas épistémique modèle)

Archétype visé : deux structures parallèles + arêtes de correspondance. Le doc liste explicitement « model-generated analogy » comme catégorie à distinguer.

```atomik
scene electricity_water_analogy
claim "Electric circuits behave analogously to water flowing in pipes." tone analogy

# structure A — eau
node pump   "Pump"
node flow   "Water flow"
node narrow "Narrow section"
relation pump   -> flow drives
relation narrow -> flow restricts

# structure B — électricité
node battery  "Battery"
node current  "Current"
node resistor "Resistor"
relation battery  -> current drives
relation resistor -> current restricts

# l'ANALOGIE : correspondances ENTRE les deux structures
relation pump   ~ battery  maps-to
relation flow   ~ current  maps-to
relation narrow ~ resistor maps-to
# comment garder les deux structures visuellement séparées (deux groupes) ?
# comment marquer toute la scène comme analogie, pas identité littérale ?
```

**Casse.**
- **Aucune primitive de regroupement/conteneur** pour borner les deux sous-graphes en deux clusters (D2 a `{}`, Mermaid a `subgraph` ; atomik n'a rien). Besoin constant : entrées/sorties, avant/après, les deux côtés d'une analogie, couloirs (swimlanes).
- **Les arêtes n'ont pas de tonalité épistémique** : une arête `produces` (fait causal) et une arête `maps-to` (analogie *assertée par le modèle*) sont toutes deux de simples `relation`. Or le statut épistémique de l'arête est précisément ce qui devrait distinguer fait et analogie.
- **`claim … tone analogy`** : re-butée du §3 — `claim` ne porte pas de statut. La catégorie « analogie générée par le modèle », listée dans le doc, n'a aucune grammaire.

---

# Synthèse — ruptures dédoublonnées, classées par gravité

**A. Le vocabulaire d'archétypes de layout/projection n'est pas défini — et c'est le mur porteur.** *(§1, §6, §8, §9.)* J'ai dû inventer `flow`, `cycle`, `timeline`, `axis`, `matrix` parce que j'en avais besoin ; la spec ne montre que `chart`. Dès qu'on quitte le graphe générique, il faut *nommer la projection*, et aucun ensemble n'existe. **Reco :** définir un jeu **fermé et curé** de projections, chacune avec un vrai moteur de layout. Ce n'est PAS le piège « catalogue de templates » de Mermaid : chez Mermaid chaque type a sa grammaire et le contenu n'est pas portable ; ici le modèle (node/relation/claim) est partagé, l'archétype n'est qu'un choix de rendu — la *même* scène peut se projeter en flux OU cycle OU arbre. Le §8 le prouve.

**B. Pas de primitive « positionner par valeur ».** *(§6 frises, §9 spectres.)* Impossible de placer un nœud à une valeur de donnée sur un axe. Ce trou unique bloque frises (position par date), spectres/échelles (position par valeur), nuages de points, Gantt. **Reco :** une seule primitive (`place <node> at <value>` ou slot positionnel) débloque tout.

**C. Pas de primitive de regroupement/conteneur.** *(§1 entrées/sorties, §10 deux structures, implicite §7.)* Aucun moyen de borner un ensemble de nœuds en cluster/région/couloir. **Reco :** ajouter `group`/`region` avec label et tone optionnel.

**D. Le tracé de fonctions est un trou systématique — et un second moteur déguisé.** *(§2 dérivée, §5 offre/demande.)* `derive` calcule un scalaire au state courant ; rien ne trace une fonction en courbe sur un domaine, ne dessine une tangente, ne calcule intersection/extremum. La vitrine de la spec (dérivée) est l'exemple le moins exprimable. **Reco :** le sortir. Soit (v1) déléguer les vrais charts à une spec externe / les différer ; soit (plus tard) un sous-langage de tracé *explicite et borné* (`plot fx over x`, `mark tangent at x`). Ne pas le laisser fuiter par `derive` + `mark` bricolés.

**E. La couche épistémique n'a aucune syntaxe — c'est le différenciateur, donc c'est le pire trou.** *(§3 claim contesté, §10 analogie, §7.)* Le doc promet que les scènes exposent claim/provenance/incertitude/dispute et distinguent fait vs analogie-modèle vs interprétation. Mais : `claim` n'a pas de fente de statut ; `node` n'a pas d'attribution au-delà d'un wikilink ; `relation` n'a pas de tonalité épistémique. **La seule feature vraiment originale d'atomik est aujourd'hui de la prose dans le doc de design, sans grammaire.** **Reco :** faire du statut épistémique une annotation de premier ordre sur claim, node ET relation — p.ex. `claim "..." status disputed`, `node x [[..]] source [[Foot1967]]`, `relation a ~ b maps-to as analogy`. C'est là qu'atomik devient non substituable ; ça mérite une grammaire, pas seulement un invariant.

**F. Pas d'« élément actif » piloté par le state — bloque tout pas-à-pas/animation.** *(§4.)* Impossible de dire « le nœud X est actif/surligné en fonction du state ». Nécessaire pour automates (état courant), walkthroughs d'algo (étape courante), tout processus animé. La couche réactive calcule (`derive`) et déclenche des notes (`rule`) mais ne pilote pas *l'emphase sur le diagramme lui-même*. **Reco :** laisser `rule` (ou une liaison dédiée) fixer le nœud/arête actif, p.ex. `rule step == 2 => highlight condensation`.

**G. Les relations ne portent pas d'attributs, et ne peuvent viser d'autres relations.** *(§4 gardes/labels, §3 objection-à-inférence.)* Une relation est `a -> b type` ; pas de fente pour garde, label, poids, ni la tonalité épistémique de (E). Et on ne peut attacher une relation à une relation — ce dont les cartes d'argument et les transitions annotées ont besoin. **Reco :** définir des attributs de relation ; se demander si arêtes/inférences peuvent devenir adressables (le point dur — peut-être différer).

**H. Collision de noms : `state`.** *(§4.)* La commande `state` (variable-apprenant) entre en collision avec le domaine machine-à-états, le diagramme CS le plus courant. Auteurs *et* petits modèles trébucheront. **Reco :** envisager de renommer la variable réactive (`input` ? `var` ? `control` ?) pour libérer `state` au sens automate — ou assumer la collision mais la documenter fort. Le nommage pèse énormément pour la génération par modèles bon marché.

**I. Comparaison/matrice non représentable.** *(§7.)* Les tableaux « X vs Y » — plausiblement la structure pédagogique la plus fréquente de toutes — ne mappent ni sur node ni sur relation. **Reco :** soit un archétype `matrix`/`table` avec row/column/cell, soit assumer que les tableaux sont hors périmètre et déléguer (mais ça concède beaucoup d'« universel »).

**J. Divers (mineur mais réel pour un langage « universel »).**
- **Syntaxe de commentaire non spécifiée** (j'ai utilisé `#` partout).
- **i18n du contenu** : tous mes exemples sont en anglais. Les mots-clés restent anglais (bien — c'est l'interlangue), mais le contenu est dans la langue de l'auteur. Confirmer que le parser est Unicode-propre et gère les accents/apostrophes dans les guillemets (cf. la note de la spec sur l'échappement des apostrophes). RTL à considérer un jour.

---

# Deux lectures de niveau design

**1. Le split modèle / projection / rendu est validé.** Les exemples les plus proches de fonctionner (cycle §8, photosynthèse §1) sont exactement ceux où un modèle node/relation partagé n'avait besoin que d'une *projection nommée*. La reco de définir un jeu curé d'archétypes — qui ressemblait superficiellement au piège du « catalogue de templates » — est en fait ce que le corpus **exige**, et le recadrage (modèle partagé, archétype = choix de projection) tient sous le test.

**2. Les dix commandes sur-investissent la couche réactive/quantitative et sous-investissent les deux choses qui comptent le plus pour un DSL d'*apprentissage*.** `state`/`derive`/`rule`/`mark`/`layout chart` occupent la moitié du langage et servent surtout les maths-avec-sliders — une *minorité* du contenu d'apprentissage. Ce qui est mal servi : (a) la **couche épistémique**, qui est le différenciateur, et (b) les **archétypes structurels** (frise, matrice, spectre, groupe), qui sont le gros des explications réelles. Que la *dérivée* soit l'exemple phare révèle ce biais : c'est une vitrine quantitative, mais histoire, philosophie, biologie, comparaison — le pain quotidien — sont les plus mal servis.

---

# Esquisse de re-stratification (hypothèse à re-tester, pas une décision)

- **Cadre :** `scene`, `claim` *(+ status)*, `subject`
- **Modèle :** `node` *(+ source, tone)*, `relation` *(+ kind, attributs, tone épistémique)*, `group`, `place`
- **Projection :** `project as <archetype>` *(clarifie/remplace `layout` ; jeu fermé : flow, cycle, tree, timeline, axis, matrix, chart…)*
- **Réactif (optionnel) :** `input` *(ex-`state`)*, `derive`, `rule` *(+ highlight)*, `mark`
- **Différé/délégué :** vrais charts de fonctions, matrices complexes

---

# Prochains exemples à ajouter (pour compléter les 30–50)

Pour continuer à casser, viser les archétypes non encore couverts et les cas épistémiques durs : partie-tout profond (taxonomie du vivant), flux avec branches/conditions (organigramme décisionnel), avant/après (état d'un système à deux instants), superposition de couches (modèle OSI), preuve mathématique pas-à-pas, réseau causal dense (boucles de rétroaction climatiques), et un cas où **une source contredit une autre** (pour éprouver `status disputed` + provenance sur un fait, pas seulement une opinion).
