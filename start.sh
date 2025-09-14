#!/bin/bash
echo "🚀 Démarrage du backend..."
echo "📊 Génération du client Prisma..."
npx prisma generate
echo "🗄️ Force la synchronisation du schéma..."
npx prisma db push --force-reset --accept-data-loss
echo "🎯 Démarrage de l'application..."
node dist/main
