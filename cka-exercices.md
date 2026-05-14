# CKA — Exercices pratiques sur kind local

> **Setup** : le cluster kind tourne, la plateforme est déployée dans `courses`.
> Avant chaque exercice : `k config use-context kind-kind`
> Chronomètre : respecte les temps — c'est 2h pour ~17 tâches à l'examen (score passage : 66%).

---

## Comment utiliser ce fichier

1. Lis l'énoncé — **ne regarde pas la solution**
2. Lance le chrono
3. Travaille dans le terminal
4. Vérifie ton résultat toi-même
5. Ensuite seulement : regarde la solution et compare ta méthode

---

## Domaine 1 — Workloads & Scheduling (15%)

### EX-01 — Pod simple avec label `⏱ 3 min`
> Crée un Pod nommé `web` dans le namespace `default` avec l'image `nginx:1.25`.
> Il doit écouter sur le port 80 et avoir le label `tier=frontend`.
> Vérifie qu'il est `Running`.

<details><summary>Solution</summary>

```bash
k run web --image=nginx:1.25 --port=80 --labels=tier=frontend
k get pod web --show-labels
```
</details>

---

### EX-02 — Deployment avec replicas `⏱ 4 min`
> Dans le namespace `staging` (à créer), déploie `app-server` avec 4 replicas de `httpd:2.4`.
> Les pods doivent avoir le label `app=httpd`.

<details><summary>Solution</summary>

```bash
k create ns staging
k create deploy app-server --image=httpd:2.4 --replicas=4 -n staging
k get deploy -n staging
k get pod -n staging --show-labels
```
</details>

---

### EX-03 — Scale + update image + rollback `⏱ 5 min`
> Sur le Deployment `app-server` dans `staging` :
> 1. Scale à 6 replicas
> 2. Update l'image vers `httpd:2.5`
> 3. Constate le rollout
> 4. Rollback à la version précédente
> 5. Vérifie que l'image est revenue

<details><summary>Solution</summary>

```bash
k scale deploy app-server --replicas=6 -n staging
k set image deploy/app-server httpd=httpd:2.5 -n staging
k rollout status deploy/app-server -n staging
k rollout undo deploy/app-server -n staging
k describe deploy app-server -n staging | grep Image
```
</details>

---

### EX-04 — ConfigMap + injection env `⏱ 6 min`
> Crée un ConfigMap `app-config` dans `staging` avec les clés :
> - `LOG_LEVEL=debug`
> - `MAX_CONN=100`
>
> Modifie `app-server` pour injecter toutes les clés comme variables d'environnement.
> Vérifie qu'un pod reçoit bien les variables.

<details><summary>Solution</summary>

```bash
k create cm app-config --from-literal=LOG_LEVEL=debug --from-literal=MAX_CONN=100 -n staging
k edit deploy app-server -n staging
# Ajouter dans spec.template.spec.containers[0] :
# envFrom:
# - configMapRef:
#     name: app-config

# Vérification
k exec -n staging deploy/app-server -- env | grep -E "LOG_LEVEL|MAX_CONN"
```
</details>

---

### EX-05 — Job one-shot `⏱ 4 min`
> Crée un Job `compute` dans `default` qui exécute `echo "done"` avec `busybox`.
> Il doit se compléter une seule fois. Vérifie qu'il est en `Completed`.

<details><summary>Solution</summary>

```bash
k create job compute --image=busybox -- echo "done"
k get job compute
k get pod -l job-name=compute
k logs -l job-name=compute
```
</details>

---

### EX-06 — Init container `⏱ 7 min`
> Crée un Pod `myapp` avec :
> - Un init container `wait` (image `busybox`) qui exécute `sleep 5`
> - Un container principal `app` (image `nginx`)
>
> Le container `app` ne doit démarrer qu'après que `wait` se termine.
> Vérifie l'ordre de démarrage avec `kubectl get pod -w`.

<details><summary>Solution</summary>

```bash
k run myapp --image=nginx $do > myapp.yaml
# Éditer pour ajouter initContainers avant containers :
vi myapp.yaml
```

```yaml
spec:
  initContainers:
  - name: wait
    image: busybox
    command: ['sleep', '5']
  containers:
  - name: app
    image: nginx
```

```bash
k apply -f myapp.yaml
k get pod myapp -w
```
</details>

---

### EX-07 — NodeSelector `⏱ 5 min`
> Ajoute le label `disktype=ssd` sur ton node `kind-control-plane`.
> Crée un Pod `fast-pod` (image `nginx`) qui se schedule **uniquement** sur ce node via `nodeSelector`.
> Vérifie sur quel node il tourne.

<details><summary>Solution</summary>

```bash
k label node kind-control-plane disktype=ssd
k run fast-pod --image=nginx $do > fast-pod.yaml
# Ajouter dans spec :
# nodeSelector:
#   disktype: ssd
k apply -f fast-pod.yaml
k get pod fast-pod -o wide
```
</details>

---

## Domaine 2 — Services & Networking (20%)

### EX-08 — Service ClusterIP `⏱ 4 min`
> Expose le Deployment `app-server` dans `staging` en tant que Service ClusterIP nommé `app-svc`, port 80 → 80.
> Vérifie que les endpoints correspondent aux pods.

<details><summary>Solution</summary>

```bash
k expose deploy app-server -n staging --name=app-svc --port=80 --target-port=80
k get svc -n staging
k get endpoints app-svc -n staging   # doit lister les IPs des pods
```
</details>

---

### EX-09 — DNS interne `⏱ 5 min`
> Depuis un pod temporaire `busybox`, résous le DNS du service `app-svc.staging.svc.cluster.local`.
> Puis fais un `wget` pour confirmer la connectivité.

<details><summary>Solution</summary>

```bash
k run dns-test --image=busybox --rm -it --restart=Never -- sh
# Dans le pod :
nslookup app-svc.staging.svc.cluster.local
wget -qO- http://app-svc.staging.svc.cluster.local
```
</details>

---

### EX-10 — NetworkPolicy default-deny + allow `⏱ 8 min`
> Dans le namespace `secure` (à créer) :
> 1. Crée un Pod `backend` (image `nginx`) avec label `role=backend`
> 2. Applique une NetworkPolicy qui bloque tout le trafic entrant sauf depuis les pods avec `role=frontend`
> 3. Vérifie qu'un pod sans le bon label est bloqué (timeout), qu'un pod avec le bon label passe

<details><summary>Solution</summary>

```bash
k create ns secure
k run backend --image=nginx --labels=role=backend -n secure
k expose pod backend --port=80 -n secure
```

```yaml
# netpol.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-only
  namespace: secure
spec:
  podSelector:
    matchLabels:
      role: backend
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector:
        matchLabels:
          role: frontend
    ports:
    - port: 80
```

```bash
k apply -f netpol.yaml

# Test bloqué (pas de label)
k run nope --image=busybox --rm -it -n secure --restart=Never -- wget -qO- --timeout=3 http://backend

# Test autorisé
k run ok --image=busybox --labels=role=frontend --rm -it -n secure --restart=Never -- wget -qO- http://backend
```
</details>

---

## Domaine 3 — Storage (10%)

### EX-11 — PersistentVolume + PVC `⏱ 8 min`
> Crée un PV `pv-local` de 1Gi, `hostPath: /mnt/cka-data`, `RWO`, `reclaimPolicy: Retain`.
> Crée un PVC `claim-local` qui demande 500Mi en RWO.
> Monte le PVC dans un Pod `storage-pod` (image `nginx`) sur `/data`.
> Vérifie que le PVC est `Bound`.

<details><summary>Solution</summary>

```yaml
# storage.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-local
spec:
  capacity:
    storage: 1Gi
  accessModes: [ReadWriteOnce]
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /mnt/cka-data
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: claim-local
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 500Mi
---
apiVersion: v1
kind: Pod
metadata:
  name: storage-pod
spec:
  containers:
  - name: nginx
    image: nginx
    volumeMounts:
    - mountPath: /data
      name: local
  volumes:
  - name: local
    persistentVolumeClaim:
      claimName: claim-local
```

```bash
k apply -f storage.yaml
k get pv,pvc   # PVC doit être Bound
k exec storage-pod -- df -h /data
```
</details>

---

## Domaine 4 — Cluster Architecture & RBAC (25%)

### EX-12 — ServiceAccount + Role + RoleBinding `⏱ 7 min`
> Dans le namespace `dev` (à créer) :
> 1. Crée un ServiceAccount `reader-sa`
> 2. Crée un Role `pod-reader` qui autorise `get`, `list`, `watch` sur les pods
> 3. Bind le Role au ServiceAccount
> 4. Vérifie que le SA peut lister les pods mais ne peut PAS créer de pods

<details><summary>Solution</summary>

```bash
k create ns dev
k create sa reader-sa -n dev
k create role pod-reader --verb=get,list,watch --resource=pods -n dev
k create rolebinding pod-reader-bind --role=pod-reader --serviceaccount=dev:reader-sa -n dev

# Vérifications
k auth can-i list pods --as=system:serviceaccount:dev:reader-sa -n dev     # yes
k auth can-i create pods --as=system:serviceaccount:dev:reader-sa -n dev   # no
```
</details>

---

### EX-13 — ClusterRole pour ressources non-namespacées `⏱ 6 min`
> Crée un ClusterRole `node-reader` qui autorise `get`, `list` sur les nodes.
> Crée un ClusterRoleBinding qui lie ce rôle à l'utilisateur `alice`.
> Vérifie que `alice` peut lister les nodes mais pas les supprimer.

<details><summary>Solution</summary>

```bash
k create clusterrole node-reader --verb=get,list --resource=nodes
k create clusterrolebinding node-reader-alice --clusterrole=node-reader --user=alice

k auth can-i list nodes --as=alice     # yes
k auth can-i delete nodes --as=alice   # no
```
</details>

---

### EX-14 — Static pod manuel `⏱ 6 min`
> Crée un static pod nommé `static-web` (image `nginx`) directement dans `/etc/kubernetes/manifests/` sur le node.
> Vérifie qu'il apparaît dans `k get pods -n kube-system` et qu'il ne peut pas être supprimé via `kubectl delete`.

<details><summary>Solution</summary>

```bash
# Générer le YAML
k run static-web --image=nginx $do > /tmp/static-web.yaml

# Copier dans le node kind
docker cp /tmp/static-web.yaml kind-control-plane:/etc/kubernetes/manifests/static-web.yaml

# Vérifier (apparaît avec le suffixe -kind-control-plane)
k get pod -A | grep static-web

# Essayer de supprimer → il revient immédiatement
k delete pod static-web-kind-control-plane
k get pod -A | grep static-web
```
</details>

---

### EX-15 — etcd backup `⏱ 8 min`
> Fais un snapshot de l'etcd vers `/tmp/etcd-backup.db` depuis l'intérieur du node kind.
> Vérifie que le snapshot est valide.

<details><summary>Solution</summary>

```bash
docker exec kind-control-plane sh -c '
ETCDCTL_API=3 etcdctl snapshot save /tmp/etcd-backup.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
'

# Vérifier
docker exec kind-control-plane sh -c '
ETCDCTL_API=3 etcdctl snapshot status /tmp/etcd-backup.db --write-out=table
'
```
</details>

---

## Domaine 5 — Troubleshooting (30%) — PRIORITÉ #1

### EX-16 — Pod en CrashLoopBackOff `⏱ 7 min`
> Crée ce pod cassé puis diagnostique et répare-le sans regarder la solution :

```bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: crash-pod
spec:
  containers:
  - name: app
    image: nginx
    command: ["sh", "-c", "exit 1"]
EOF
```

> Le pod doit finir par être `Running` avec la commande corrigée (`nginx -g 'daemon off;'`).

<details><summary>Méthode de diagnostic</summary>

```bash
k get pod crash-pod                      # CrashLoopBackOff
k logs crash-pod --previous              # voir le crash
k describe pod crash-pod                 # Exit Code: 1

# Fix : supprimer la commande override
k delete pod crash-pod
k run crash-pod --image=nginx            # sans command override
k get pod crash-pod                      # Running
```
</details>

---

### EX-17 — Service qui ne route pas `⏱ 8 min`
> Crée ce deployment et service, puis trouve pourquoi le service ne route vers aucun pod :

```bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: broken-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: app
        image: nginx
---
apiVersion: v1
kind: Service
metadata:
  name: broken-svc
spec:
  selector:
    app: frontend
  ports:
  - port: 80
EOF
```

> Répare le service pour qu'il route vers les pods. Vérifie les endpoints.

<details><summary>Solution</summary>

```bash
k get endpoints broken-svc   # vide → selector ne matche pas

# Le service cherche app=frontend, les pods ont app=backend
k edit svc broken-svc
# Changer selector: app: frontend → app: backend

k get endpoints broken-svc   # doit maintenant lister 2 IPs
```
</details>

---

### EX-18 — Scheduler cassé (comme vu en session) `⏱ 7 min`
> Casse le scheduler, crée un pod de test, diagnostique et répare.

```bash
docker exec kind-control-plane sed -i 's/kube-scheduler/kube-XXscheduler/g' /etc/kubernetes/manifests/kube-scheduler.yaml
kubectl run test-sched --image=nginx
```

> Méthode : symptôme → composant → manifest → fix → vérification.

<details><summary>Solution</summary>

```bash
k get pod test-sched                              # Pending
k describe pod test-sched | grep Events -A10      # pas d'events
k -n kube-system get pod | grep scheduler         # absent ou Error
docker exec kind-control-plane grep image /etc/kubernetes/manifests/kube-scheduler.yaml
# → kube-XXscheduler trouvé

docker exec kind-control-plane sed -i 's/kube-XXscheduler/kube-scheduler/g' /etc/kubernetes/manifests/kube-scheduler.yaml

# Attendre 15s
k -n kube-system get pod | grep scheduler         # Running
k get pod test-sched                              # Running
```
</details>

---

### EX-19 — Node NotReady `⏱ 8 min`
> Simule un node NotReady en stoppant kubelet, diagnostique, puis répare.

```bash
docker exec kind-control-plane systemctl stop kubelet
```

> Trouve quel composant est mort, relance-le, vérifie que le node repasse `Ready`.

<details><summary>Solution</summary>

```bash
k get nodes                                        # NotReady
docker exec kind-control-plane systemctl status kubelet   # stopped
docker exec kind-control-plane systemctl start kubelet
docker exec kind-control-plane systemctl status kubelet   # active

k get nodes   # Ready (peut prendre 20-30s)
```
</details>

---

### EX-20 — Pod qui ne démarre pas : ImagePullBackOff `⏱ 5 min`
> Crée un pod avec une image qui n'existe pas, diagnostique l'erreur exacte, corrige.

```bash
k run bad-image --image=nginx:99.99.99
```

> Identifie le message d'erreur complet, puis recrée le pod avec la bonne image.

<details><summary>Solution</summary>

```bash
k get pod bad-image                          # ImagePullBackOff
k describe pod bad-image | grep -A5 Events  # "not found" ou "unauthorized"

k delete pod bad-image $now
k run bad-image --image=nginx:alpine
k get pod bad-image                          # Running
```
</details>

---

### EX-21 — Logs d'un container crashé `⏱ 4 min`
> Crée ce pod, attends qu'il crash, récupère les logs **du run précédent** (pas du run actuel) :

```bash
k run crasher --image=busybox -- sh -c "echo 'erreur critique' && exit 1"
```

<details><summary>Solution</summary>

```bash
k get pod crasher                     # CrashLoopBackOff
k logs crasher                        # logs actuels (peut être vide)
k logs crasher --previous             # logs du crash précédent → "erreur critique"
```
</details>

---

## Bonus — Niveau avancé

### EX-22 — Taint + Toleration `⏱ 8 min`
> Ajoute la taint `env=prod:NoSchedule` sur `kind-control-plane`.
> Crée un pod `tolerant-pod` qui peut se scheduler sur ce node malgré la taint.
> Crée un pod `intolerant-pod` sans toleration et vérifie qu'il reste `Pending`.

<details><summary>Solution</summary>

```bash
k taint node kind-control-plane env=prod:NoSchedule

# Pod intolerant → Pending
k run intolerant-pod --image=nginx
k get pod intolerant-pod   # Pending

# Pod tolerant → Running
k run tolerant-pod --image=nginx $do > tol.yaml
# Ajouter dans spec :
# tolerations:
# - key: env
#   operator: Equal
#   value: prod
#   effect: NoSchedule
k apply -f tol.yaml
k get pod tolerant-pod -o wide   # Running

# Nettoyage
k taint node kind-control-plane env=prod:NoSchedule-
```
</details>

---

### EX-23 — Secret monté en volume `⏱ 7 min`
> Crée un Secret `db-creds` avec `username=admin` et `password=S3cr3t`.
> Monte-le dans un Pod `secret-pod` (image `nginx`) dans `/etc/secrets`.
> Vérifie que les fichiers sont bien présents dans le pod.

<details><summary>Solution</summary>

```bash
k create secret generic db-creds --from-literal=username=admin --from-literal=password=S3cr3t
k run secret-pod --image=nginx $do > secret-pod.yaml
```

```yaml
# Ajouter dans spec :
volumes:
- name: creds
  secret:
    secretName: db-creds
containers:
- name: secret-pod
  image: nginx
  volumeMounts:
  - name: creds
    mountPath: /etc/secrets
    readOnly: true
```

```bash
k apply -f secret-pod.yaml
k exec secret-pod -- ls /etc/secrets        # username  password
k exec secret-pod -- cat /etc/secrets/username   # admin
```
</details>

---

## Récapitulatif des temps cibles

| # | Sujet | Temps cible | Domaine |
|---|---|---|---|
| 01 | Pod simple | 3 min | Workloads |
| 02 | Deployment | 4 min | Workloads |
| 03 | Scale + rollback | 5 min | Workloads |
| 04 | ConfigMap + env | 6 min | Workloads |
| 05 | Job | 4 min | Workloads |
| 06 | Init container | 7 min | Workloads |
| 07 | NodeSelector | 5 min | Scheduling |
| 08 | Service ClusterIP | 4 min | Networking |
| 09 | DNS interne | 5 min | Networking |
| 10 | NetworkPolicy | 8 min | Networking |
| 11 | PV + PVC | 8 min | Storage |
| 12 | RBAC Role | 7 min | Architecture |
| 13 | ClusterRole | 6 min | Architecture |
| 14 | Static pod | 6 min | Architecture |
| 15 | etcd backup | 8 min | Architecture |
| 16 | CrashLoopBackOff | 7 min | **Troubleshooting** |
| 17 | Service cassé | 8 min | **Troubleshooting** |
| 18 | Scheduler cassé | 7 min | **Troubleshooting** |
| 19 | Node NotReady | 8 min | **Troubleshooting** |
| 20 | ImagePullBackOff | 5 min | **Troubleshooting** |
| 21 | Logs --previous | 4 min | **Troubleshooting** |
| 22 | Taint + Toleration | 8 min | Scheduling |
| 23 | Secret en volume | 7 min | Workloads |

**Total : ~152 min de pratique** — l'équivalent d'un examen complet.
