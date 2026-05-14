# TICKET-004 : Pods en crash loop

## Rapport d'incident

**De** : Equipe backend
**Urgence** : Critique
**Heure** : 08:03

> "Le service de cache est en CrashLoopBackOff depuis ce matin.
> On a fait un changement de configuration hier soir via un ConfigMap.
> Depuis, plus rien ne demarre. Le service est critique, les autres
> microservices dependent de lui."

## Ta mission

Les pods doivent demarrer et le Service doit repondre. La configuration doit etre correctement injectee.

## Deploiement

```bash
kubectl apply -f ticket-004/
```

## Critere de validation

```bash
# 1. Les pods doivent etre Running
kubectl get pods -n exo-004
# Tous en Running, READY 1/1

# 2. Le Service doit repondre
kubectl run test --image=busybox --rm -it --restart=Never -n exo-004 -- wget -qO- http://cache-svc:6379
# Doit recevoir une reponse (meme une erreur de protocole = OK, ca veut dire que Redis tourne)
```
