# 05 — Scale, Update, Rollback

> **Objectif** : Savoir augmenter la capacite, deployer une nouvelle version sans downtime, et revenir en arriere en cas de probleme.

---

## Scale — ajuster le nombre de pods

```bash
kubectl scale deployment my-app --replicas=3
```

```
AVANT                          APRES
─────                          ─────
Deployment my-app              Deployment my-app
  └── Pod 1  ✓                   ├── Pod 1  ✓
                                 ├── Pod 2  ✓  (nouveau)
                                 └── Pod 3  ✓  (nouveau)
```

### Combien de replicas en prod ?

```
1 replica   →  si le pod crash = app down, zero tolerance
2 replicas  →  fragile, un seul crash et tu es sur le fil
3 replicas  →  minimum prod : survit a 1 crash sans downtime
5+ replicas →  pour les services a fort trafic
```

**Regle** : En production, minimum 3 replicas pour tout service critique. Un seul replica est acceptable uniquement pour des jobs batch ou des outils internes non-critiques.

### Verifier le scaling

```bash
kubectl get pods                    # tous les pods sont Running ?
kubectl get deployment my-app       # READY 3/3 ?
kubectl get endpointslices -l kubernetes.io/service-name=my-app  # le Service voit les 3 pods ?
```

---

## Rolling Update — deployer sans downtime

### Le principe

K8s ne coupe jamais tous les pods en meme temps. Il remplace les pods **un par un** :

```
Etat initial : 3 pods v1

Etape 1 :  v1 v1 v1        →  v1 v1 v1 + v2   (cree un v2)
Etape 2 :  v1 v1 v1 + v2   →  v1 v1 + v2      (supprime un v1)
Etape 3 :  v1 v1 + v2      →  v1 v1 + v2 + v2  (cree un v2)
Etape 4 :  ...
Resultat :  v2 v2 v2                             (zero downtime)
```

A tout moment, il y a toujours des pods qui servent du trafic.

### Les commandes

```bash
# 1. Build et push la nouvelle image
docker build -t user/my-app:v2 .
docker push user/my-app:v2

# 2. Trouver le nom exact du conteneur dans le Deployment
kubectl describe deployment my-app | grep -A2 "Containers:"
# Containers:
#   mon-conteneur:     ← ce nom-la
#     Image: user/my-app:v1

# 3. Declencher le rolling update
kubectl set image deployment/my-app mon-conteneur=user/my-app:v2

# 4. Surveiller en temps reel
kubectl rollout status deployment/my-app
# → Waiting for deployment "my-app" rollout to finish: 1 out of 3 new replicas have been updated...
# → deployment "my-app" successfully rolled out

# 5. Verifier
kubectl get pods                    # tous Running ?
kubectl describe pod <pod> | grep Image   # bonne version ?
```

### Piege avec le nom du conteneur

Le nom dans `set image` est le nom du **conteneur** (`spec.containers[].name`), pas le nom du Deployment. Si tu te trompes, K8s ne mettra rien a jour sans erreur apparente.

Pour eviter toute ambiguite :
```bash
# Voir le nom exact du conteneur
kubectl get deployment my-app -o jsonpath='{.spec.template.spec.containers[*].name}'
```

---

## Rollback — revenir en arriere

K8s garde un historique des ReplicaSets (= versions de ton Deployment).

```bash
# Voir l'historique des versions
kubectl rollout history deployment/my-app

# REVISION  CHANGE-CAUSE
# 1         <none>
# 2         <none>
# 3         <none>

# Voir les details d'une revision
kubectl rollout history deployment/my-app --revision=2

# Revenir a la version precedente (immediatement)
kubectl rollout undo deployment/my-app

# Revenir a une revision precise
kubectl rollout undo deployment/my-app --to-revision=1

# Verifier que le rollback est fait
kubectl rollout status deployment/my-app
```

```
v1  →  v2  →  bug en prod !  →  undo  →  v1
                                    en quelques secondes
```

**En prod, le rollback est ton filet de securite.** Un deploiement qui casse quelque chose ? `rollout undo` et tu es de retour a l'etat precedent en secondes, pas en minutes.

---

## Strategies de deploiement

### RollingUpdate (par defaut)

Remplace les pods progressivement. C'est le comportement par defaut.

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1         # combien de pods EN PLUS du nombre desire
      maxUnavailable: 0   # combien de pods peuvent etre indisponibles
```

- `maxSurge: 1, maxUnavailable: 0` → le plus sur : cree d'abord, supprime ensuite. Jamais de pods manquants.
- `maxSurge: 0, maxUnavailable: 1` → economique en ressources mais il y a toujours un pod en moins.

### Recreate

Supprime TOUS les pods d'abord, puis cree les nouveaux. **Provoque un downtime.**

```yaml
spec:
  strategy:
    type: Recreate
```

Utilise uniquement quand les anciennes et nouvelles versions ne peuvent pas coexister (ex: migration de schema de BDD incompatible).

---

## Resume visuel

```
docker build + push
        │
        ▼
kubectl set image       ← declenche le rolling update
        │
        ▼
   K8s remplace         ← pod par pod, sans couper le trafic
   les pods
        │
        ▼
kubectl rollout status  ← confirme que tout est OK
        │
   bug detecte ?
        │
        ▼
kubectl rollout undo    ← revient a la version precedente
                           en quelques secondes
```

---

## Checklist avant un deploiement en prod

```
[ ] L'image est buildee avec un tag de version precis (pas :latest)
[ ] L'image est pushee sur le registry
[ ] Le deployment a au moins 3 replicas
[ ] Tu sais quel conteneur mettre a jour (kubectl describe deployment)
[ ] Tu surveilles le rollout (kubectl rollout status)
[ ] Tu verifies les logs des nouveaux pods
[ ] Tu connais la commande rollback si ca casse
```
