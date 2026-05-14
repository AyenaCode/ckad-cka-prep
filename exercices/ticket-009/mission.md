# TICKET-009 : Worker qui ne demarre jamais

## Rapport d'incident

**De** : Equipe data
**Urgence** : Moyenne
**Heure** : 10:08

> "Notre worker de traitement de jobs est en CrashLoopBackOff depuis
> qu'on a deploye la nouvelle image. Le dev jure que l'image fonctionne
> en local. Les jobs s'accumulent dans la file, on a deja 4000 messages
> en attente."

## Ta mission

Les pods doivent etre Running et stables (pas de restart en boucle).

> Note : tu vas devoir corriger le YAML du Deployment. Utilise `kubectl edit deploy`
> ou `kubectl set` ou `kubectl patch`. Pas d'autre ressource a creer.

## Deploiement

```bash
./ticket-009/deploy.sh
```

## Critere de validation

```bash
# Pods Running, READY 1/1, RESTARTS qui n'augmente plus
kubectl get pods -n exo-009
```

## Indice (si tu seches)

Quand un pod CrashLoop demarre puis meurt immediatement, les logs sont
souvent la reponse. `kubectl logs <pod> -n exo-009` affiche la sortie de la commande.
Si les logs sont vides, essaie `--previous`.
