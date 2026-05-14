# 04 — Premier deploiement : du code a l'app qui tourne

> **Objectif** : Comprendre le flow complet de deploiement, de la construction de l'image Docker a l'application accessible dans le navigateur.

---

## Le flow complet

```
ton code (server.js, app.py, main.go...)
   │
   ▼
┌─────────────────────────────────┐
│  1. docker build                │  Cree une image a partir du Dockerfile
│     docker build -t hello:v1 .  │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  2. docker push                 │  Envoie l'image sur un registry
│     docker tag hello:v1         │  (Docker Hub, ECR, GCR, etc.)
│       user/hello:v1             │
│     docker push user/hello:v1   │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  3. kubectl create deployment   │  K8s pull l'image depuis le registry
│     my-app --image=user/hello:v1│  et cree les Pods
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  4. kubectl expose deployment   │  Cree un Service qui route le
│     my-app --port=80            │  trafic vers les Pods
│     --target-port=3000          │
│     --type=NodePort             │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  5. minikube service my-app     │  Ouvre le navigateur sur l'URL
│     (en local uniquement)       │
└─────────────────────────────────┘
```

---

## Etape par etape avec verifications

### Etape 1 — Build l'image Docker

```bash
# Dans le dossier contenant le Dockerfile
docker build -t mon-app:v1 .

# Verifier que l'image existe
docker images | grep mon-app
```

### Etape 2 — Push sur un registry

```bash
# Tagger pour Docker Hub (remplace "user" par ton username)
docker tag mon-app:v1 user/mon-app:v1

# Push
docker push user/mon-app:v1
```

**Astuce minikube** : En local, tu peux eviter le push en utilisant le Docker daemon de minikube :
```bash
eval $(minikube docker-env)     # bascule vers le Docker de minikube
docker build -t mon-app:v1 .    # l'image est directement dans minikube
# Puis utilise imagePullPolicy: Never dans ton YAML
```

### Etape 3 — Creer le Deployment

```bash
kubectl create deployment my-app --image=user/mon-app:v1
```

**Verification** :
```bash
kubectl get pods              # STATUS doit etre "Running"
kubectl logs <nom-du-pod>     # L'app doit demarrer sans erreur
```

Si le pod n'est pas Running, voir le chapitre 07-debug-production.

### Etape 4 — Exposer avec un Service

```bash
kubectl expose deployment my-app --port=80 --target-port=3000 --type=NodePort
```

**Verification** :
```bash
kubectl get svc               # Le service doit apparaitre
kubectl get endpointslices -l kubernetes.io/service-name=my-app  # Doit lister les IPs des pods (pas vide !)
```

### Etape 5 — Acceder a l'application

```bash
# En local avec minikube
minikube service my-app       # ouvre le navigateur automatiquement

# Ou manuellement
minikube ip                   # recupere l'IP du node
kubectl get svc my-app        # colonne PORT(S) → ex: 80:31234/TCP
# → http://<minikube-ip>:31234
```

---

## Ce qui se passe a l'interieur du cluster

```
TON NAVIGATEUR
     │
     │  http://192.168.x.x:31234  (NodePort)
     ▼
┌──────────────────────────────────────────────┐
│                WORKER NODE                   │
│                                              │
│  kube-proxy recoit le trafic                 │
│     │                                        │
│     ▼                                        │
│  ┌─────────────────────────────────────┐     │
│  │             SERVICE                 │     │
│  │  port: 80  →  targetPort: 3000      │     │
│  │  selector: app=my-app               │     │
│  └──────────────┬──────────────────────┘     │
│                 │  route vers les pods        │
│                 │  avec le label              │
│                 │  "app: my-app"              │
│     ┌───────────┼───────────┐                │
│     ▼           ▼           ▼                │
│  ┌──────┐   ┌──────┐   ┌──────┐             │
│  │ Pod  │   │ Pod  │   │ Pod  │             │
│  │:3000 │   │:3000 │   │:3000 │             │
│  └──────┘   └──────┘   └──────┘             │
└──────────────────────────────────────────────┘
```

---

## Comprendre les ports

```
EXTERNE          SERVICE            CONTENEUR
(navigateur)     (cluster)          (ton app)

:31234     →     :80          →     :3000
(NodePort)       (--port)           (--target-port)
```

| Port | Ou | Qui le definit |
|---|---|---|
| **NodePort** (31234) | Sur le node, accessible depuis ta machine | K8s l'assigne automatiquement (30000-32767) |
| **port** (80) | Port du Service dans le cluster | Toi, dans `--port` |
| **targetPort** (3000) | Port ou ton app ecoute vraiment | Toi, dans `--target-port` (doit matcher ton code) |

**Piege** : Si ton app ecoute sur le port 3000 et que tu mets `--target-port=80`, le Service envoie le trafic au mauvais port → connexion refusee.

---

## Les labels — la colle automatique

Quand tu fais `kubectl expose`, K8s copie automatiquement les labels du Deployment dans le selector du Service :

```
DEPLOYMENT                    SERVICE
──────────                    ───────
template:                     selector:
  labels:                       app: my-app  ← copie automatique
    app: my-app ─────────────────────────────┘
```

C'est pour ca que la commande `expose` est si courte — elle deduit le lien.

---

## Checklist de verification a chaque deploiement

```bash
# 1. Les pods tournent ?
kubectl get pods
# → Cherche STATUS: Running, READY: 1/1

# 2. Pas d'erreur dans les logs ?
kubectl logs <nom-du-pod>
# → Ton app doit demarrer normalement

# 3. Le Service existe et cible des pods ?
kubectl get svc
kubectl get endpointslices -l kubernetes.io/service-name=my-app
# → La liste des endpoints ne doit PAS etre vide

# 4. En cas de doute, les events racontent tout
kubectl get events --sort-by='.lastTimestamp'
```

---

## Exercice : tester le crash et le self-healing

L'app d'exemple dans `app/` a un endpoint `/error` qui fait planter le pod.

```bash
# Terminal 1 : surveille les pods en temps reel
kubectl get pods -w

# Terminal 2 : provoque le crash
curl http://$(minikube ip):<nodeport>/error

# Observe dans le terminal 1 :
# Running → Error → CrashLoopBackOff → Running
# K8s a recree le pod automatiquement.
# C'est la boucle de reconciliation en action.
```
