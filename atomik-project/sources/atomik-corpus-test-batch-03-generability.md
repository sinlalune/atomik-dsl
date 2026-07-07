# Atomik DSL — Sonde de générabilité (lot 03)

## En quoi ce lot diffère des lots 01–02

Les lots 01–02 testaient l'**expressivité** : *que peut dire le langage ?* Moi, gros modèle, encodais **descendant** mon modèle *déjà correct* d'un domaine maîtrisé. C'est l'axe facile — et un angle mort, car le vrai chemin du produit est l'**inverse** : un utilisateur surligne un passage arbitraire (souvent brouillon, partiel, sur un sujet à moitié connu), et un **petit modèle** doit en générer de l'atomik **ascendant**, sans le voir venir.

Ce lot teste donc la **générabilité** : *que va produire, de façon fiable et fidèle, un petit modèle ?* C'est la contrainte que tu as posée comme centrale, et qu'on n'avait pas éprouvée. Nouvelles ruptures nommées **G1–G6** (axe génération), distinctes des A–R (axe expressivité).

**Caveat honnête.** Je suis un gros modèle *simulant* les modes d'échec d'un petit. Les sorties ci-dessous sont des sorties *plausibles* de petit modèle (avec leurs erreurs typiques : sur-confiance, confabulation, hallucination de références, hésitation d'archétype), pas des runs réels. La validation empirique = une **éval** faisant tourner de vrais petits modèles sur des surlignages loggés, scorés contre une grille (stabilité d'archétype, exactitude des références, fidélité épistémique). Voir fin de document.

---

## Passage A — notes brouillonnes, aucun archétype annoncé (décision de carrière)

> *ok donc l'offre de Berlin. plus d'argent évidemment ~20% mais coût de la vie plus élevé donc ça s'annule peut-être. l'équipe a l'air solide, le manager était impressionnant en entretien. MAIS c'est 4 jours sur site et je perdrais le remote qui honnêtement fait la moitié de pourquoi je tiens debout en ce moment. le job actuel est ennuyeux mais stable, et je viens juste de me sentir à l'aise. déménager = tout déraciner, nouvelle langue, aucun réseau là-bas. quoique c'est peut-être exactement le coup de pied qara dont j'ai besoin ? je reviens toujours à : est-ce que j'optimise pour le confort ou pour la croissance. l'argent n'est pas vraiment le sujet.*

Ce passage n'a **pas** d'archétype propre : c'est à la fois une comparaison (Berlin vs actuel), une liste pour/contre, une causale (remote → équilibre mental), une tension de valeurs (confort ↔ croissance) et une méta-question. Un petit modèle **doit choisir** un cadrage. Voici deux sorties plausibles.

### Génération A1 — le modèle choisit « comparaison »

```atomik
scene berlin_decision
claim "Deciding whether to take the Berlin offer."
node berlin "Berlin offer"
node current "Current job"
node money "+20% salary (offset by cost of living)"
node team "Strong team & manager"
node remote "Lose remote (4 days onsite)"
node stability "Stable but boring"
node uproot "New language, no network"
relation berlin -> money has
relation berlin -> team has
relation berlin -> remote has
relation current -> stability has
relation berlin -> uproot has
```

### Génération A2 — le modèle choisit « tension de valeurs »

```atomik
scene berlin_decision
claim "The real question: optimizing for comfort or for growth?"
subject [[Career decision]]
node comfort "Comfort: stability, remote, existing network"
node growth "Growth: challenge, strong team, the push I need"
node money "+20% salary"
node remote "Remote — half my sanity"
node uproot "New language, no network"
project as axis
```

**Ce que la sonde révèle.**
- **Non-déterminisme d'archétype** *(G1)* : le *même* surlignage de 8 lignes produit deux scènes qui ne partagent presque aucune structure (claims différents, nœuds différents, projection différente). Regénérer → diagramme méconnaissable → **diff git bruité**. Ceci entre en **conflit frontal avec la proposition de valeur file-first/versionnée** : un artefact censé être diffable devient instable à la régénération.
- **Frontière/scope indéfinie** *(G5)* : A1 ignore la crux (« confort ou croissance »), A2 en fait le claim central. Où commence/finit la scène à partir d'un surlignage ? Non défini.
- **Aplatissement de la crux** : A1 réduit une tension de valeurs à une liste plate de features, enterrant la dernière ligne (« l'argent n'est pas le sujet ») qui est justement le cœur.
- **Confabulation douce** : A2 pose « the push I need » comme *endossé*, alors que le texte ne fait que le *flotter* (« c'est peut-être exactement… ? »). Le modèle a durci une hésitation en affirmation.
- **Croisement expressivité × génération** : A1 abuse des `node` pour une comparaison *parce que la matrice n'existe pas (rupture I)*. Le trou d'expressivité **force** le générateur vers un encodage bancal, ce qui **compose** l'instability. Pas de polarité pour/contre non plus *(rupture L/O)* : `remote` (contre) et `team` (pour) sont des arêtes `has` indistinctes.

---

## Passage B — sujet pointu à moitié connu, avec liens contestés (transmission monétaire)

> *Quand la banque centrale relève le taux directeur, l'emprunt devient plus coûteux, donc entreprises et ménages réduisent les dépenses financées par le crédit. Des taux plus élevés tendent aussi à renforcer la monnaie, ce qui rend les importations moins chères et peut freiner l'inflation directement. L'effet sur l'investissement est moins net et opère avec des délais longs et variables — certaines estimations situent l'impact maximal à 12–18 mois. Il existe aussi un canal des anticipations que beaucoup d'économistes jugent au moins aussi important que l'effet direct du coût de l'emprunt, bien que son ampleur soit difficile à cerner.*

### Génération B (sortie plausible de petit modèle)

```atomik
scene monetary_transmission
claim "Raising the policy rate reduces inflation through several channels."
subject [[Monetary policy transmission]]
node rate "Policy rate up"
node borrow "Borrowing more expensive"
node spending "Credit-financed spending down"
node currency "Currency strengthens"
node imports "Imports cheaper"
node investment "Investment down"
node expectations "Expectations channel"
node inflation "Inflation down"

relation rate -> borrow causes
relation borrow -> spending causes
relation spending -> inflation causes
relation rate -> currency causes
relation currency -> imports causes
relation imports -> inflation causes
relation rate -> investment causes
relation expectations -> inflation causes
```

**Ce que la sonde révèle.**
- **Aplatissement épistémique** *(G3, G4)* : toutes les arêtes sont `causes`, plates et confiantes. La source disait l'effet sur l'investissement « moins net », avec délais « 12–18 mois » → le modèle a émis un `rate -> investment causes` nu, sans incertitude ni délai. **Le diagramme est plus confiant que le texte.**
- **Perte de contestation et de poids** : le canal des anticipations — « jugé au moins aussi important… ampleur difficile à cerner » — devient *une arête `causes` parmi d'autres, à égalité*. On perd et la contestation et l'importance relative *(ruptures P, E, et pas de poids d'arête — O)*.
- **Risque de confabulation/signe** : un modèle plus faible peut inverser « importations moins chères → freine l'inflation » (erreur de signe), ou fusionner des canaux indépendants. Sur un domaine à moitié connu, le modèle *comble les trous* avec du plausible-mais-faux.
- **Rien ne distingue l'établi du débattu** : le canal coût-de-l'emprunt (solide) et l'ampleur des anticipations (débattue) sont rendus identiques. La scène présente un mécanisme réglé ; la source présentait un mécanisme partiellement contesté. **Menace épistémique centrale.**

---

## Passage C — texte propre, mais piège hypothèse/attribution (formation de la Lune)

> *L'hypothèse dominante est que la Lune s'est formée quand un corps de la taille de Mars a percuté la Terre primitive, éjectant des débris qui se sont agrégés en orbite. Ce modèle de l'« impact géant » explique le petit noyau de fer de la Lune et la similarité isotopique entre la Terre et la Lune. Il est largement accepté, mais certaines caractéristiques — comme la composition isotopique quasi identique — restent difficiles à concilier avec un scénario d'impact unique simple, et des modèles alternatifs ont été proposés.*

### Génération C (sortie plausible de petit modèle)

```atomik
scene moon_formation
claim "The Moon formed from debris after a Mars-sized body hit early Earth."
subject [[Giant-impact hypothesis]]
node impactor "Mars-sized body"
node earth "Early Earth"
node collision "Collision"
node debris "Ejected debris"
node moon "Moon"

relation impactor -> collision then
relation earth -> collision then
relation collision -> debris then
relation debris -> moon then
```

**Ce que la sonde révèle — et c'est le point le plus fort.**
- **Hypothèse → fait** *(G4)* : le claim est posé comme un fait. La source dit « hypothèse dominante », « largement accepté, mais ». Le statut devrait être `hypothesis`/`accepted-but-contested`. **Même si `status` existait (ruptures E), le générateur ne l'a pas rempli** — le modèle *défaut sur l'affirmation*.
- **Preuve de soutien supprimée** : « explique le petit noyau de fer et la similarité isotopique » — ce sont des relations *preuve → hypothèse*, l'ossature épistémique. Disparues *(rupture P + le générateur ne les extrait pas)*.
- **Anomalie supprimée** : « les isotopes quasi identiques restent difficiles à concilier » — une contre-preuve/tension. Disparue.
- **Alternatives supprimées** : « des modèles alternatifs ont été proposés ». Disparu.
- **Conclusion majeure** : sur un texte **propre et bien écrit**, le générateur **dépouille quand même** la structure épistémique — parce que son mode de sortie par défaut est la séquence déclarative. **L'aplatissement épistémique n'est donc PAS un problème de texte brouillon : c'est un problème de défaut de génération.** Résultat : un processus linéaire confiant là où la source donnait une hypothèse hedgée, étayée de preuves, partiellement anomale, avec alternatives.

---

## Ce qui, à l'inverse, FONCTIONNE en génération (équilibrer le constat)

- **La conception ligne-à-ligne aide vraiment la réparation** : chaque ligne générée est vérifiable indépendamment ; un validateur pourrait signaler/réparer *une* ligne fautive sans jeter la scène. Atout réel pour la boucle de réparation (même si la boucle reste non spécifiée).
- **L'extraction mécanique nœuds/relations depuis une prose claire est passable** : la chaîne de C est structurellement à peu près juste ; B a les bons nœuds. **Le risque de génération n'est donc pas dans le *parsing* mais dans le *jugement*.** Narrowing utile.

---

# Synthèse — ruptures de génération G1–G6

**G1 — L'inférence d'archétype est sous-déterminée → sortie non déterministe.** Les passages n'annoncent pas leur archétype ; la spec ne donne aucune procédure d'inférence ; des runs différents (ou répétés) d'un petit modèle choisissent des archétypes différents → scènes radicalement différentes → **diffs bruités** dans un artefact versionné. Démontré par les deux générations A1/A2. Conflit direct avec la valeur file-first.

**G2 — La résolution de références est un trou à risque d'hallucination.** Les `[[wikilinks]]` présupposent un graphe de notes *invisible au moment de la génération*. Le petit modèle émet soit des littéraux (perdant le liage — un argument de vente), soit hallucine des notes inexistantes. Aucun des deux n'est acceptable.

**G3 — L'imposition de structure = confabulation, et c'est la menace épistémique centrale.** Les petits modèles fabriquent une structure plus propre et plus confiante que la source ne le supporte (arêtes inventées, hedges aplatis). Comme la sortie est un diagramme soigné, elle *paraît* faisant autorité — la propre alerte du doc « visual polish must not imply truth », réalisée **au moment de la génération**. Le Truth Lens garde les claims *stockés* ; **rien ne garde l'*acte de génération* de la confabulation.**

**G4 — Le statut épistémique doit être une fente de sortie FORCÉE, pas optionnelle.** Même sur texte propre hedgé (Passage C), le générateur défaut sur l'affirmation et dépouille hypothèse/preuve/anomalie/alternatives. Donc ajouter la syntaxe `status`/`source` (ruptures E, lots 01–02) est **nécessaire mais pas suffisant** : le générateur ne remplit pas les fentes optionnelles. Le pipeline doit *exiger* une annotation épistémique sur chaque claim (défaut p.ex. `status asserted-in-source, unverified`), forçant au minimum à ne pas promouvoir silencieusement hedgé → fait.

**G5 — Le scope/frontière d'une scène depuis un surlignage est indéfini.** Scène surchargée vs fragmentée. Il faut une heuristique de cadrage (un claim par scène ? suivre le paragraphe ? laisser l'utilisateur ajuster la frontière ?).

**G6 — Le risque de génération est concentré dans le *jugement*, pas la *mécanique*.** (Constat d'équilibre.) L'extraction nœuds/relations depuis une prose claire passe ; la syntaxe ligne-à-ligne aide la validation/réparation. Les échecs sont dans le **choix d'archétype**, le **groundage des références** et la **fidélité épistémique** — tous du *jugement*. Cela dit **où investir** : des garde-fous et des étapes de pipeline autour du jugement, pas plus de richesse syntaxique.

---

# Recadrage de niveau design — la cible de convergence se déplace

**Les lots 01–02 demandaient : que peut *dire* le langage. Ce lot montre : que va *produire fidèlement* le générateur. Le DSL ne peut pas être évalué isolément de son pipeline de génération.** Un DSL maximalement expressif servi par un générateur qui confabule est **net-négatif** pour un outil épistémique. Donc il faut **co-concevoir langage + pipeline**, pas figer le langage seul.

**Pipeline minimal impliqué par la sonde** (candidat ADR) :
1. **Cadrage** (scope) — déterminer la frontière de la scène depuis le surlignage. *(répond G5)*
2. **Résolution de références** (retrieval) — grounder les `[[liens]]` candidats contre l'index de notes réel avant génération ; références non résolues marquées explicitement. *(répond G2)*
3. **Génération à fentes épistémiques forcées** — chaque claim/arête sort avec un statut obligatoire ; interdiction de promouvoir hedgé → fait. *(répond G3, G4)*
4. **Validation + réparation** — boucle ligne-à-ligne sur diagnostics du validateur. *(exploite G6, l'atout ligne-à-ligne)*

Ceci reflète exactement la discipline de groundage que vos docs `ai-patch-pipeline` et `verification-grounding-router` appliquent ailleurs : **le chemin de génération du DSL a besoin de la même rigueur.**

**Le levier inattendu : le split modèle/projection stabilise la génération.** Le lot 01 avait validé le split modèle/projection pour l'*expressivité* (même modèle, N projections). La sonde révèle qu'il est *aussi* le levier de **stabilité de génération** face à G1 : si le générateur produit **déterministiquement le modèle de contenu** (nœuds/relations/claims) et que la **projection** (`project as cycle/flow/axis…`) est une *métadonnée que l'utilisateur bascule* — pas un choix du modèle — alors :
- les diffs deviennent stables (le modèle régénéré est déterministe ; l'archétype ne pollue plus le diff),
- l'utilisateur reprend le contrôle de l'archétype (répond G1 sans imposer d'heuristique fragile),
- et l'ambiguïté d'archétype (le pire non-déterminisme) est retirée des mains du petit modèle.

C'est une raison **structurelle** — pas seulement esthétique — de faire de la projection un objet séparé et flippable. Connexion directe entre l'axe expressivité (lot 01) et l'axe génération (ici).

**Opérationnalisation de « couverture pondérée par la générabilité » (tour précédent).** La générabilité a maintenant des modes d'échec concrets (G1–G5) et des correctifs concrets. La convergence n'optimise donc pas la *couverture brute* mais un triplet : **expressivité × déterminisme de génération × fidélité épistémique** — les deux derniers pesant potentiellement *plus* que le premier, car un outil épistémique qui confabule est pire qu'un outil moins expressif mais fidèle.

---

# Étape empirique recommandée (pour sortir de la simulation)

Cette sonde est un gros modèle *simulant* un petit. Le test réel, dans l'esprit de vos investigation records :

- Constituer un petit corpus de **surlignages réels loggés** (10–30), variés en propreté et en domaine.
- Faire générer l'atomik par **plusieurs vrais petits modèles**, chacun **plusieurs fois** (pour mesurer G1, le non-déterminisme).
- Scorer contre une **grille** : (a) *stabilité d'archétype* entre runs, (b) *exactitude des références* (liens résolus vs hallucinés vs littéraux), (c) *fidélité épistémique* (le statut/hedge de la source est-il préservé ?), (d) *confabulation* (arêtes non supportées par le texte), (e) *réparabilité* (une passe de validateur suffit-elle à rendre la scène valide ?).
- Comparer deux régimes : **archétype choisi par le modèle** vs **modèle déterministe + projection choisie par l'utilisateur** (pour tester empiriquement le levier ci-dessus).

C'est ce qui transformerait G1–G6 de constats simulés en chiffres — et qui dirait, avant de figer la v0.3, quel noyau minimal maximise le triplet expressivité × déterminisme × fidélité.
