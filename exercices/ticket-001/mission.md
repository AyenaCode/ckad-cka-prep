# TICKET-001 : App injoignable

## Rapport d'incident

**De** : Equipe frontend
**Urgence** : Haute
**Heure** : 09:12

> "On a deploye l'app web ce matin. Les pods semblent tourner normalement
> mais quand on essaie d'acceder au Service, rien ne repond. Le site est
> completement down pour les utilisateurs."

## Ta mission

L'app doit repondre via le Service. Trouve pourquoi ca ne marche pas et repare.

## Deploiement

```bash
kubectl apply -f ticket-001/
```

## Critere de validation

```bash
# Depuis un pod de debug, l'app doit repondre :
kubectl run test --image=busybox --rm -it --restart=Never -n exo-001 -- wget -qO- http://web-svc:80
# Doit afficher du HTML (page nginx)
```
