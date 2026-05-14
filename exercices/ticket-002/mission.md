# TICKET-002 : Deploiement bloque

## Rapport d'incident

**De** : Lead DevOps
**Urgence** : Haute
**Heure** : 14:30

> "J'ai lance le deploiement de la nouvelle version de l'API en staging.
> Ca fait 10 minutes et les pods ne demarrent toujours pas.
> La version precedente a ete supprimee, donc le service est completement down."

## Ta mission

Les pods doivent atteindre le status Running. Trouve ce qui bloque et repare.

## Deploiement

```bash
kubectl apply -f ticket-002/
```

## Critere de validation

```bash
kubectl get pods -n exo-002
# Tous les pods doivent etre Running et READY 1/1
```
