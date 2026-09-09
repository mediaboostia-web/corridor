# PRD — Corridor Sourcing

---

## 1. Vision produit

**Pitch en une phrase**
Corridor Sourcing permet aux commerçants d'Afrique centrale de s'approvisionner au prix de gros à Cotonou grâce à des agents vérifiés sur le terrain, sans se déplacer.

**Problème résolu**
Aujourd'hui, un commerçant au Gabon qui voit un produit attractif sur TikTok chez un grossiste de Cotonou n'a aucun moyen fiable de l'acheter. Il doit trouver une connaissance sur place, lui envoyer de l'argent via Western Union (9% de frais), espérer que la personne se déplace chez le bon grossiste, attendre un appel vidéo instable d'une heure pour valider les produits, puis croiser les doigts pour que le colis arrive. Aucune traçabilité, aucune garantie, aucune récurrence possible. Le processus informel fonctionne — mais il est lent, stressant, coûteux et ne scale pas.

**Pourquoi maintenant**
- L'AfCFTA (Zone de libre-échange continentale africaine) accélère les corridors commerciaux intra-africains. Le cadre réglementaire devient favorable.
- Les grossistes béninois investissent massivement TikTok et Facebook pour montrer leurs produits — ils créent la demande mais n'ont aucun outil pour convertir les acheteurs distants.
- Le mobile money (Wave, Moov Money, Airtel Money) atteint une masse critique qui rend les transferts intra-africains moins chers que Western Union.
- Aucun acteur digitalisé ne cible spécifiquement le corridor Bénin → CEMAC/Togo. Godofreda (Nigeria) fait du sourcing Chine → Afrique. Wingi fait du B2B avec IA. TradeBridge est sur le corridor Rwanda-Tanzanie. Le créneau est vide.

**Ce que le produit règle concrètement**

| Douleur réelle | Solution Corridor |
|---|---|
| Le grossiste ne répond pas sur WhatsApp. L'acheteur ne sait pas si le produit est disponible avant que l'agent se déplace. | Catalogue produits tenu par le grossiste avec photos, prix gros et disponibilité en temps réel. L'acheteur sait ce qui existe avant de poster sa demande. |
| L'appel vidéo de vérification dure 1h+ avec des coupures réseau. Stressant pour l'acheteur ET l'agent. | Messagerie intégrée avec partage de photos/vidéos asynchrone. L'agent envoie les preuves visuelles sans dépendre d'un appel en direct. |
| Une fois le colis expédié, c'est "confiance aveugle". Aucun suivi. | Suivi de commande par statuts clairs (reçu → en achat → acheté → expédié → livré) avec notifications à chaque étape. |
| L'acheteur ne connaît aucun agent fiable à Cotonou. Il dépend du bouche-à-oreille. | Feed de demandes ouvertes : l'acheteur poste, les agents vérifiés candidatent. L'acheteur choisit sur la base du profil, des avis et du badge vérifié. |
| Western Union mange ~9% du montant envoyé (5 898 FCFA sur 65 898 FCFA dans le cas documenté). | Corridor ne manipule aucun fonds mais oriente vers des canaux moins chers (Moov Money, Airtel Money) et affiche les frais comparés pour que l'acheteur choisisse en connaissance de cause. |

---

## 2. Personas cibles

### Persona 1 — Jenni, l'acheteuse internationale

| | |
|---|---|
| **Profil** | Femme, 28 ans, commerçante/revendeuse, Libreville (Gabon) |
| **Contexte** | Tient un petit commerce de bijoux et accessoires. Suit des grossistes béninois sur TikTok. Achète régulièrement en gros pour revendre avec marge au Gabon. |
| **Pain points** | Ne connaît personne de confiance à Cotonou. A été arnaquée une fois par un "contact" trouvé sur Facebook. Paie 9% de frais Western Union à chaque envoi. Passe 1h+ en appel vidéo instable pour valider ses produits. N'a aucun suivi une fois le colis expédié. |
| **Solution actuelle** | Cherche un Gabonais vivant à Cotonou via des groupes WhatsApp. Envoie l'argent par Western Union. Attend et espère. |
| **Pouvoir d'achat** | Budget sourcing : 50 000 – 150 000 FCFA par commande, 2-3 fois par mois. Prête à payer 10 000 – 15 000 FCFA de commission agent si le service est fiable. |

### Persona 2 — Karim, l'agent sourcing

| | |
|---|---|
| **Profil** | Homme, 24 ans, étudiant/freelance, Cotonou (Bénin) |
| **Contexte** | Gabonais vivant à Cotonou (comme le fondateur). Connaît bien les marchés Dantokpa et Missèbo. Fait déjà du sourcing informel pour 3-4 personnes de son entourage. Veut en faire une activité régulière. |
| **Pain points** | Pas de flux régulier de clients. Trouve ses clients uniquement par bouche-à-oreille. Pas d'outil pour montrer son sérieux à un inconnu. Doit tout gérer par WhatsApp : photos, vidéos, relances, suivi. |
| **Solution actuelle** | Groupes WhatsApp, appels directs. Tout est manuel, rien n'est tracé. |
| **Pouvoir d'achat** | Gagne 30 000 – 50 000 FCFA/mois en commissions. Prêt à investir 5 000 FCFA/mois si ça lui amène plus de clients. |

### Persona 3 — Maridiath, la grossiste

| | |
|---|---|
| **Profil** | Femme, 35 ans, propriétaire de boutique, marché Missèbo, Cotonou (Bénin) |
| **Contexte** | Vend des bijoux, montres et parfums en gros. A 2 000+ contacts WhatsApp et 15 000 abonnés TikTok. Fait des lives TikTok 2 fois par semaine. Reçoit beaucoup de DM d'acheteurs étrangers mais ne peut pas les servir (pas de logistique export, pas de confiance mutuelle). |
| **Pain points** | Perd des ventes internationales faute de pouvoir servir les acheteurs distants. Ne sait pas qui est sérieux parmi les demandeurs. N'a aucun outil pour gérer les commandes export. Ses lives TikTok génèrent de l'intérêt mais aucune conversion structurée. |
| **Solution actuelle** | Vente en boutique physique uniquement. WhatsApp pour discuter avec des acheteurs potentiels, mais conversion très faible. |
| **Pouvoir d'achat** | Chiffre d'affaires gros : 500 000 – 2 000 000 FCFA/mois. Prête à payer 13 000 FCFA/mois pour un canal de vente export structuré. |

---

## 3. Pages & écrans

### Parcours public (non connecté)

**3.1 — Page d'accueil / Landing page**
- À quoi elle sert : Expliquer ce qu'est Corridor Sourcing, rassurer sur la confiance (agents vérifiés, suivi), et pousser vers l'inscription selon le rôle (acheteur, agent, grossiste).
- Qui y accède : Tout visiteur. Point d'entrée principal depuis les réseaux sociaux, Google, ou le bouche-à-oreille.
- Actions clés : (1) Choisir son rôle et s'inscrire. (2) Parcourir les grossistes/produits disponibles sans compte. (3) Comprendre le fonctionnement en 3 étapes visuelles.

**3.2 — Page boutique grossiste (URL publique)**
- À quoi elle sert : Vitrine publique d'un grossiste, partageable sur TikTok, Facebook, WhatsApp. Montre ses produits, ses avis, et un lien vers son live en cours s'il y en a un.
- Qui y accède : N'importe qui ayant le lien. C'est la page que Maridiath colle dans sa bio TikTok.
- Actions clés : (1) Voir les produits disponibles avec prix de gros. (2) S'inscrire comme acheteur pour passer commande. (3) Voir le profil vérifié du grossiste et ses évaluations.

**3.3 — Page inscription / connexion**
- À quoi elle sert : Créer un compte avec choix de rôle (acheteur, agent sourcing, grossiste) ou se connecter.
- Qui y accède : Tout visiteur souhaitant utiliser la plateforme.
- Actions clés : (1) S'inscrire avec numéro de téléphone + OTP (le standard en zone UEMOA). (2) Choisir son rôle. (3) Se connecter si déjà inscrit.

### Parcours acheteur

**3.4 — Feed des produits / Catalogue**
- À quoi elle sert : Parcourir tous les produits listés par les grossistes partenaires. Filtrer par catégorie, prix, grossiste.
- Qui y accède : Acheteur connecté. C'est sa page d'atterrissage après connexion.
- Actions clés : (1) Rechercher/filtrer des produits. (2) Voir le détail d'un produit (prix gros, quantité minimum, photos). (3) Lancer une demande de sourcing à partir d'un produit.

**3.5 — Page de création de demande de sourcing**
- À quoi elle sert : Poster une demande ouverte pour qu'un agent la prenne en charge. L'acheteur décrit ce qu'il veut, colle un lien TikTok/Facebook s'il a vu le produit en ligne, définit son budget.
- Qui y accède : Acheteur connecté. Accessible aussi bien depuis le catalogue (pré-rempli avec le produit) que depuis un bouton "Nouvelle demande" (demande libre avec lien externe).
- Actions clés : (1) Décrire le produit souhaité (texte + images de référence + lien TikTok/Facebook). (2) Préciser le budget, la quantité et le pays de livraison. (3) Publier la demande dans le feed des agents.

**3.6 — Page "Mes demandes"**
- À quoi elle sert : Voir toutes ses demandes de sourcing en cours, passées et terminées. Suivre les candidatures des agents.
- Qui y accède : Acheteur connecté.
- Actions clés : (1) Voir les agents qui ont candidaté sur une demande. (2) Consulter le profil et les avis d'un agent candidat. (3) Accepter un agent pour lancer la mission.

**3.7 — Page de suivi de commande**
- À quoi elle sert : Suivre la progression d'une commande acceptée, étape par étape.
- Qui y accède : Acheteur connecté, après avoir accepté un agent sur sa demande.
- Actions clés : (1) Voir le statut actuel (reçu → en achat → acheté → emballé → expédié → en transit → livré). (2) Voir les photos/vidéos envoyées par l'agent à chaque étape. (3) Accéder à la messagerie avec l'agent.

**3.8 — Messagerie (conversation)**
- À quoi elle sert : Échanger avec l'agent assigné à sa demande. Partager photos, vidéos, notes vocales pour la vérification produit.
- Qui y accède : Acheteur connecté, dans le contexte d'une demande acceptée. Également accessible par l'agent.
- Actions clés : (1) Envoyer/recevoir des messages texte. (2) Partager des photos et courtes vidéos. (3) Voir l'historique complet de la conversation liée à cette commande.

**3.9 — Profil acheteur**
- À quoi elle sert : Gérer ses informations personnelles, son pays de livraison par défaut, ses préférences de notification.
- Qui y accède : Acheteur connecté.
- Actions clés : (1) Modifier ses coordonnées et adresse de livraison. (2) Voir son historique de commandes. (3) Laisser un avis sur un agent après livraison.

### Parcours agent sourcing

**3.10 — Feed des demandes ouvertes**
- À quoi elle sert : Voir toutes les demandes de sourcing publiées par les acheteurs et disponibles pour candidature.
- Qui y accède : Agent connecté (vérifié ou non — un agent non vérifié voit les demandes mais ne peut pas candidater).
- Actions clés : (1) Parcourir les demandes par catégorie, budget, pays de destination. (2) Voir le détail d'une demande (produit, budget, lien TikTok). (3) Candidater sur une demande avec un message et un tarif de commission.

**3.11 — Page "Mes missions"**
- À quoi elle sert : Gérer les missions acceptées. Mettre à jour le statut de chaque commande.
- Qui y accède : Agent connecté.
- Actions clés : (1) Mettre à jour le statut d'une commande (en achat → acheté → emballé → expédié). (2) Envoyer des photos/vidéos de preuve à chaque étape. (3) Accéder à la messagerie avec l'acheteur.

**3.12 — Profil agent (public)**
- À quoi elle sert : Vitrine de l'agent visible par les acheteurs. Montre son badge vérifié, ses avis, son nombre de missions complétées, sa zone d'action.
- Qui y accède : Tout acheteur qui consulte un candidat sur sa demande. Page publique.
- Actions clés : (1) Voir les évaluations et commentaires des acheteurs précédents. (2) Voir le badge "vérifié" et depuis quand. (3) Contacter l'agent via la plateforme.

**3.13 — Page de demande de vérification agent**
- À quoi elle sert : Soumettre ses pièces d'identité et informations pour obtenir le badge "agent vérifié".
- Qui y accède : Agent connecté, non encore vérifié.
- Actions clés : (1) Uploader une pièce d'identité (CNI, passeport). (2) Renseigner sa localisation et sa zone d'action (marché/quartier). (3) Soumettre sa demande de vérification.

**3.14 — Tableau de bord agent**
- À quoi elle sert : Vue synthétique de l'activité de l'agent : missions en cours, revenus cumulés (indicatif), avis reçus.
- Qui y accède : Agent connecté.
- Actions clés : (1) Voir le nombre de missions actives / terminées / en attente. (2) Consulter ses évaluations récentes. (3) Accéder à l'upgrade Pro.

### Parcours grossiste

**3.15 — Dashboard grossiste**
- À quoi elle sert : Vue d'ensemble de l'activité du grossiste : produits listés, demandes reçues sur ses produits, performance de sa page boutique.
- Qui y accède : Grossiste connecté. C'est sa page d'atterrissage.
- Actions clés : (1) Voir le nombre de vues sur ses produits et sa page boutique. (2) Voir les demandes de sourcing liées à ses produits. (3) Accéder à la gestion de son catalogue.

**3.16 — Gestion du catalogue produits**
- À quoi elle sert : Ajouter, modifier, désactiver ses produits. Gérer la disponibilité et les prix.
- Qui y accède : Grossiste connecté.
- Actions clés : (1) Ajouter un produit (nom, description, photos, prix unitaire gros, quantité minimum, catégorie). (2) Marquer un produit comme indisponible temporairement. (3) Modifier le prix ou les photos.

**3.17 — Page de personnalisation boutique**
- À quoi elle sert : Configurer sa page boutique publique (3.2) — photo de couverture, description, lien vers son live TikTok/Facebook en cours, horaires d'ouverture, contact WhatsApp.
- Qui y accède : Grossiste connecté.
- Actions clés : (1) Modifier le nom, la description et la photo de sa boutique. (2) Ajouter/modifier le lien vers son live en cours (TikTok, Facebook, Zoom). (3) Personnaliser l'URL publique de sa boutique (corridor-sourcing.com/boutique/maridiath-fashion).

**3.18 — Profil grossiste (édition)**
- À quoi elle sert : Gérer ses informations personnelles, son abonnement, ses moyens de paiement pour le renouvellement Pro.
- Qui y accède : Grossiste connecté.
- Actions clés : (1) Modifier ses coordonnées. (2) Voir/gérer son abonnement (gratuit ou Pro). (3) Accéder à la page d'upgrade Pro.

### Parcours transversal

**3.19 — Page abonnement / Upgrade Pro**
- À quoi elle sert : Présenter les avantages du plan Pro (agent ou grossiste) et permettre le paiement.
- Qui y accède : Agent ou grossiste connecté en plan gratuit.
- Actions clés : (1) Comparer les plans gratuit vs Pro. (2) Choisir le moyen de paiement (Moov Money, Airtel Money, Wave, carte). (3) Souscrire à l'abonnement mensuel.

**3.20 — Page notifications**
- À quoi elle sert : Centraliser toutes les notifications : nouvelle candidature agent, mise à jour de statut, nouveau message, demande de sourcing sur un produit.
- Qui y accède : Tout utilisateur connecté.
- Actions clés : (1) Voir la liste chronologique des notifications. (2) Cliquer pour accéder directement à l'élément concerné. (3) Marquer comme lu.

### Parcours admin (back-office)

**3.21 — Dashboard admin**
- À quoi elle sert : Vue d'ensemble de la plateforme pour le fondateur : nombre d'utilisateurs par rôle, demandes actives, revenus abonnements, taux de complétion commandes.
- Qui y accède : Administrateur (Hullys Désiré au lancement).
- Actions clés : (1) Voir les KPIs clés en temps réel. (2) Accéder aux listes utilisateurs par rôle.

**3.22 — Gestion des vérifications agents**
- À quoi elle sert : Examiner les demandes de vérification agent, approuver ou rejeter avec motif.
- Qui y accède : Administrateur.
- Actions clés : (1) Voir les demandes en attente avec pièce d'identité uploadée. (2) Approuver et attribuer le badge vérifié. (3) Rejeter avec un message explicatif.

**3.23 — Gestion des utilisateurs**
- À quoi elle sert : Voir, rechercher, suspendre ou supprimer des comptes.
- Qui y accède : Administrateur.
- Actions clés : (1) Rechercher un utilisateur par nom, rôle ou statut. (2) Suspendre un compte en cas de signalement. (3) Voir l'activité détaillée d'un utilisateur.

**3.24 — Gestion des abonnements & revenus**
- À quoi elle sert : Suivre les abonnements actifs, les renouvellements, les impayés.
- Qui y accède : Administrateur.
- Actions clés : (1) Voir la liste des abonnements Pro actifs par rôle. (2) Identifier les impayés / abonnements expirés. (3) Voir le revenu mensuel récurrent.

---

## 4. Fonctionnalités MVP (V1)

### Authentification & Profils

| # | Feature | Description | Priorité |
|---|---|---|---|
| F1 | Inscription par rôle | L'utilisateur choisit son rôle (acheteur, agent, grossiste) à l'inscription. Chaque rôle a un parcours et un dashboard différent. Inscription par numéro de téléphone + OTP. | P0 |
| F2 | Profil utilisateur par rôle | Chaque rôle a un profil avec des champs spécifiques. Acheteur : pays, adresse livraison. Agent : zone d'action, pièce d'identité, badge vérifié. Grossiste : nom boutique, localisation marché, lien WhatsApp. | P0 |
| F3 | Vérification manuelle agent | L'agent soumet sa pièce d'identité + photo selfie. L'admin examine et approuve/rejette manuellement. Approuvé → badge "Agent vérifié" visible sur le profil public. | P0 |
| F4 | Connexion par OTP | Connexion sans mot de passe, par OTP envoyé au numéro de téléphone enregistré. Adapté au contexte mobile-first de la cible. | P0 |

### Catalogue produits

| # | Feature | Description | Priorité |
|---|---|---|---|
| F5 | Listing produits grossiste | Le grossiste ajoute ses produits avec : nom, description, catégorie, prix unitaire gros, quantité minimum de commande, jusqu'à 5 photos. Peut marquer un produit comme disponible/indisponible. | P0 |
| F6 | Catalogue acheteur | L'acheteur parcourt tous les produits de tous les grossistes. Filtrage par catégorie (bijoux, cosmétiques, textiles, électronique, fournitures…), tranche de prix, grossiste. Tri par date d'ajout ou popularité. | P0 |
| F7 | Page détail produit | Affiche toutes les infos du produit + profil du grossiste + bouton "Demander le sourcing de ce produit" qui pré-remplit le formulaire de demande. | P0 |

### Demande de sourcing ouverte

| # | Feature | Description | Priorité |
|---|---|---|---|
| F8 | Création de demande de sourcing | L'acheteur poste une demande avec : description textuelle, images de référence, lien externe (TikTok, Facebook, site), budget total, quantité, pays de livraison. La demande apparaît dans le feed public visible par tous les agents vérifiés. | P0 |
| F9 | Feed des demandes (côté agent) | L'agent voit un flux de toutes les demandes ouvertes, filtrables par catégorie et budget. Chaque demande affiche le résumé, le budget et le pays de destination. | P0 |
| F10 | Candidature agent | L'agent candidaté sur une demande avec un message de présentation et son tarif de commission. Seuls les agents vérifiés peuvent candidater. | P0 |
| F11 | Sélection de l'agent par l'acheteur | L'acheteur voit la liste des agents qui ont candidaté sur sa demande, consulte leur profil/avis, et choisit celui qu'il veut. L'acceptation lance la mission. | P0 |
| F12 | Limite freemium acheteur | Un acheteur gratuit ne peut avoir que 3 demandes actives simultanément. Au-delà, il doit clôturer une demande existante ou attendre qu'elle se termine. Aucun upgrade Pro acheteur en V1 — c'est juste un garde-fou de charge. | P1 |

### Messagerie

| # | Feature | Description | Priorité |
|---|---|---|---|
| F13 | Messagerie contextuelle | Un fil de conversation est créé automatiquement entre l'acheteur et l'agent quand la mission est acceptée. Contextualisé à la demande : les deux parties voient le résumé de la demande en haut du fil. | P0 |
| F14 | Partage de médias | Envoi de photos et vidéos courtes (< 30s) dans la messagerie. L'agent peut envoyer des preuves visuelles des produits trouvés, de l'emballage, du dépôt chez l'expéditeur. | P0 |
| F15 | Notifications de messages | Notification push/SMS à la réception d'un nouveau message. Essentiel car les deux parties ne sont pas connectées en même temps (fuseaux horaires Bénin / Gabon identiques, mais usages différents). | P1 |

### Suivi de commande

| # | Feature | Description | Priorité |
|---|---|---|---|
| F16 | Pipeline de statuts | L'agent fait progresser la commande à travers 6 statuts : Reçu → En achat → Acheté → Emballé → Expédié → Livré. Chaque changement de statut est horodaté et visible par l'acheteur. | P0 |
| F17 | Preuve par étape | À chaque changement de statut, l'agent peut (et est encouragé à) joindre une photo/vidéo de preuve. Ex : photo du reçu d'achat, photo du colis emballé, photo du bordereau d'expédition. | P0 |
| F18 | Notification de progression | L'acheteur reçoit une notification à chaque changement de statut de sa commande. | P1 |
| F19 | Confirmation de livraison | L'acheteur confirme la réception du colis. Ceci clôture la mission et déclenche la possibilité de laisser un avis. | P0 |

### Évaluations & confiance

| # | Feature | Description | Priorité |
|---|---|---|---|
| F20 | Avis post-livraison | Après confirmation de livraison, l'acheteur peut noter l'agent (1-5 étoiles) et laisser un commentaire. La note moyenne est affichée sur le profil public de l'agent. | P1 |
| F21 | Profil public agent | Page publique affichant : nom, badge vérifié (oui/non), zone d'action, nombre de missions complétées, note moyenne, commentaires récents. | P0 |

### Page boutique grossiste

| # | Feature | Description | Priorité |
|---|---|---|---|
| F22 | Page boutique publique | URL personnalisée (corridor-sourcing.com/boutique/nom-boutique) que le grossiste peut partager sur TikTok, Facebook, WhatsApp. Affiche ses produits, sa description, ses horaires, son contact WhatsApp. | P0 |
| F23 | Lien live externe | Le grossiste peut ajouter un lien vers son live en cours (TikTok, Facebook, Zoom) depuis son dashboard. Le lien s'affiche en évidence sur sa page boutique avec un badge "EN LIVE". Quand le live est fini, le grossiste retire le lien. Pas de système de streaming intégré. | P1 |
| F24 | Statistiques boutique basiques | Le grossiste voit : nombre de vues sur sa page boutique, nombre de vues par produit, nombre de demandes de sourcing générées depuis ses produits. | P1 |

### Abonnements Pro

| # | Feature | Description | Priorité |
|---|---|---|---|
| F25 | Page d'upgrade Pro | Présentation des avantages Pro par rôle. Comparaison plan gratuit vs Pro. Bouton de paiement. | P0 |
| F26 | Paiement abonnement | Paiement mensuel via mobile money (Moov Money, Wave, Airtel Money) ou carte bancaire. Renouvellement mensuel. | P0 |
| F27 | Gestion abonnement | L'utilisateur Pro voit sa date de renouvellement, peut annuler, changer de moyen de paiement. | P1 |

### Administration

| # | Feature | Description | Priorité |
|---|---|---|---|
| F28 | Dashboard admin | KPIs en temps réel : nombre d'utilisateurs par rôle, demandes actives, taux de complétion, revenu mensuel récurrent. | P1 |
| F29 | Validation agents | File d'attente des demandes de vérification. Interface d'examen de la pièce d'identité + approbation/rejet avec motif. | P0 |
| F30 | Gestion utilisateurs | Liste, recherche, suspension/réactivation de comptes. Vue détaillée de l'activité d'un utilisateur. | P1 |

---

## 5. User Stories principales

### US1 — Poster une demande de sourcing

**En tant que** Jenni (acheteuse au Gabon), **je veux** poster une demande de sourcing avec le lien TikTok du produit que j'ai vu, **afin de** recevoir des propositions d'agents vérifiés sans avoir à chercher quelqu'un de confiance moi-même.

**Critères d'acceptation :**
- Jenni peut créer une demande avec : titre, description libre, jusqu'à 3 images de référence, un champ URL pour le lien TikTok/Facebook, un budget en FCFA, une quantité souhaitée, et son pays de livraison (pré-rempli depuis son profil).
- La demande apparaît immédiatement dans le feed des agents vérifiés.
- Jenni ne peut pas poster de 4e demande active si elle en a déjà 3 en cours (plan gratuit). Un message lui explique pourquoi et l'invite à clôturer une demande existante.
- Jenni reçoit une notification dès qu'un agent candidaté sur sa demande.

### US2 — Candidater sur une demande

**En tant que** Karim (agent sourcing vérifié à Cotonou), **je veux** voir les demandes ouvertes et proposer mes services, **afin de** trouver de nouveaux clients au-delà de mon cercle WhatsApp.

**Critères d'acceptation :**
- Karim voit un feed de demandes ouvertes avec résumé (titre, budget, catégorie, pays destination). Il peut filtrer par catégorie et trier par budget ou date.
- Il peut candidater en joignant un message de présentation et son tarif de commission proposé.
- Un agent non vérifié voit les demandes mais le bouton "Candidater" est désactivé avec un message l'invitant à se faire vérifier.
- Karim reçoit une notification quand l'acheteur accepte sa candidature.

### US3 — Choisir un agent

**En tant que** Jenni (acheteuse), **je veux** comparer les agents qui ont candidaté sur ma demande, **afin de** choisir celui qui m'inspire le plus confiance au meilleur tarif.

**Critères d'acceptation :**
- Jenni voit la liste des candidatures avec : nom agent, badge vérifié (oui/non), note moyenne, nombre de missions complétées, message de présentation, commission proposée.
- Elle peut cliquer sur le profil de chaque agent pour voir ses avis détaillés.
- Elle accepte un agent → la mission démarre, un fil de messagerie est créé automatiquement, les autres agents candidats sont notifiés que la demande est pourvue.
- Une seule candidature peut être acceptée par demande.

### US4 — Mettre à jour le suivi d'une commande

**En tant que** Karim (agent), **je veux** mettre à jour le statut de la commande à chaque étape, **afin que** Jenni suive la progression sans m'appeler toutes les heures.

**Critères d'acceptation :**
- Karim voit sa mission active avec le statut actuel (ex: "En achat").
- Il peut faire passer au statut suivant (ex: "Acheté") et joindre jusqu'à 3 photos/vidéos comme preuve.
- Chaque changement de statut est horodaté et irréversible (on ne peut pas revenir en arrière).
- Jenni reçoit une notification immédiate à chaque changement avec un aperçu de la preuve jointe.

### US5 — Lister des produits dans le catalogue

**En tant que** Maridiath (grossiste), **je veux** ajouter mes produits avec photos et prix de gros, **afin que** les acheteurs internationaux voient ce que je vends sans m'envoyer 50 messages WhatsApp.

**Critères d'acceptation :**
- Maridiath peut ajouter un produit avec : nom, description, catégorie (sélection parmi une liste prédéfinie), prix unitaire en FCFA, quantité minimum, jusqu'à 5 photos.
- Elle peut marquer un produit comme "Disponible" ou "Indisponible" à tout moment.
- Ses produits apparaissent sur sa page boutique publique ET dans le catalogue global.
- Un grossiste en plan gratuit peut lister jusqu'à 20 produits. Au-delà, invitation à passer Pro.

### US6 — Partager sa page boutique

**En tant que** Maridiath (grossiste), **je veux** avoir une URL personnalisée pour ma boutique, **afin de** la coller dans ma bio TikTok et convertir mes followers en vrais acheteurs.

**Critères d'acceptation :**
- L'URL est de la forme corridor-sourcing.com/boutique/maridiath-fashion (slug personnalisable une fois).
- La page est accessible sans compte. Un visiteur non inscrit voit les produits et un bouton "S'inscrire pour acheter".
- La page affiche : nom boutique, description, photo de couverture, lien live en cours (si actif), produits avec prix, contact WhatsApp du grossiste.
- Le grossiste peut prévisualiser sa page depuis son dashboard avant de la partager.

### US7 — Se faire vérifier comme agent

**En tant que** Karim (agent non vérifié), **je veux** soumettre mes documents d'identité, **afin d'** obtenir le badge vérifié et pouvoir candidater sur les demandes.

**Critères d'acceptation :**
- Karim peut uploader une photo recto/verso de sa pièce d'identité (CNI ou passeport) et une photo selfie.
- Il renseigne sa zone d'action (quartier/marché principal).
- Il voit le statut de sa demande : "En attente de vérification", "Approuvé", "Rejeté (motif : …)".
- La vérification est manuelle (admin). Délai cible : 24-48h ouvrées.
- Une fois approuvé, le badge apparaît immédiatement sur son profil et il peut candidater.

### US8 — S'abonner au plan Pro

**En tant que** Karim (agent) ou Maridiath (grossiste), **je veux** souscrire à l'abonnement Pro, **afin de** bénéficier de plus de visibilité et d'outils avancés.

**Critères d'acceptation :**
- L'utilisateur voit une comparaison claire gratuit vs Pro avec les avantages listés.
- Il choisit un moyen de paiement : Moov Money, Wave, Airtel Money, ou carte bancaire.
- Le paiement se fait immédiatement. En cas de succès, les fonctionnalités Pro sont activées instantanément.
- L'abonnement se renouvelle automatiquement chaque mois. L'utilisateur est notifié 3 jours avant le renouvellement.
- En cas d'échec de renouvellement, l'utilisateur est rétrogradé en plan gratuit après une période de grâce de 7 jours.

### US9 — Confirmer la réception et évaluer

**En tant que** Jenni (acheteuse), **je veux** confirmer que j'ai bien reçu mon colis et noter l'agent, **afin que** les futurs acheteurs sachent à qui faire confiance.

**Critères d'acceptation :**
- Quand le statut passe à "Livré", Jenni voit un bouton "Confirmer la réception".
- Après confirmation, elle peut noter l'agent de 1 à 5 étoiles et laisser un commentaire (optionnel mais encouragé avec un prompt).
- La note est immédiatement reflétée dans la moyenne de l'agent.
- Si Jenni ne confirme pas après 14 jours, la commande est auto-clôturée (considérée livrée) et une notification l'invite à évaluer.

### US10 — Administrer les vérifications agents

**En tant qu'** admin (Hullys Désiré), **je veux** voir les demandes de vérification en attente et les traiter, **afin de** garantir que seuls des agents fiables candidatent sur la plateforme.

**Critères d'acceptation :**
- L'admin voit une file d'attente avec : nom, date de soumission, pièce d'identité (affichable), selfie, zone d'action déclarée.
- Il peut approuver (le badge est activé) ou rejeter avec un motif textuel (le candidat reçoit une notification avec le motif).
- L'admin peut révoquer un badge vérifié ultérieurement en cas de signalement.

---

## 6. Business Model & Monétisation

### Modèle de revenus

Corridor Sourcing utilise un **modèle freemium multi-sided**. La plateforme **ne manipule aucun fonds** lié aux transactions de sourcing. Chaque partie (acheteur, agent, grossiste) conserve ses propres moyens de paiement pour les échanges entre eux (Airtel Money, Moov Money, Western Union, cash). Les seuls revenus de la plateforme proviennent des abonnements Pro et des campagnes saisonnières.

### Grille tarifaire

| Rôle | Plan Gratuit | Plan Pro |
|---|---|---|
| **Acheteur** | 3 demandes actives simultanées. Accès complet au catalogue, à la messagerie et au suivi. | Pas de plan Pro en V1. L'acheteur est la demande, il reste gratuit. |
| **Agent sourcing** | Profil basique, voit les demandes. **Ne peut PAS candidater** sans badge vérifié (le badge est gratuit, c'est la vérification d'identité). | ~~7 000 FCFA/mois~~ **5 000 FCFA/mois** — Badge vérifié mis en avant, priorité d'affichage dans les candidatures, accès aux statistiques de ses missions, apparition dans le classement "Meilleurs agents". |
| **Grossiste** | Jusqu'à 20 produits listés. Page boutique basique. | ~~18 000 FCFA/mois~~ **13 000 FCFA/mois** — Produits illimités, mise en avant dans le catalogue, statistiques détaillées (vues, demandes, conversion), inclusion dans les campagnes saisonnières de lead generation, badge "Grossiste partenaire". |

### Campagnes saisonnières (revenu additionnel)

Corridor organise des campagnes marketing thématiques (fournitures scolaires en août, bijoux/parfums pour les fêtes en décembre, textiles pour la rentrée…) sur les réseaux sociaux des marchés cibles (Gabon, Togo). Les grossistes Pro sont inclus automatiquement. Les grossistes gratuits peuvent payer un forfait ponctuel de **25 000 FCFA par campagne** pour y participer. Les leads qualifiés (formulaires remplis avec intention d'achat) sont orientés vers les grossistes et agents partenaires.

### Moyens de paiement acceptés pour les abonnements Pro

| Moyen | Couverture |
|---|---|
| **Moov Money** | Bénin (agents, grossistes) |
| **Wave** | Bénin, Sénégal, Côte d'Ivoire |
| **Airtel Money** | Gabon, Bénin |
| **MTN MoMo** | Gabon, Cameroun |
| **Carte bancaire (Visa/Mastercard)** | Diaspora, profils bancarisés |

Agrégateur recommandé : Moneroo (agrège tous les moyens ci-dessus en une seule intégration).

### Projection de rentabilité minimale

| Seuil | Composition | Revenu mensuel |
|---|---|---|
| **Mois 1-2** | 3 agents Pro + 2 grossistes Pro | 41 000 FCFA/mois |
| **Mois 3-4** | 5 agents Pro + 5 grossistes Pro | 90 000 FCFA/mois |
| **Mois 6** | 10 agents Pro + 10 grossistes Pro + 1 campagne | 205 000 FCFA/mois |

---

## 7. Métriques de succès

### Métriques de lancement (30 premiers jours)

| KPI | Cible | Pourquoi |
|---|---|---|
| Inscriptions totales | 50 utilisateurs (30 acheteurs, 10 agents, 10 grossistes) | Vérifie l'attractivité du positionnement et l'efficacité du recrutement terrain. |
| Agents vérifiés | 5 agents avec badge | Vérifie que le processus de vérification est fonctionnel et que les agents passent l'étape. |
| Demandes de sourcing postées | 15 demandes | Vérifie que les acheteurs comprennent le mécanisme de demande ouverte. |
| Demandes avec au moins 1 candidature agent | 10 (67% des demandes) | Vérifie que les agents sont actifs et réactifs. |
| Missions complétées (statut "Livré" confirmé) | 3 commandes livrées bout en bout | Vérifie que le flux complet fonctionne : demande → candidature → acceptation → achat → expédition → livraison. |

### Métriques de rétention (60 jours)

| KPI | Cible | Pourquoi |
|---|---|---|
| Taux de retour acheteur (2e demande dans les 30 jours suivant la 1re livraison) | > 40% | Vérifie la satisfaction et la récurrence. Le bouche-à-oreille en dépend. |
| Taux d'activation agent (au moins 1 candidature dans les 7 jours suivant la vérification) | > 60% | Vérifie que l'agent vérifié trouve rapidement des demandes intéressantes. |
| Conversion freemium → Pro (agent) | > 15% des agents vérifiés actifs | Vérifie que la valeur Pro est perçue. |
| Conversion freemium → Pro (grossiste) | > 10% des grossistes avec ≥ 5 produits listés | Vérifie que les fonctionnalités Pro (stats, mise en avant) créent un besoin. |

### Métriques de qualité

| KPI | Cible | Pourquoi |
|---|---|---|
| Note moyenne agents | > 4.0 / 5 | Indicateur de confiance globale de la plateforme. |
| Temps médian demande → 1re candidature agent | < 24h | Vérifie que le marché est suffisamment liquide (assez d'agents actifs). |
| Temps médian mission complète (acceptation → livraison confirmée) | < 10 jours | Cohérent avec la promesse "livré en 7 jours max" (incluant les délais d'expédition Cotonou → Libreville). |
| Taux de litiges / signalements | < 5% des missions complétées | Vérifie que le recrutement sélectif des agents fonctionne. |

---

## 8. Ce qui est HORS SCOPE V1

| Feature exclue | Raison | Horizon envisagé |
|---|---|---|
| **Calendrier de RDV vérification vidéo intégré** | Module complet de booking (disponibilités grossiste, notifications, rappels). Trop lourd pour le MVP. En V1, la coordination vidéo se fait via WhatsApp après mise en contact. | V1.1 — Mois 2, quand le flux de base est validé. |
| **Agent interne grossiste** | Le grossiste désigne un agent dans sa boutique pour les vérifications vidéo. Nécessite un rôle hybride agent/grossiste et un flux de commande alternatif. | V1.1 — Mois 2, couplé au calendrier RDV. |
| **Événements lives intégrés** | Streaming vidéo sur la plateforme avec commandes en direct. En V1, le grossiste colle un lien TikTok/Facebook/Zoom sur sa page boutique. | V2 — Mois 4+, quand la base grossistes est significative. |
| **Système d'escrow / paiement intégré** | Corridor ne manipule pas les fonds des transactions de sourcing. Chaque partie garde ses moyens de paiement. Ajouter un escrow nécessite une licence fintech BCEAO. | Pas avant V3, et seulement si le volume de litiges le justifie. |
| **Expansion Togo et Nigeria** | Le MVP cible le corridor Bénin (Cotonou) → Gabon/CEMAC. Le Togo et le Nigeria nécessitent des agents locaux recrutés et des grossistes dans d'autres villes. | V2 — Mois 4+, après validation du corridor principal. |
| **Application mobile native** | Le produit est une application web responsive, accessible depuis n'importe quel navigateur mobile. Suffisant pour 85%+ d'usage mobile en Afrique. Une app native est un coût disproportionné à ce stade. | Pas avant 1 000+ utilisateurs actifs mensuels. |
| **Système de chat vocal / vidéo intégré** | La messagerie V1 est textuelle + photos/vidéos. Les appels vidéo de vérification se font sur WhatsApp. Intégrer de la visio ajoute une complexité énorme pour un gain marginal à ce stade. | V2 — Mois 4+. |
| **Multi-langue** | L'interface est en français uniquement. Le corridor Bénin → CEMAC est francophone. L'anglais sera nécessaire uniquement pour l'expansion Nigeria. | V2 — avec l'expansion Nigeria. |
| **Programme d'affiliation / parrainage** | Les acheteurs qui recommandent Corridor à d'autres gagnent un avantage. Intéressant mais pas prioritaire quand le flux de base n'est pas encore solide. | V1.1 — Mois 3. |
| **Analytics avancés grossiste** | Entonnoir de conversion détaillé, analyse par source de trafic, comparaison avec les autres grossistes. Le dashboard grossiste V1 ne montre que les compteurs de base (vues, demandes). | V1.1 — Mois 2. |

---

## 9. Risques et mitigation

### Risque 1 — Problème de la poule et de l'œuf (marketplace multi-sided)

**Risque :** Sans agents vérifiés, les acheteurs ne postent pas de demandes. Sans demandes, les agents n'ont pas de raison de s'inscrire. Sans acheteurs ni agents, les grossistes ne listent pas leurs produits.

**Mitigation :**
- Hullys Désiré est le premier agent vérifié. Il traite les premières commandes lui-même pour amorcer le flux et générer des avis.
- Recrutement de 3-5 agents avant le lancement public, issus du réseau de Gabonais/Togolais vivant à Cotonou (même profil que le fondateur).
- Recrutement de 5-10 grossistes avant le lancement en se déplaçant physiquement aux marchés Dantokpa et Missèbo. L'argument : "Vous avez 15 000 followers TikTok mais aucune vente export. On vous apporte les acheteurs."
- L'acheteur n'a pas besoin de grossistes listés pour poster une demande libre avec un lien TikTok. Le catalogue est un bonus, pas un prérequis.

### Risque 2 — Désintermédiation (les parties se contactent en dehors de la plateforme)

**Risque :** Après une première mission réussie, l'acheteur et l'agent échangent leurs numéros WhatsApp et n'utilisent plus Corridor. Le grossiste continue sur ses groupes WhatsApp. La plateforme perd sa raison d'être.

**Mitigation :**
- La valeur de Corridor n'est pas la mise en relation ponctuelle, c'est le suivi structuré, la preuve visuelle archivée, et le système de confiance (avis, badge). WhatsApp ne fournit rien de tout ça.
- Les coordonnées personnelles (numéro WhatsApp) ne sont pas affichées dans les profils agents. La messagerie interne est le seul canal de communication officiel.
- Les fonctionnalités Pro (statistiques, mise en avant, inclusion dans les campagnes) créent une dépendance à la plateforme. Un agent qui quitte Corridor perd sa visibilité et ses avis.
- Monitorer le taux de retour : si un acheteur fait une première commande puis disparaît, c'est un signal de désintermédiation. Déclencher une relance.

### Risque 3 — Qualité et fiabilité des agents

**Risque :** Un agent vérifié fournit un mauvais service (retard, produit différent, arnaque). La confiance de la plateforme entière est détruite par un seul incident.

**Mitigation :**
- Recrutement sélectif au lancement : Hullys recrute personnellement chaque agent et les rencontre physiquement à Cotonou.
- Les avis post-livraison sont obligatoires (encouragés par le prompt de confirmation) et publics. Un agent en dessous de 3.0/5 sur 3+ missions est suspendu automatiquement pour examen.
- L'admin peut révoquer un badge vérifié à tout moment en cas de signalement.
- En V1, le nombre limité d'agents (5-10) rend le contrôle qualité manuel viable.

### Risque 4 — Volume insuffisant pour justifier les abonnements Pro

**Risque :** Avec seulement 15-30 demandes par mois au lancement, un agent Pro à 5 000 FCFA/mois ne trouve pas assez de missions pour justifier le coût. Les grossistes Pro ne voient pas assez de trafic sur leur page boutique.

**Mitigation :**
- Le badge vérifié est gratuit. L'agent gratuit vérifié PEUT candidater. Le Pro apporte un avantage marginal (priorité d'affichage, stats) et ne devient pertinent que quand la concurrence entre agents existe (~10+ agents actifs).
- Ne pas pousser l'upgrade Pro tant que le volume de demandes est faible. Activer les fonctionnalités Pro manuellement pour les 3-5 premiers agents/grossistes "beta" pour recueillir du feedback.
- Les campagnes saisonnières peuvent créer des pics de demande ponctuels qui justifient le Pro. La première campagne (rentrée scolaire) doit être prête pour août.

### Risque 5 — Dépendance au fondateur pour l'amorçage opérationnel

**Risque :** Hullys est le fondateur, le premier agent, l'admin de vérification, le recruteur de grossistes, et le développeur. En side-project soir/week-end, tout repose sur une seule personne. Un empêchement personnel bloque toute la plateforme.

**Mitigation :**
- Recruter au moins 1 co-agent de confiance dès le lancement qui peut traiter les commandes même si Hullys est indisponible.
- Automatiser au maximum l'admin : notifications de nouvelles demandes de vérification, alertes sur les commandes bloquées depuis 48h+.
- Documenter le processus de vérification agent pour pouvoir le déléguer rapidement.
- Accepter que les 2-3 premiers mois soient artisanaux. Le but du MVP est de valider, pas de scaler.