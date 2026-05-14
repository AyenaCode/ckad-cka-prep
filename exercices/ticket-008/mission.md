# TICKET-008 : Service de paiement HS

## Rapport d'incident

**De** : Equipe paiements
**Urgence** : CRITIQUE
**Heure** : 12:55

> "Le nouveau service de paiement refuse de demarrer. Les pods restent
> bloques en statut bizarre, on ne sait pas trop quoi. Les ConfigMaps
> ont l'air OK. Le dev qui a fait le YAML est en vacances et personne
> ne sait ce qu'il a configure. On perd des transactions chaque minute."

## Ta mission

Les pods doivent demarrer (Running, Ready 1/1). Le Service doit repondre.

> Note : tu vas decouvrir qu'une ressource manque. Cree-la avec
> `kubectl create secret generic ...` (peu importe les valeurs, on est en dev).

## Deploiement

```bash
./ticket-008/deploy.sh
```

## Critere de validation

```bash
# 1. Pods Running
kubectl get pods -n exo-008

# 2. Service repond
kubectl run test --image=busybox --rm -it --restart=Never -n exo-008 -- wget -qO- http://payment-svc:80
# Doit afficher du HTML
```

## Indice (si tu seches)

Quand un pod a un statut autre que Running, le `describe pod` te dit
TOUJOURS pourquoi dans la section Events. Cherche le mot "not found"
ou "MountVolume".
