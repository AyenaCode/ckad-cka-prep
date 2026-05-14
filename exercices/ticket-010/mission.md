# TICKET-010 : Application qui ne demarre jamais

## Rapport d'incident

**De** : Equipe plateforme
**Urgence** : Haute
**Heure** : 15:30

> "On a deploye une nouvelle version du backend e-commerce.
> Le pod reste avec un statut bizarre 'Init:0/1' depuis 20 minutes.
> Le container principal n'a meme pas commence a tourner.
> On comprend pas, c'etait OK la semaine derniere."

## Ta mission

Le pod doit passer en Running et le service doit repondre.

> Note : il y a une dependance manquante. Tu vas devoir creer une ressource
> pour debloquer le demarrage. Pas besoin de toucher au Deployment existant.

## Deploiement

```bash
./ticket-010/deploy.sh
```

## Critere de validation

```bash
# 1. Pod en Running, READY 1/1
kubectl get pods -n exo-010

# 2. Service repond
kubectl run test --image=busybox --rm -it --restart=Never -n exo-010 -- wget -qO- http://app-svc:80
# Doit afficher du HTML
```

## Indice (si tu seches)

`Init:0/1` veut dire qu'un init container est encore en train de tourner (ou en echec)
et que le container principal n'a pas demarre. Pour voir ses logs :

```bash
kubectl logs <pod> -n exo-010 -c <nom-init-container>
```

Le nom du init container se trouve dans `kubectl describe pod`.
