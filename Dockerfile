FROM bitnami/kubectl:latest AS kubectl

FROM node:20-alpine
WORKDIR /app

# bash : les scripts d'exercices utilisent #!/bin/bash
RUN apk add --no-cache bash

# kubectl : binaire copié depuis l'image officielle bitnami (pas de curl, pas de download runtime)
COPY --from=kubectl /opt/bitnami/kubectl/bin/kubectl /usr/local/bin/kubectl

# Serveur + frontend statique
COPY app/server.js .
COPY app/public/ ./public/

# Cours — tout le dossier (auto-découvert par le serveur)
COPY courses/ ./courses/

# Exercices complets (mission.md + deploy.sh + reset.sh)
COPY exercices/ ./exercices/

EXPOSE 3000
CMD ["node", "server.js"]
