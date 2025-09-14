#!/bin/bash

# Script de démarrage robuste pour Railway
set -e

echo "🚀 Démarrage de l'application Restaurant SaaS..."

# Vérifier les variables d'environnement essentielles
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Erreur: DATABASE_URL n'est pas définie"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "❌ Erreur: JWT_SECRET n'est pas définie"
    exit 1
fi

echo "✅ Variables d'environnement vérifiées"

# Attendre que la base de données soit prête (max 60 secondes)
echo "⏳ Attente de la base de données..."
for i in {1..60}; do
    if npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
        echo "✅ Base de données prête"
        break
    fi
    
    if [ $i -eq 60 ]; then
        echo "❌ Timeout: Impossible de se connecter à la base de données"
        exit 1
    fi
    
    echo "⏳ Tentative $i/60..."
    sleep 2
done

# Appliquer les migrations
echo "📦 Application des migrations Prisma..."
if npx prisma migrate deploy; then
    echo "✅ Migrations appliquées avec succès"
else
    echo "❌ Erreur lors de l'application des migrations"
    exit 1
fi

# Générer le client Prisma
echo "🔧 Génération du client Prisma..."
if npx prisma generate; then
    echo "✅ Client Prisma généré avec succès"
else
    echo "❌ Erreur lors de la génération du client Prisma"
    exit 1
fi

# Démarrer l'application
echo "🎯 Démarrage de l'application NestJS..."
exec node dist/main
