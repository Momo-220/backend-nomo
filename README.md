# Restaurant SaaS - Backend

Plateforme SaaS permettant aux restaurants de gérer leur menu en ligne via QR code et NFC, avec commandes clients, dashboard admin et notifications temps réel.

## 🏗️ Architecture

- **Backend**: NestJS (Node.js, TypeScript)
- **Base de données**: PostgreSQL avec Prisma ORM
- **Cache/Pub-Sub**: Redis
- **Authentification**: JWT avec rôles (Admin, Manager, Staff)
- **Multi-tenant**: Architecture sécurisée par tenant
- **WebSocket**: Notifications temps réel
- **Paiements**: Wave, MyNita (via abstraction)
- **Fichiers**: AWS S3 pour QR codes et PDF

## 🚀 Démarrage rapide

### Prérequis
- Node.js 18+
- Docker et Docker Compose
- PostgreSQL (si pas d'utilisation de Docker)
- Redis (si pas d'utilisation de Docker)

### Installation

1. **Cloner et installer les dépendances**
```bash
git clone <repository-url>
cd restaurant-saas-backend
npm install
```

2. **Configuration environnement**
```bash
cp env.example .env
# Éditer .env avec vos configurations
```

3. **Démarrage avec Docker (recommandé)**
```bash
# Démarrer tous les services
docker-compose up -d

# Appliquer les migrations Prisma
docker-compose exec app npx prisma migrate dev

# Optionnel: Seed de données de test
docker-compose exec app npx prisma db seed
```

4. **Démarrage manuel (développement)**
```bash
# Démarrer PostgreSQL et Redis localement
# Puis:
npm run db:migrate
npm run start:dev
```

### URLs importantes
- **API**: https://backend-de-restaurant-saas-production.up.railway.app/api/v1
- **Base de données**: localhost:5432
- **Redis**: localhost:6379

## 📊 Structure du projet

```
src/
├── auth/           # Authentification JWT & rôles
├── tenants/        # Gestion des restaurants
├── menu/           # Catégories et items du menu
├── orders/         # Gestion des commandes
├── payments/       # Intégration paiements
├── files/          # QR codes et PDF
├── websocket/      # Notifications temps réel
├── prisma/         # Configuration base de données
└── common/         # Guards, middlewares, decorators
```

## 🗄️ Base de données

Le schéma Prisma inclut:
- **Multi-tenant**: Isolation par `tenant_id`
- **Utilisateurs**: Avec rôles (Admin, Manager, Staff)
- **Menu**: Catégories et items avec gestion stock
- **Commandes**: Statuts et items détaillés
- **Paiements**: Abstraction Wave/MyNita
- **Tables**: Avec QR codes
- **Events**: Audit trail complet

### Migrations
```bash
# Créer une nouvelle migration
npm run db:migrate

# Générer le client Prisma
npm run db:generate

# Interface graphique
npm run db:studio
```

## 🔐 Authentification

### Rôles utilisateurs
- **ADMIN**: Accès complet au tenant
- **MANAGER**: Gestion menu et commandes
- **STAFF**: Consultation commandes cuisine

### Endpoints principaux
- `POST /auth/register` - Inscription utilisateur
- `POST /auth/login` - Connexion utilisateur  
- `POST /auth/logout` - Déconnexion utilisateur
- `GET /auth/profile` - Profil utilisateur
- `GET /auth/me` - Informations utilisateur + tenant

## 🏢 Multi-tenant

Chaque requête doit inclure le `tenant_id`:
- **Header**: `X-Tenant-Id: <tenant_id>`
- **JWT**: Automatiquement extrait du token
- **URL publique**: `/resto/:slug/menu` (conversion slug → tenant_id)

## 📱 API Endpoints

### Tenants
- `GET /tenants` - Liste des restaurants
- `POST /tenants` - Créer un restaurant
- `GET /tenants/:id` - Détails restaurant
- `GET /tenants/slug/:slug` - Restaurant par slug
- `PATCH /tenants/:id` - Modifier restaurant
- `GET /tenants/:id/stats` - Statistiques

### Utilisateurs
- `POST /users` - Créer utilisateur (ADMIN/MANAGER)
- `GET /users` - Liste utilisateurs du tenant
- `GET /users/:id` - Détails utilisateur
- `PATCH /users/:id` - Modifier utilisateur
- `DELETE /users/:id` - Désactiver utilisateur (ADMIN)
- `POST /users/change-password` - Changer mot de passe

### Menu
- `GET /menu/categories` - Catégories du menu
- `GET /menu/items` - Items du menu
- `POST /menu/categories` - Créer catégorie (ADMIN/MANAGER)
- `POST /menu/items` - Créer item (ADMIN/MANAGER)
- `GET /menu` - Menu complet avec catégories + items
- `GET /menu/public/:slug` - Menu public pour clients
- `GET /menu/search` - Recherche dans le menu

### Commandes
- `POST /orders/public/:slug` - Commande publique client
- `POST /orders` - Commande privée (utilisateurs connectés)
- `GET /orders` - Liste commandes (avec filtres)
- `GET /orders/active` - Commandes actives (cuisine)
- `GET /orders/stats` - Statistiques détaillées
- `PATCH /orders/:id/status` - Changer statut
- `PATCH /orders/:id/accept` - Accepter commande
- `PATCH /orders/:id/preparing` - Commencer préparation
- `PATCH /orders/:id/ready` - Marquer prêt
- `PATCH /orders/:id/delivered` - Marquer livré
- `PATCH /orders/:id/cancel` - Annuler commande

### WebSocket Temps Réel
- `WS /orders` - Namespace commandes
- Notifications nouvelles commandes (cuisine)
- Notifications changements de statut
- Notifications commandes prêtes
- Room spéciale cuisine pour le personnel

### QR Codes & PDF
- `POST /qr-codes/table/:id` - QR code table (ADMIN/MANAGER)
- `POST /qr-codes/menu` - QR code menu (ADMIN/MANAGER)
- `POST /qr-codes/public/menu/:slug` - QR code public
- `POST /qr-codes/tables/generate-all` - Tous les QR codes
- `GET /qr-codes/download/:filename` - Télécharger QR
- `POST /pdf/receipt/order/:id` - Reçu PDF (ALL ROLES)
- `GET /pdf/download/:filename` - Télécharger PDF
- `GET /pdf/view/:filename` - Visualiser PDF

### Paiements (Wave & MyNita)
- `POST /payments/initiate/:orderId` - Initier paiement (ADMIN/MANAGER)
- `GET /payments/:paymentId` - Détails paiement (ALL ROLES)
- `GET /payments` - Liste paiements avec filtres (ADMIN/MANAGER)
- `GET /payments/stats/overview` - Statistiques paiements (ADMIN/MANAGER)
- `GET /payments/providers/status` - Statut providers (ADMIN/MANAGER)
- `POST /payments/webhooks/mynita` - Webhook MyNita (PUBLIC)
- `POST /payments/webhooks/wave` - Webhook Wave (PUBLIC)
- `POST /payments/webhooks/test/:provider` - Test webhook (PUBLIC)

## 🧪 Tests

```bash
# Tests unitaires
npm run test

# Tests avec couverture
npm run test:cov

# Tests e2e
npm run test:e2e
```

## 📦 Déploiement

### AWS ECS/Fargate
1. Build de l'image Docker
2. Push vers ECR
3. Déploiement via ECS
4. Configuration RDS PostgreSQL
5. Configuration ElastiCache Redis

### Variables d'environnement production
- `DATABASE_URL`: URL PostgreSQL RDS
- `REDIS_HOST`: ElastiCache endpoint
- `JWT_SECRET`: Clé secrète sécurisée
- `AWS_*`: Credentials pour S3
- `WAVE_*` / `MYNITA_*`: Clés API paiement

## 🔄 Roadmap

- [x] **Module 1**: Database & Multi-Tenant ✅
- [x] **Module 2**: Authentication & Authorization ✅
- [x] **Module 3**: Menu CRUD & Management ✅
- [x] **Module 4**: Orders & WebSocket ✅
- [x] **Module 5**: QR Code & PDF ✅
- [x] **Module 6**: Payments (Wave & MyNita) ✅
- [ ] **Module 7**: Testing & QA
- [ ] **Module 8**: Deployment & CI/CD

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 License

Ce projet est sous licence privée. Tous droits réservés.
