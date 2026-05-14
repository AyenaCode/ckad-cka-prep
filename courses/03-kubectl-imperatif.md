# 03 — kubectl imperatif : les commandes a connaitre par coeur

> **Objectif** : Pouvoir operer un cluster sans ouvrir la documentation. Chaque commande ici doit devenir un reflexe.

---

## Regle d'or

En **dev/urgence** → imperatif (rapide, direct).
En **prod/CI-CD** → declaratif (`kubectl apply -f fichier.yaml`).

L'imperatif est ton outil de pompier. Le declaratif est ton outil d'architecte.

---

## 1. Observer — savoir ce qui tourne

```bash
# Lister les pods du namespace courant
kubectl get pods

# Lister les pods d'un namespace precis
kubectl get pods -n production

# Lister les pods de TOUS les namespaces
kubectl get pods -A

# Tout voir d'un coup (pods, services, deployments)
kubectl get all

# Voir avec plus de details (IP, node, status)
kubectl get pods -o wide

# Surveiller en temps reel (rafraichit automatiquement)
kubectl get pods -w

# Lister les nodes du cluster
kubectl get nodes

# Lister les namespaces
kubectl get namespaces

# Lister les services
kubectl get svc

# Lister les deployments
kubectl get deployments
```

---

## 2. Inspecter — comprendre ce qui se passe

```bash
# Details complets d'un pod (config + Events en bas = ta mine d'or pour debug)
kubectl describe pod <nom-du-pod>

# Details d'un deployment
kubectl describe deployment <nom>

# Details d'un service (verifie Endpoints pour savoir si des pods sont cibles)
kubectl describe svc <nom>

# Details d'un node (capacite, conditions, pods qui tournent dessus)
kubectl describe node <nom-du-node>

# Voir les endpoints d'un service (IP:port des pods cibles)
# Depuis K8s 1.33+, utilise EndpointSlice :
kubectl get endpointslices -l kubernetes.io/service-name=<nom-du-service>

# Voir les events recents du cluster (utile quand tu ne sais pas ou chercher)
kubectl get events --sort-by='.lastTimestamp'

# Events d'un namespace precis
kubectl get events -n production --sort-by='.lastTimestamp'
```

---

## 3. Creer — deployer des ressources

```bash
# Creer un deployment
kubectl create deployment mon-app --image=nginx:1.25

# Creer un deployment avec un nombre de replicas
kubectl create deployment mon-app --image=nginx:1.25 --replicas=3

# Exposer un deployment avec un Service
kubectl expose deployment mon-app --port=80 --target-port=80 --type=ClusterIP

# Exposer en NodePort (acces depuis l'exterieur)
kubectl expose deployment mon-app --port=80 --target-port=3000 --type=NodePort

# Creer un namespace
kubectl create namespace production

# Creer un ConfigMap
kubectl create configmap app-config \
  --from-literal=LOG_LEVEL=info \
  --from-literal=DB_HOST=postgres.svc

# Creer un Secret
kubectl create secret generic app-secrets \
  --from-literal=DB_PASSWORD=motdepasse123

# Creer un ConfigMap depuis un fichier
kubectl create configmap nginx-conf --from-file=nginx.conf
```

---

## 4. Modifier — changer ce qui tourne

```bash
# Scaler un deployment (changer le nombre de replicas)
kubectl scale deployment mon-app --replicas=5

# Mettre a jour l'image d'un deployment (declenche un rolling update)
kubectl set image deployment/mon-app mon-app=nginx:1.26

# Editer une ressource en live (ouvre dans l'editeur)
kubectl edit deployment mon-app

# Ajouter un label a un pod
kubectl label pod mon-pod env=production

# Ajouter une annotation
kubectl annotate deployment mon-app description="App principale"
```

---

## 5. Supprimer — nettoyer

```bash
# Supprimer un pod (sera recree par le Deployment)
kubectl delete pod <nom-du-pod>

# Supprimer un deployment (supprime aussi les pods)
kubectl delete deployment mon-app

# Supprimer un service
kubectl delete svc mon-app-svc

# Supprimer via un fichier YAML
kubectl delete -f deployment.yaml

# Supprimer toutes les ressources d'un namespace (DANGEREUX)
kubectl delete all --all -n staging
```

---

## 6. Debug — diagnostiquer les problemes

```bash
# Voir les logs d'un pod
kubectl logs <nom-du-pod>

# Logs en temps reel (follow)
kubectl logs -f <nom-du-pod>

# Logs d'un conteneur precis (si multi-conteneurs dans un pod)
kubectl logs <nom-du-pod> -c <nom-du-conteneur>

# Logs des N dernieres lignes
kubectl logs --tail=100 <nom-du-pod>

# Logs depuis les X dernieres minutes
kubectl logs --since=5m <nom-du-pod>

# Entrer dans un pod (comme docker exec)
kubectl exec -it <nom-du-pod> -- bash

# Si bash n'est pas dispo (images alpine/distroless)
kubectl exec -it <nom-du-pod> -- sh
kubectl exec -it <nom-du-pod> -- /bin/sh

# Executer une commande sans entrer dans le pod
kubectl exec <nom-du-pod> -- cat /etc/hostname

# Tester la connectivite reseau depuis un pod
kubectl exec <nom-du-pod> -- curl -s http://mon-service:80

# Lancer un pod temporaire pour debug reseau
kubectl run debug --image=busybox --rm -it --restart=Never -- sh

# Copier un fichier depuis/vers un pod
kubectl cp <nom-du-pod>:/app/logs/error.log ./error.log
kubectl cp ./config.json <nom-du-pod>:/app/config.json
```

---

## 7. Rolling update et rollback

```bash
# Voir l'historique des deploiements
kubectl rollout history deployment/mon-app

# Voir les details d'une revision
kubectl rollout history deployment/mon-app --revision=2

# Surveiller un rolling update en cours
kubectl rollout status deployment/mon-app

# Annuler le dernier deploiement (rollback)
kubectl rollout undo deployment/mon-app

# Revenir a une revision precise
kubectl rollout undo deployment/mon-app --to-revision=2

# Mettre en pause un rolling update
kubectl rollout pause deployment/mon-app

# Reprendre un rolling update
kubectl rollout resume deployment/mon-app
```

---

## 8. Declaratif — pour la production et le CI/CD

```bash
# Appliquer un fichier YAML (cree ou met a jour)
kubectl apply -f deployment.yaml

# Appliquer tous les fichiers d'un dossier
kubectl apply -f ./k8s/

# Voir ce qui va changer AVANT d'appliquer (dry-run)
kubectl apply -f deployment.yaml --dry-run=client

# Generer le YAML d'une commande sans l'executer (utile pour creer des templates)
kubectl create deployment mon-app --image=nginx:1.25 --dry-run=client -o yaml

# Exporter le YAML d'une ressource existante
kubectl get deployment mon-app -o yaml
```

---

## 9. Informations sur le cluster

```bash
# Informations generales du cluster
kubectl cluster-info

# Version du client et du serveur
kubectl version

# Voir les ressources API disponibles (utile pour connaitre apiVersion)
kubectl api-resources

# Voir l'utilisation CPU/RAM des nodes
kubectl top nodes

# Voir l'utilisation CPU/RAM des pods
kubectl top pods

# Voir dans quel contexte/cluster tu es
kubectl config current-context

# Lister tous les contextes
kubectl config get-contexts

# Changer de contexte (changer de cluster)
kubectl config use-context mon-autre-cluster
```

---

## Raccourcis utiles

| Ressource | Nom complet | Raccourci |
|---|---|---|
| pods | pods | `po` |
| services | services | `svc` |
| deployments | deployments | `deploy` |
| namespaces | namespaces | `ns` |
| configmaps | configmaps | `cm` |
| secrets | secrets | `secret` |
| nodes | nodes | `no` |
| replicasets | replicasets | `rs` |
| endpointslices | endpointslices | `eps` |

```bash
# Exemples avec raccourcis
kubectl get po -A          # tous les pods
kubectl get svc -n prod    # services du namespace prod
kubectl get deploy         # deployments
kubectl get ns             # namespaces
kubectl get eps -l kubernetes.io/service-name=mon-service  # endpointslices
```

---

## Aide-memoire : les 10 commandes du quotidien

```bash
kubectl get pods -o wide          # 1. Ou sont mes pods ?
kubectl describe pod <nom>        # 2. Pourquoi ca ne marche pas ?
kubectl logs -f <nom>             # 3. Qu'est-ce que l'app dit ?
kubectl get events --sort-by='.lastTimestamp'  # 4. Que s'est-il passe ?
kubectl get svc                   # 5. Mes services sont-ils la ?
kubectl get endpointslices -l kubernetes.io/service-name=<svc>  # 6. Le service voit-il les pods ?
kubectl exec -it <pod> -- sh      # 7. Entrer dans le pod
kubectl scale deploy <nom> --replicas=N  # 8. Plus/moins de pods
kubectl rollout status deploy/<nom>      # 9. Le deploiement est-il fini ?
kubectl rollout undo deploy/<nom>        # 10. Ca casse ? On revient en arriere
```
