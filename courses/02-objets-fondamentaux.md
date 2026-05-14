# 02 — Les objets fondamentaux de Kubernetes

> **Objectif** : Connaitre chaque brique, son role, et comment elles s'assemblent.

---

## Vue d'ensemble

```
Namespace (isolation logique)
  │
  ├── Deployment (gere les replicas)
  │     └── ReplicaSet (cree par le Deployment — tu n'y touches jamais directement)
  │           └── Pod (1 conteneur = 1 app)
  │
  ├── Service (IP stable pour acceder aux Pods)
  │
  ├── ConfigMap (configuration non-sensible)
  │
  └── Secret (configuration sensible)
```

---

## Pod — l'unite minimale

Un Pod = 1 ou plusieurs conteneurs qui partagent le meme reseau et le meme stockage.

```
┌──────────────┐
│     Pod      │
│  ┌────────┐  │
│  │ cont 1 │  │  ← ton app (ex: nginx, node, python)
│  └────────┘  │
│  IP: 10.244.1.5
│  Port: 3000
└──────────────┘
```

**Regles** :
- 1 pod = 1 app (dans 95% des cas)
- Un pod est **ephemere** : il peut etre detruit et recree a tout moment
- Ne cree jamais un pod seul — utilise un Deployment

**Pourquoi pas un pod seul ?** Si un pod seul crash, personne ne le recree. Un Deployment surveille et recree automatiquement.

---

## Deployment — le chef de chantier

Le Deployment dit a K8s : "Je veux N copies de mon app, toujours en vie."

```
Deployment "mon-app" (replicas: 3)
    │
    └── ReplicaSet (cree automatiquement)
          ├── Pod 1  ✓  Running
          ├── Pod 2  ✓  Running
          └── Pod 3  ✓  Running
```

Ce que le Deployment gere pour toi :
- **Nombre de replicas** — si un pod meurt, il en recree un
- **Rolling updates** — mise a jour sans downtime
- **Rollback** — retour a une version precedente
- **Historique** — garde les anciennes versions (ReplicaSets)

### YAML minimal d'un Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mon-app
spec:
  replicas: 3                     # combien d'instances
  selector:
    matchLabels:
      app: mon-app                # DOIT matcher template.labels
  template:
    metadata:
      labels:
        app: mon-app              # label applique a chaque pod
    spec:
      containers:
      - name: mon-app
        image: nginx:1.25         # JAMAIS :latest en prod
        ports:
        - containerPort: 80
```

**Piege classique** : `selector.matchLabels` DOIT correspondre exactement a `template.metadata.labels`. Si ca ne matche pas, le Deployment ne trouvera jamais ses pods.

**Regle en prod** : Ne jamais utiliser `:latest` comme tag d'image. Toujours une version precise (`nginx:1.25`, `mon-app:v2.3.1`). Sinon tu ne sais jamais quelle version tourne.

---

## Service — l'adresse stable

Les pods ont des IPs ephemeres (un pod redeploye = nouvelle IP). Le Service donne une **IP et un nom DNS stables** devant un groupe de pods.

```
Service "mon-app-svc" (IP: 10.96.45.12)
    │
    │  selector: app=mon-app  ← cible les pods avec ce label
    │
    ├── Pod 1 (10.244.1.5:80)
    ├── Pod 2 (10.244.1.6:80)
    └── Pod 3 (10.244.2.8:80)
```

### YAML minimal d'un Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mon-app-svc
spec:
  selector:
    app: mon-app              # pointe vers les pods du Deployment
  ports:
  - port: 80                  # port du Service (dans le cluster)
    targetPort: 80            # port du conteneur
  type: ClusterIP             # interne au cluster (defaut)
```

### Les types de Service

| Type | Accessible depuis | Cas d'usage |
|---|---|---|
| **ClusterIP** | Uniquement dans le cluster | Communication entre services internes |
| **NodePort** | Exterieur via `<IP-node>:<port>` (30000-32767) | Dev/test, acces direct simple |
| **LoadBalancer** | Exterieur via un LB cloud | **Production** (AWS ALB/NLB, GCP LB) |
| **ExternalName** | Alias DNS vers un service externe | Rediriger vers une BDD externe |

**En prod** : ClusterIP pour tout ce qui est interne, LoadBalancer (ou Ingress) pour ce qui est expose a l'exterieur.

---

## Labels et Selectors — la colle universelle

K8s ne relie pas les objets par des IDs. Il utilise des **labels** (cle/valeur) et des **selectors** (filtres).

```
Deployment                     Service
─────────                      ───────
template:                      selector:
  labels:                        app: mon-app  ← matche !
    app: mon-app ──────────────────────────────┘
```

**C'est le mecanisme le plus important a comprendre.** Si le selector du Service ne matche pas les labels des pods, le Service ne route vers rien. C'est le piege numero 1.

Pour verifier :
```bash
# Depuis K8s 1.33+, "endpoints" est deprecie. Utilise EndpointSlice :
kubectl get endpointslices -l kubernetes.io/service-name=mon-app-svc

# Ancienne commande (fonctionne encore mais affiche un warning) :
# kubectl get endpoints mon-app-svc

# Si la liste est vide → le selector ne matche aucun pod
```

---

## Namespace — l'isolation logique

Un namespace est un espace de noms qui isole les ressources les unes des autres.

```
Cluster
├── default          ← si tu ne precises rien (evite en prod)
├── kube-system      ← composants K8s internes (NE PAS TOUCHER)
├── kube-public      ← ressources publiques du cluster
├── production       ← tes apps en prod
└── staging          ← tes apps en staging
```

**Bonne pratique** : Ne jamais deployer dans `default` en production. Creer des namespaces par environnement ou par equipe.

```bash
kubectl create namespace production
kubectl get pods -n production        # lister les pods d'un namespace
kubectl get pods --all-namespaces     # tout voir (raccourci : -A)
```

---

## ConfigMap — configuration non-sensible

Stocke de la configuration sous forme cle/valeur, injectee dans les pods comme variables d'environnement ou fichiers.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  DATABASE_HOST: "postgres.production.svc.cluster.local"
  LOG_LEVEL: "info"
  MAX_CONNECTIONS: "100"
```

Utilisation dans un Deployment :
```yaml
spec:
  containers:
  - name: mon-app
    envFrom:
    - configMapRef:
        name: app-config    # toutes les cles deviennent des env vars
```

---

## Secret — configuration sensible

Meme principe que ConfigMap, mais pour les donnees sensibles (mots de passe, tokens, cles API).

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
data:
  DB_PASSWORD: cGFzc3dvcmQxMjM=    # base64 encode (PAS du chiffrement)
  API_KEY: bXktc2VjcmV0LWtleQ==
```

**Attention** : Les Secrets K8s sont encodes en base64, pas chiffres. N'importe qui avec acces au namespace peut les lire. En prod, utilise un gestionnaire de secrets externe (Vault, AWS Secrets Manager, etc.) ou active le chiffrement at-rest d'etcd.

```bash
# Creer un secret en imperatif
kubectl create secret generic app-secrets \
  --from-literal=DB_PASSWORD=password123

# Lire un secret (decode base64)
kubectl get secret app-secrets -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
```

---

## Comment tout s'assemble

```
┌─ Namespace "production" ───────────────────────────────────┐
│                                                            │
│  ConfigMap "app-config"                                    │
│    DATABASE_HOST=postgres.production.svc.cluster.local     │
│                    │                                       │
│                    │ injecte dans                           │
│                    ▼                                       │
│  Deployment "mon-app" (replicas: 3)                        │
│    │                                                       │
│    ├── Pod 1 [label: app=mon-app]                          │
│    ├── Pod 2 [label: app=mon-app]                          │
│    └── Pod 3 [label: app=mon-app]                          │
│              ▲                                             │
│              │ selector: app=mon-app                        │
│              │                                             │
│  Service "mon-app-svc" (ClusterIP)                         │
│                                                            │
│  Secret "app-secrets"                                      │
│    DB_PASSWORD=***                                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Lexique rapide

| Terme | Definition |
|---|---|
| **Manifest** | Ton fichier YAML qui decrit ce que tu veux |
| **Label** | Tag cle/valeur sur une ressource (`app: mon-app`) |
| **Selector** | Filtre qui cible des ressources via leurs labels |
| **ReplicaSet** | Objet intermediaire entre Deployment et Pods (tu n'y touches pas) |
| **Endpoint** | IP:port d'un pod cible par un Service |
| **Annotation** | Metadata supplementaire (pas utilisee pour le selection) |
