# 01 — Architecture Kubernetes

> **Objectif** : Comprendre comment K8s est construit pour savoir *où chercher* quand quelque chose casse.

---

## K8s en une phrase

Kubernetes déploie, scale et maintient en vie tes applications conteneurisées — automatiquement.

Tu décris ce que tu veux. K8s s'assure que c'est toujours le cas.

---

## Les deux zones du cluster

```
┌─────────────────────────────────────────────────────────────┐
│                        CLUSTER K8S                          │
│                                                             │
│   ┌──────────────────────┐   ┌──────────────────────────┐  │
│   │    CONTROL PLANE     │   │      DATA PLANE          │  │
│   │   (le cerveau)       │   │   (les muscles)          │  │
│   │                      │   │                          │  │
│   │  API Server          │   │  Worker Node 1           │  │
│   │  etcd                │   │  Worker Node 2           │  │
│   │  Scheduler           │   │  Worker Node N           │  │
│   │  Controller Manager  │   │                          │  │
│   └──────────────────────┘   └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Regle fondamentale** : Le Control Plane decide. Les Worker Nodes executent. Tout le monde passe par l'API Server — c'est le seul point d'entree.

---

## Control Plane — composant par composant

### API Server (`kube-apiserver`)

La porte d'entree unique du cluster. Tout passe par lui : kubectl, le CI/CD, les autres composants internes.

```
kubectl apply -f app.yaml
        │
        ▼
   API Server  ←→  etcd (sauvegarde l'etat)
        │
        ▼
   Scheduler  →  kubelet (sur le Worker Node)
```

Ce qu'il fait :
- Expose une API REST en HTTPS
- Authentifie et autorise chaque requete
- Persiste l'etat dans etcd
- Notifie les autres composants des changements (via le mecanisme de watch)

**En prod, si l'API Server est down** : tu ne peux plus rien piloter (`kubectl` ne repond plus), mais les pods deja en cours continuent de tourner.

### etcd

La memoire du cluster. Base de donnees cle-valeur distribuee qui stocke TOUT l'etat.

```
Exemples de cles :
  /registry/pods/default/mon-pod         → etat d'un pod
  /registry/deployments/default/mon-app  → etat d'un deployment
  /registry/nodes/worker-1               → etat d'un node
```

**Point critique en prod** :
- Si etcd meurt → le cluster perd la memoire. Les pods continuent de tourner, mais plus aucune operation n'est possible.
- etcd doit etre sauvegarde regulierement (snapshots). C'est la donnee la plus importante du cluster.
- En production, etcd tourne en cluster de 3 ou 5 membres pour la haute disponibilite.

### Scheduler (`kube-scheduler`)

Decide sur quel Worker Node placer un nouveau pod.

```
Algorithme :
  1. Filtre  → quels nodes ont assez de CPU/RAM ?
  2. Score   → lequel est le plus adapte (le moins charge, affinite, etc.) ?
  3. Binding → assigne le pod au node gagnant
```

**Important** : Le Scheduler ne lance pas les pods. Il decide juste *ou*. C'est le kubelet du node cible qui fait le travail.

### Controller Manager (`kube-controller-manager`)

Le gardien de l'etat desire. Il contient des dizaines de controllers qui tournent en boucle infinie :

```
Deployment Controller :
  Etat desire  : 3 replicas
  Etat actuel  : 2 replicas (un pod a crashe)
  Action       : cree 1 nouveau pod

Node Controller :
  Etat desire  : tous les nodes repondent
  Etat actuel  : worker-3 ne repond plus depuis 5 min
  Action       : marque le node NotReady, replanifie les pods
```

C'est le principe fondamental de K8s : la **boucle de reconciliation** — desired state vs actual state, en permanence.

---

## Worker Node — composant par composant

```
┌─────────────────────────────────────────────┐
│              WORKER NODE                    │
│                                             │
│  kubelet      ←  recoit les ordres          │
│  kube-proxy   ←  gere le reseau             │
│  container runtime (containerd)             │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Pod A   │  │  Pod B   │  │  Pod C   │  │
│  │ [cont 1] │  │ [cont 1] │  │ [cont 1] │  │
│  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────┘
```

### kubelet

L'agent K8s sur chaque node. Il :
- Recoit les specs de pods de l'API Server (via watch)
- Demande au container runtime de demarrer/stopper les conteneurs
- Remonte l'etat des pods a l'API Server (Running, Failed, etc.)
- Execute les health checks (liveness/readiness probes)

**En prod** : Si le kubelet d'un node plante, les pods sur ce node ne sont plus surveilles. Au bout d'un timeout (~5 min par defaut), le Control Plane marque le node NotReady et replanifie les pods ailleurs.

### kube-proxy

Le reseau entre les pods et les Services. Il :
- Maintient les regles iptables/IPVS sur le node
- Redirige le trafic vers le bon pod quand tu appelles un Service
- Permet que `curl mon-service:80` fonctionne depuis n'importe quel pod

### Container Runtime

Lance les conteneurs pour de vrai. K8s supporte :
- **containerd** — le standard actuel
- **CRI-O** — alternative legere
- Docker en tant que runtime est deprecie depuis K8s 1.24 (les images Docker fonctionnent toujours, c'est le daemon Docker qui n'est plus utilise)

---

## La boucle de reconciliation — le coeur de K8s

```
┌─────────────────────────────────────────────────────┐
│            BOUCLE DE RECONCILIATION                 │
│                                                     │
│   Watch(etcd) → Compare → Act → Report → Watch...  │
│                                                     │
│  Deployment Controller : 3 pods desires ? 3 ok ?    │
│  Node Controller       : node OK ? heartbeat ?      │
│  Service Controller    : endpoints a jour ?          │
└─────────────────────────────────────────────────────┘
```

K8s ne "configure" pas une fois — il **surveille en permanence** et **corrige** tout ecart. C'est ce qui fait que :
- Un pod qui crash est recree automatiquement
- Un node qui tombe voit ses pods replaces sur d'autres nodes
- Un scaling est applique en continu jusqu'a atteindre le nombre desire

---

## Cycle de vie d'un `kubectl apply` — de bout en bout

```
Tu tapes : kubectl apply -f deployment.yaml
                    │
                    ▼
          ┌─────────────────┐
          │   API Server    │  ← valide le YAML, authentifie
          └────────┬────────┘
                   │ sauvegarde dans etcd
                   ▼
          ┌─────────────────┐
          │   Deployment    │  ← Controller Manager voit le nouveau
          │   Controller    │    deployment, cree un ReplicaSet
          └────────┬────────┘
                   ▼
          ┌─────────────────┐
          │  ReplicaSet     │  ← cree N objets Pod dans etcd
          │  Controller     │    (status: Pending)
          └────────┬────────┘
                   ▼
          ┌─────────────────┐
          │   Scheduler     │  ← voit des pods Pending sans node
          └────────┬────────┘    assigne chaque pod a un Worker
                   ▼
          ┌─────────────────┐
          │  kubelet        │  ← sur le Worker assigne, pull l'image
          │  (Worker Node)  │    et demarre le conteneur
          └────────┬────────┘
                   ▼
          ┌─────────────────┐
          │  Pod Running    │  ← kubelet remonte le status
          └─────────────────┘    etcd est mis a jour
```

**Temps total** : quelques secondes si l'image est deja en cache sur le node.

---

## Schema global

```
┌──────────────────────────────────────────────────────────────────┐
│                           CLUSTER                                │
│                                                                  │
│  ┌────────────────────────────┐                                  │
│  │       CONTROL PLANE        │                                  │
│  │                            │                                  │
│  │  ┌──────────────────────┐  │                                  │
│  │  │     API Server       │◄─┼──── kubectl / CI/CD             │
│  │  └──────────┬───────────┘  │                                  │
│  │             │              │                                  │
│  │  ┌──────────▼───────────┐  │                                  │
│  │  │        etcd          │  │  ← source de verite             │
│  │  └──────────────────────┘  │                                  │
│  │                            │                                  │
│  │  ┌──────────────────────┐  │                                  │
│  │  │  Controller Manager  │  │  ← boucles de reconciliation    │
│  │  └──────────────────────┘  │                                  │
│  │                            │                                  │
│  │  ┌──────────────────────┐  │                                  │
│  │  │     Scheduler        │  │  ← placement des pods           │
│  │  └──────────────────────┘  │                                  │
│  └────────────────────────────┘                                  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Worker Node 1│  │ Worker Node 2│  │ Worker Node N│           │
│  │              │  │              │  │              │           │
│  │  kubelet     │  │  kubelet     │  │  kubelet     │           │
│  │  kube-proxy  │  │  kube-proxy  │  │  kube-proxy  │           │
│  │  containerd  │  │  containerd  │  │  containerd  │           │
│  │              │  │              │  │              │           │
│  │  [Pod][Pod]  │  │  [Pod][Pod]  │  │  [Pod]       │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└──────────────────────────────────────────────────────────────────┘
```

---

## A retenir absolument

| Composant | Role | Si ca tombe ? |
|---|---|---|
| **API Server** | Porte d'entree unique | Plus de pilotage, pods continuent |
| **etcd** | Memoire du cluster | Perte d'etat, pods continuent |
| **Scheduler** | Place les pods | Nouveaux pods restent Pending |
| **Controller Manager** | Reconciliation | Pas de self-healing, pas de scaling |
| **kubelet** | Agent sur chaque node | Pods du node non surveilles |
| **kube-proxy** | Reseau Services | Services injoignables sur ce node |

> **Principe cle** : K8s est declaratif. Tu decris *ce que tu veux*, pas *comment le faire*. La boucle de reconciliation fait le reste — en permanence, indefiniment.
