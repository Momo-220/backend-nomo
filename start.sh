#!/bin/bash
echo "🚀 Démarrage du backend..."
echo "📊 Génération du client Prisma..."
npx prisma generate
echo "🗄️ Application des migrations..."
npx prisma migrate deploy
echo "🎯 Démarrage de l'application..."
node dist/main
