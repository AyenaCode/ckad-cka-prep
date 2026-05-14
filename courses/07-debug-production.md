# 07 — Debug en production : ce qui casse et comment intervenir

> **Objectif** : Identifier les problemes courants, savoir ou chercher, et reparer rapidement. Ce chapitre est ton guide de survie en prod.

---

## Methode de debug universelle

Quand quelque chose ne marche pas, suis toujours cet ordre :

```
1. kubectl get pods -o wide            → quel est le STATUS ?
2. kubectl describe pod <nom>          → regarde "Events:" tout en bas
3. kubectl logs <nom>                  → qu'est-ce que l'app dit ?
4. kubectl get events --sort-by='.lastTimestamp'  → que s'est-il passe ?
```

**Les Events dans `describe` sont ta mine d'or.** Ils racontent exactement ce qui s'est passe dans l'ordre chronologique.

---

## Les status de pods — ce qu'ils signifient

| Status | Signification | Gravite |
|---|---|---|
| **Running** | Le pod tourne normalement | OK |
| **Pending** | Le pod attend d'etre planifie sur un node | Bloquant |
| **ContainerCreating** | L'image est en cours de pull | Normal (temporaire) |
| **CrashLoopBackOff** | Le conteneur plante en boucle, K8s attend avant de relancer | Critique |
| **Error** | Le conteneur a quitte avec une erreur | Critique |
| **ImagePullBackOff** | Impossible de telecharger l'image | Bloquant |
| **ErrImagePull** | Echec du pull de l'image | Bloquant |
| **OOMKilled** | Le conteneur a depasse sa limite memoire | Critique |
| **Evicted** | Le node a expulse le pod (manque de ressources) | A investiguer |
| **Terminating** | Le pod est en cours de suppression | Normal |
| **Unknown** | Le node ne repond plus | Critique |

---

## Probleme 1 : Pod en CrashLoopBackOff

**Symptome** : Le pod demarre, crash, K8s le relance, il recrash — en boucle.

```bash
# 1. Voir les logs du crash
kubectl logs <pod>

# 2. Si le pod crash trop vite pour lire les logs, voir le crash precedent
kubectl logs <pod> --previous

# 3. Causes frequentes
```

| Cause | Comment verifier |
|---|---|
| L'app plante au demarrage | `kubectl logs <pod>` → erreur dans le code |
| Variable d'environnement manquante | `kubectl logs <pod>` → "env var X not set" |
| Fichier de config manquant | `kubectl describe pod <pod>` → montage de ConfigMap/Secret |
| Port deja utilise | `kubectl logs <pod>` → "address already in use" |
| Commande de demarrage incorrecte | `kubectl describe pod <pod>` → "Command:" |
| Liveness probe trop agressive | L'app n'a pas le temps de demarrer → K8s la tue |

**Action** :
```bash
# Voir le dernier crash
kubectl logs <pod> --previous

# Si l'image demarre mais crash immediatement, entrer dans le pod
# avec une commande qui ne crash pas
kubectl run debug --image=<meme-image> --rm -it --restart=Never -- sh
```

---

## Probleme 2 : Pod en Pending

**Symptome** : Le pod reste en Pending indefiniment.

```bash
kubectl describe pod <pod>
# Regarde Events: en bas
```

| Cause (dans Events) | Solution |
|---|---|
| `Insufficient cpu` / `Insufficient memory` | Les nodes n'ont plus assez de ressources. Scaler les nodes ou reduire les requests. |
| `0/3 nodes are available` | Tous les nodes sont satures ou ont des taints. |
| `no nodes match pod topology spread constraints` | Contrainte d'affinite/anti-affinite non satisfaite. |
| `persistentvolumeclaim "X" not found` | Le PVC demande n'existe pas. Le creer. |
| `node(s) had taint` | Le node a un taint que le pod ne tolere pas. |

**Actions** :
```bash
# Voir les ressources disponibles sur les nodes
kubectl describe nodes | grep -A5 "Allocated resources"

# Voir les taints des nodes
kubectl describe nodes | grep Taints
```

---

## Probleme 3 : ImagePullBackOff / ErrImagePull

**Symptome** : K8s n'arrive pas a telecharger l'image Docker.

```bash
kubectl describe pod <pod>
# Events:
#   Failed to pull image "user/mon-app:v99": ... not found
```

| Cause | Solution |
|---|---|
| Nom d'image incorrect | Verifier l'orthographe exacte, le tag existe |
| Tag inexistant | `docker pull user/mon-app:v99` en local pour verifier |
| Registry prive sans authentification | Creer un imagePullSecret |
| Registry injoignable | Verifier la connectivite reseau du node |

**Action pour un registry prive** :
```bash
# Creer le secret d'authentification
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=user \
  --docker-password=pass

# L'ajouter au Deployment
# spec.template.spec.imagePullSecrets:
# - name: regcred
```

---

## Probleme 4 : OOMKilled

**Symptome** : Le pod est tue parce qu'il consomme trop de memoire.

```bash
kubectl describe pod <pod>
# Last State: Terminated
#   Reason: OOMKilled
#   Exit Code: 137
```

**Actions** :
```bash
# Voir la limite memoire actuelle
kubectl describe pod <pod> | grep -A2 "Limits:"

# Voir la consommation reelle
kubectl top pod <pod>
```

| Solution |
|---|
| Augmenter la limite memoire dans le Deployment |
| Chercher une fuite memoire dans l'application |
| Ajouter le flag `--max-old-space-size` pour Node.js |

---

## Probleme 5 : Service injoignable

**Symptome** : `curl http://mon-service:80` ne repond pas ou timeout.

```bash
# 1. Le Service existe ?
kubectl get svc mon-service

# 2. Les EndpointSlices sont-ils remplis ?
kubectl get endpointslices -l kubernetes.io/service-name=mon-service
# Si vide → le selector ne matche aucun pod

# 3. Verifier le selector du Service
kubectl describe svc mon-service
# Selector: app=mon-app

# 4. Verifier les labels des pods
kubectl get pods --show-labels
# Les labels matchent-ils le selector ?
```

**Cause la plus frequente** : Le selector du Service ne correspond pas aux labels des pods. Cela arrive souvent quand :
- Tu as renomme les labels dans le Deployment sans mettre a jour le Service
- Tu as cree le Service manuellement avec un mauvais selector

**Test depuis l'interieur du cluster** :
```bash
# Lancer un pod de debug
kubectl run debug --image=busybox --rm -it --restart=Never -- sh

# Depuis le pod de debug :
wget -qO- http://mon-service:80
nslookup mon-service
```

---

## Probleme 6 : Node NotReady

**Symptome** : Un node passe en status NotReady.

```bash
kubectl get nodes
# NAME       STATUS     ROLES    AGE   VERSION
# worker-1   Ready      <none>   10d   v1.29
# worker-2   NotReady   <none>   10d   v1.29

kubectl describe node worker-2
# Conditions:
#   Ready   False   KubeletNotReady   ...
```

| Cause | Action |
|---|---|
| kubelet plante | SSH sur le node, `systemctl status kubelet`, regarder les logs |
| Node sature (CPU/RAM a 100%) | `kubectl top node`, identifier les pods gourmands |
| Disque plein | SSH, `df -h`, nettoyer |
| Reseau coupe | Verifier la connectivite entre le node et le Control Plane |

**Impact** : Les pods sur un node NotReady ne sont pas immediatement supprimes. K8s attend ~5 minutes (pod-eviction-timeout) avant de les replanifier ailleurs. Pendant ce temps, ces pods sont injoignables.

---

## Probleme 7 : Deploiement bloque

**Symptome** : `kubectl rollout status` reste bloque, les nouveaux pods ne deviennent jamais Ready.

```bash
# Voir ou ca bloque
kubectl rollout status deployment/mon-app
# Waiting for deployment "mon-app" rollout to finish: 1 out of 3 new replicas have been updated...

# Verifier les pods du nouveau ReplicaSet
kubectl get pods
# Les nouveaux pods sont en CrashLoopBackOff ? ImagePullBackOff ?
```

**Action immediate** :
```bash
# Rollback !
kubectl rollout undo deployment/mon-app

# Puis diagnostique le probleme sur les nouveaux pods
kubectl logs <pod-qui-crash> --previous
```

---

## Probleme 8 : Pods Evicted

**Symptome** : Des pods sont Evicted sur un node.

```bash
kubectl get pods | grep Evicted
```

**Cause** : Le node manque de ressources (disque, memoire). Le kubelet evicte des pods pour proteger le node.

**Actions** :
```bash
# Nettoyer les pods Evicted (ils ne se suppriment pas seuls)
kubectl delete pods --field-selector=status.phase=Failed

# Verifier les ressources du node
kubectl describe node <node> | grep -A5 "Conditions:"
```

---

## Reflexes de production

### Avant d'intervenir

```bash
# Toujours savoir ou tu es
kubectl config current-context       # quel cluster ?
kubectl config get-contexts          # liste les contextes

# Ne jamais faire de operations destructives sans verifier le contexte
# Un "kubectl delete" sur le mauvais cluster = catastrophe
```

### Commandes de premiere urgence

```bash
# Vue d'ensemble rapide
kubectl get pods -A | grep -v Running    # tout ce qui n'est pas Running
kubectl get nodes                        # tous les nodes sont Ready ?
kubectl get events --sort-by='.lastTimestamp' | tail -20  # events recents

# Si un service est down
kubectl get endpointslices -l kubernetes.io/service-name=<service>  # le service voit-il des pods ?
kubectl describe svc <service>           # selector correct ?
kubectl get pods -l app=<label>          # les pods cibles existent ?
```

### Les logs qui comptent

```bash
# Logs de l'app
kubectl logs <pod> -f                    # en temps reel
kubectl logs <pod> --previous            # le crash precedent
kubectl logs <pod> --since=5m            # les 5 dernieres minutes
kubectl logs <pod> -c <conteneur>        # conteneur specifique

# Si tu as plusieurs pods, voir les logs de tous d'un coup
kubectl logs -l app=mon-app --all-containers
```

---

## Arbre de decision : mon app ne marche pas

```
L'app ne repond pas
  │
  ├─ Les pods tournent ?
  │   ├─ Non → kubectl describe pod (voir Events)
  │   │   ├─ Pending → ressources insuffisantes / taints
  │   │   ├─ CrashLoopBackOff → kubectl logs --previous
  │   │   ├─ ImagePullBackOff → nom d'image / registry / auth
  │   │   └─ OOMKilled → augmenter limits memoire
  │   │
  │   └─ Oui, Running
  │       │
  │       ├─ L'app repond dans le pod ?
  │       │   kubectl exec <pod> -- curl localhost:<port>
  │       │   ├─ Non → probleme applicatif (logs)
  │       │   └─ Oui → probleme reseau
  │       │
  │       └─ Le Service route correctement ?
  │           kubectl get endpointslices -l kubernetes.io/service-name=<svc>
  │           ├─ Vide → selector ne matche pas les labels
  │           └─ Rempli → verifier NodePort/LB/Ingress
  │
  └─ Les nodes sont Ready ?
      kubectl get nodes
      ├─ Non → SSH, verifier kubelet, disque, reseau
      └─ Oui → le probleme est ailleurs (DNS, Ingress, LB cloud)
```

---

## Tableau recapitulatif

| Symptome | Premiere commande | Cause probable |
|---|---|---|
| Pod CrashLoopBackOff | `kubectl logs <pod> --previous` | App crash au demarrage |
| Pod Pending | `kubectl describe pod <pod>` | Pas de ressources / taints |
| Pod ImagePullBackOff | `kubectl describe pod <pod>` | Image introuvable / auth |
| Pod OOMKilled | `kubectl top pod <pod>` | Limite memoire depassee |
| Service timeout | `kubectl get endpointslices -l kubernetes.io/service-name=<svc>` | Selector ne matche pas |
| Node NotReady | `kubectl describe node <node>` | kubelet / reseau / disque |
| Deploiement bloque | `kubectl rollout undo` | Nouvelle version cassee |
| Pods Evicted | `kubectl describe node` | Node sature |

---

> **Conseil d'experience** : En production, la vitesse de diagnostic compte autant que la solution. Apprends a lire les Events et les logs rapidement. 80% des problemes se diagnostiquent avec `describe` + `logs` + `endpointslices`.
