# 06 — Reseau et Services

> **Objectif** : Comprendre comment les pods communiquent entre eux et comment le trafic arrive de l'exterieur.

---

## Le modele reseau de K8s

### Regle fondamentale : reseau flat

```
Pod A (10.244.1.5)  →  peut parler a  →  Pod B (10.244.2.8)
        ↑                                       ↑
   Worker Node 1                          Worker Node 2
```

Chaque pod a sa propre IP. Tous les pods peuvent se contacter directement **sans NAT**, meme s'ils sont sur des nodes differents.

C'est le CNI (Container Network Interface) qui implemente ca. Les CNI courants :
- **Calico** — le plus utilise en prod, supporte les Network Policies
- **Cilium** — moderne, base sur eBPF, performant
- **Flannel** — simple, bon pour debuter

### Probleme : les IPs de pods sont ephemeres

Un pod qui redmarre = nouvelle IP. Tu ne peux pas hardcoder les IPs dans ta config.

Solution : les **Services**.

---

## Service — IP et DNS stables

Un Service donne une adresse stable devant un groupe de pods :

```
Service "api-svc" (IP: 10.96.45.12)
    │
    │  selector: app=api
    │
    ├── Pod A (10.244.1.5)   ← IP peut changer
    ├── Pod B (10.244.1.6)   ← IP peut changer
    └── Pod C (10.244.2.8)   ← IP peut changer
```

L'IP du Service ne change jamais tant que le Service existe.

---

## Les 4 types de Service

### ClusterIP (defaut) — interne uniquement

```
┌─── Cluster ──────────────────────────┐
│                                      │
│  Pod client                          │
│    curl http://api-svc:80            │
│      │                               │
│      ▼                               │
│  Service "api-svc" (ClusterIP)       │
│      │                               │
│      ├── Pod api-1                   │
│      └── Pod api-2                   │
│                                      │
│  ✗ Pas accessible depuis l'exterieur │
└──────────────────────────────────────┘
```

**Usage** : communication entre microservices dans le cluster.

### NodePort — expose sur chaque node

```
Exterieur
  │
  │  http://<IP-du-node>:31234
  │
  ▼
┌─── Cluster ──────────────────────────┐
│                                      │
│  Service (NodePort: 31234)           │
│      │                               │
│      ├── Pod 1                       │
│      └── Pod 2                       │
└──────────────────────────────────────┘
```

- K8s ouvre un port entre 30000 et 32767 sur **chaque** node
- Accessible depuis l'exterieur via `<IP-de-n'importe-quel-node>:<NodePort>`
- **Usage** : dev, test, acces direct basique

### LoadBalancer — le standard en prod

```
Internet
  │
  │  http://mon-domaine.com
  │
  ▼
┌─── Load Balancer Cloud (AWS ALB, GCP LB) ─┐
│                                             │
│  Repartit le trafic entre les nodes         │
│                                             │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─── Cluster ──────────────────────────┐
│                                      │
│  Service (LoadBalancer)              │
│      │                               │
│      ├── Pod 1                       │
│      ├── Pod 2                       │
│      └── Pod 3                       │
└──────────────────────────────────────┘
```

- K8s demande au cloud provider de creer un load balancer
- Le LB recoit une IP publique
- **Usage** : production, exposition de services aux utilisateurs

**Cout** : Chaque Service LoadBalancer = 1 load balancer cloud = facturation. Pour exposer plusieurs services, utilise un **Ingress** a la place.

### ExternalName — alias DNS

Redirige vers un service externe. Pas de proxy, juste un alias DNS.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ma-bdd
spec:
  type: ExternalName
  externalName: db.example.com    # redirige vers cette adresse
```

---

## DNS interne — CoreDNS

K8s inclut un serveur DNS (CoreDNS). Chaque Service est automatiquement enregistre :

```bash
# Depuis n'importe quel pod du MEME namespace :
curl http://mon-service

# Depuis un AUTRE namespace :
curl http://mon-service.autre-namespace

# Forme complete (FQDN) :
curl http://mon-service.mon-namespace.svc.cluster.local
```

**Format DNS** : `<nom-service>.<namespace>.svc.cluster.local`

**Piege** : Si tu es dans le namespace `staging` et tu veux appeler un service dans `production`, tu DOIS specifier le namespace :
```bash
curl http://api-svc.production        # OK
curl http://api-svc                   # Non — cherche dans staging
```

---

## Les ports — comment ca circule

```
EXTERIEUR          SERVICE            CONTENEUR
(navigateur)       (cluster)          (ton app)

:31234       →     :80          →     :3000
(NodePort)         (port)             (targetPort)
```

| Port | Definition | Qui le controle |
|---|---|---|
| **nodePort** | Port sur le node (30000-32767) | K8s l'assigne ou tu le choisis |
| **port** | Port du Service dans le cluster | Tu le definis |
| **targetPort** | Port ou ton app ecoute | Doit matcher le code de ton app |

**Le piege le plus courant** : `targetPort` ne correspond pas au port sur lequel ton app ecoute reellement. Resultat : le Service envoie le trafic au mauvais endroit, connexion refusee.

---

## Endpoints — la preuve que le Service fonctionne

Les EndpointSlices sont la liste des IPs de pods vers lesquels le Service route le trafic.

```bash
# Depuis K8s 1.33+, utilise EndpointSlice (endpoints est deprecie) :
kubectl get endpointslices -l kubernetes.io/service-name=mon-service
# NAME                ADDRESSTYPE   PORTS   ENDPOINTS                       AGE
# mon-service-abc12   IPv4          3000    10.244.1.5,10.244.1.6           5m

# Si la colonne ENDPOINTS est vide → le selector du Service ne matche aucun pod !
```

**Reflexe de debug** : Service injoignable ? Verifie les EndpointSlices en premier.

---

## Network Policies — le firewall de K8s

Par defaut, tous les pods peuvent parler a tous les pods. Les Network Policies permettent de restreindre ca.

```yaml
# Exemple : seuls les pods avec label "role: frontend" 
# peuvent acceder aux pods "role: api"
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-allow-frontend
spec:
  podSelector:
    matchLabels:
      role: api
  ingress:
  - from:
    - podSelector:
        matchLabels:
          role: frontend
    ports:
    - port: 80
```

**Important** : Les Network Policies ne fonctionnent que si ton CNI les supporte (Calico, Cilium = oui ; Flannel = non).

---

## Ingress — un point d'entree unique pour plusieurs services

Au lieu de creer un LoadBalancer par service, un Ingress gere le routage HTTP :

```
Internet
  │
  ▼
┌─── Ingress Controller (nginx, traefik...) ───┐
│                                                │
│  /api/*     →  Service api-svc                 │
│  /web/*     →  Service web-svc                 │
│  /admin/*   →  Service admin-svc               │
│                                                │
└────────────────────────────────────────────────┘
```

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mon-ingress
spec:
  rules:
  - host: mon-domaine.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-svc
            port:
              number: 80
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-svc
            port:
              number: 80
```

**Prerequis** : Un Ingress Controller doit etre installe dans le cluster (nginx-ingress, traefik, etc.). L'objet Ingress seul ne fait rien sans controller.

---

## Resume : quel type de Service utiliser ?

```
Communication interne entre services ?     →  ClusterIP
Test rapide en local ?                     →  NodePort
Exposer en prod ?                          →  LoadBalancer ou Ingress
Plusieurs services HTTP derriere un domaine ? →  Ingress
Pointer vers un service externe ?          →  ExternalName
```
