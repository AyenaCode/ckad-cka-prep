# TICKET-003 : Connection refused

## Rapport d'incident

**De** : Equipe QA
**Urgence** : Moyenne
**Heure** : 11:45

> "L'app de monitoring est deployee, les pods affichent Running,
> mais quand on appelle le Service on obtient 'connection refused'.
> On a verifie, les pods tournent bien. On ne comprend pas."

## Ta mission

Le Service doit router correctement le trafic vers l'app. Trouve le probleme et repare.

## Deploiement

```bash
kubectl apply -f ticket-003/
```

## Critere de validation

```bash
# L'app doit repondre via le Service :
kubectl run test --image=busybox --rm -it --restart=Never -n exo-003 -- wget -qO- http://monitoring-svc:8080
# Doit afficher du HTML (page nginx)
```
