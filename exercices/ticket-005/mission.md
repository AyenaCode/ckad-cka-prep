# TICKET-005 : Le backend injoignable

## Rapport d'incident

**De** : CTO
**Urgence** : HAUTE
**Heure** : 14:03

> "On a deploye la stack e-commerce. Les pods semblent tous tourner.
> Mais le frontend ne peut pas joindre le backend — l'API ne repond pas
> quand on l'appelle par son nom de Service. Les clients voient des
> erreurs. Repare ca sans tout recree."

## Contexte

Les deux Deployments sont en place, les images sont bonnes.
Les pods sont Running. Et pourtant le Service `backend-api` ne repond pas.

Pourquoi un Service peut exister mais ne pas router le trafic ?

## Ta mission

1. Deployer la stack
2. Reproduire le probleme — confirmer que le Service ne repond pas
3. Identifier la cause racine avec les bons outils (`kubectl` uniquement)
4. Corriger **sans supprimer/recreer** de ressource (`edit` ou `patch`)
5. Valider que le Service repond apres correction

## Deploiement

```bash
kubectl apply -f ticket-005/
```

## Validation

```bash
# Doit afficher du HTML apres correction
kubectl run test --image=busybox --rm -it --restart=Never -n exo-005 -- \
  wget -qO- http://backend-api:80
```

## Contrainte d'examen

Temps cible : **5 minutes** — tu dois trouver et corriger avant ca.
Pas de suppression de ressource. Patch ou edit uniquement.
