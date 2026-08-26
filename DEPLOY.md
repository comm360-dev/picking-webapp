# 🚀 Guide de Déploiement sur Render.com

## Prérequis

- Un compte GitHub (gratuit)
- Un compte Render.com (gratuit)
- Votre projet poussé sur GitHub

## Étape 1 : Préparer le dépôt GitHub

### 1.1 Créer un dépôt GitHub
```bash
# Initialiser git si ce n'est pas déjà fait
git init

# Ajouter tous les fichiers
git add .

# Créer le premier commit
git commit -m "Initial commit - Picking WebApp"

# Ajouter le remote GitHub (créez d'abord le repo sur github.com)
git remote add origin https://github.com/VOTRE-USERNAME/picking-webapp.git

# Pousser sur GitHub
git branch -M main
git push -u origin main
```

### 1.2 Créer un fichier .gitignore
Assurez-vous que votre `.gitignore` contient :
```
node_modules/
.env
.env.local
dist/
*.log
.DS_Store
```

## Étape 2 : Créer la base de données PostgreSQL

1. Allez sur https://dashboard.render.com
2. Cliquez sur **"New +"** → **"PostgreSQL"**
3. Configurez :
   - **Name** : `picking-db`
   - **Database** : `picking`
   - **User** : (généré automatiquement)
   - **Region** : Frankfurt (Europe)
   - **Plan** : Free
4. Cliquez sur **"Create Database"**
5. ⚠️ **Important** : Notez l'URL de connexion (Internal Database URL)

## Étape 3 : Déployer le Backend (API)

1. Cliquez sur **"New +"** → **"Web Service"**
2. Connectez votre dépôt GitHub
3. Configurez :
   - **Name** : `picking-webapp-api`
   - **Region** : Frankfurt
   - **Root Directory** : `backend`
   - **Environment** : Node
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Plan** : Free

4. **Variables d'environnement** :
   Cliquez sur "Advanced" puis ajoutez :
   ```
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=[Coller l'URL de votre base PostgreSQL]
   JWT_SECRET=[Générer une clé aléatoire]
   WC_URL=https://preprod.dadi8173.odns.fr
   WC_CONSUMER_KEY=[Votre clé WooCommerce]
   WC_CONSUMER_SECRET=[Votre secret WooCommerce]
   WC_STATUS_ON_COMPLETE=[Slug du statut « prêt pour expédition » ; vide = completed]
   ```

5. Cliquez sur **"Create Web Service"**

## Étape 4 : Initialiser la base de données

Une fois le backend déployé :

1. Allez dans votre service backend sur Render
2. Cliquez sur **"Shell"** (en haut à droite)
3. Exécutez :
   ```bash
   npm run init-db
   ```

## Étape 5 : Déployer le Frontend

### Option A : Service statique séparé (Recommandé)

1. Cliquez sur **"New +"** → **"Static Site"**
2. Sélectionnez votre dépôt GitHub
3. Configurez :
   - **Name** : `picking-webapp`
   - **Root Directory** : `frontend`
   - **Build Command** : `npm install && npm run build`
   - **Publish Directory** : `dist`

4. **Variables d'environnement** :
   ```
   VITE_API_URL=https://picking-webapp-api.onrender.com/api
   ```

5. Cliquez sur **"Create Static Site"**

### Option B : Backend sert le frontend (Plus simple)

Si vous choisissez cette option :

1. Dans le backend, modifiez la variable d'environnement :
   ```
   NODE_ENV=production
   ```

2. Le backend servira automatiquement le frontend compilé

## Étape 6 : Configuration finale

### 6.1 Mettre à jour CORS (Backend)

Dans `.env` du backend sur Render :
```
FRONTEND_URL=https://picking-webapp.onrender.com
```

### 6.2 Créer un utilisateur admin

1. Ouvrez le Shell du backend sur Render
2. Exécutez :
   ```bash
   node backend/createPreparateur.js
   ```

## Étape 7 : Tester l'application

1. Allez sur l'URL de votre frontend : `https://picking-webapp.onrender.com`
2. Connectez-vous avec les identifiants admin créés
3. Synchronisez les produits depuis WooCommerce
4. Testez le scan QR sur votre iPhone

## 📱 Installer sur iPhone

1. Ouvrez Safari sur iPhone
2. Allez sur `https://picking-webapp.onrender.com`
3. Appuyez sur Partager → "Sur l'écran d'accueil"
4. L'icône apparaîtra sur votre écran d'accueil

## ⚠️ Limitations du plan gratuit

- **Backend** : S'endort après 15min d'inactivité (redémarre en ~30 secondes)
- **Base de données** : Expire après 90 jours (mais renouvelable gratuitement)
- **Bande passante** : 100 GB/mois

## 🔄 Mises à jour automatiques

À chaque `git push` sur la branche `main`, Render redéployera automatiquement !

## 🐛 Dépannage

### Le backend ne démarre pas
- Vérifiez que `DATABASE_URL` est correctement configuré
- Vérifiez les logs : Dashboard → Service → Logs

### La base de données ne fonctionne pas
- Assurez-vous d'avoir exécuté `npm run init-db`
- Vérifiez l'URL de connexion dans les variables d'environnement

### Le frontend ne charge pas
- Vérifiez que `VITE_API_URL` pointe vers le bon backend
- Vérifiez que le build s'est terminé sans erreur

## 📧 Support

Si vous avez des problèmes, consultez :
- Documentation Render : https://render.com/docs
- Support Render : https://render.com/support
