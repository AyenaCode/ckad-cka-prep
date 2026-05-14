# TICKET-007 : Cache qui meurt en boucle

## Rapport d'incident

**De** : Equipe backend
**Urgence** : Haute
**Heure** : 03:42 (nuit)

> "Notre Redis de cache redemarre toutes les 20 secondes. Les pods passent
> de Running a Error puis recommencent. On a verifie l'image, c'est la bonne.
> Les logs ne montrent rien d'anormal cote application.
> Les microservices qui dependent du cache sont en train de s'effondrer."

## Ta mission

Les pods Redis doivent etre Running et stables (0 restart pendant 1 minute).
Le service doit accepter les connexions.

## Deploiement

```bash
./ticket-007/deploy.sh
```

## Critere de validation

```bash
# 1. Pods stables
kubectl get pods -n exo-007
# RESTARTS doit rester a 0 ou ne plus augmenter

# 2. Le service repond (Redis renverra une erreur de protocole sur du HTTP, c'est normal)
kubectl run test --image=busybox --rm -it --restart=Never -n exo-007 -- nc -zv cache-svc 6379
# Doit afficher "open"
```

## Indice (si tu seches)

Les logs cote app sont vides parce que l'app n'a pas le temps de logger quoi que ce soit.
Quand un pod meurt sans rien dire, le `describe pod` revele souvent un `Last State`
avec une raison precise. Lis-le attentivement.
