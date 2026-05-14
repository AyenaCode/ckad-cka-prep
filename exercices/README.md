# Exercices Kubernetes — Tickets d'incident

## Comment utiliser

Chaque dossier `ticket-XXX` simule un incident de production.
Les configs cassees sont encodees dans les scripts — tu ne peux pas tricher.

### Workflow par exercice

```bash
# 1. Lis le ticket d'incident
cat ticket-001/mission.md

# 2. Deploie la config cassee
./ticket-001/deploy.sh

# 3. Diagnostique et repare avec kubectl uniquement
#    kubectl get, describe, logs, events, exec, edit, patch, set image...

# 4. Valide avec le critere de la mission

# 5. Nettoie avant le prochain exercice
./reset.sh
```

### Ordre recommande

| Ticket | Difficulte | Concept clé |
|---|---|---|
| 001 | Facile | Selector typo (service ↔ pods) |
| 002 | Facile | ImagePullBackOff |
| 003 | Moyen | targetPort vs containerPort |
| 004 | Moyen | ConfigMap mal injectee |
| 005 | Difficile | Stack complete frontend + backend |
| 006 | Moyen | Liveness/readiness probe mal configuree |
| 007 | Moyen | OOMKilled (limit memoire) |
| 008 | Moyen | Secret reference inexistant |
| 009 | Facile | Mauvais command/args (lire les logs) |
| 010 | Moyen | Init container bloque par dependance |

### Prerequis

```bash
minikube start
kubectl get nodes   # doit afficher un node Ready
```
