# Réflexe diagnostic K8s — la séquence à connaître par cœur

> **Règle** : toujours dans cet ordre, jamais d'impro tant que tu n'as pas fait les 7 étapes.
> Objectif : passer de 30 min à 3 min de diagnostic.

---

## La séquence (NS = ton namespace)

### 1. Vue d'ensemble
```bash
k -n $NS get all
```
**Tu cherches :** ce qui existe et ce qui manque (pas de svc ? pas de deploy ?). Compte les pods vs les replicas attendus.

---

### 2. Status des pods
```bash
k -n $NS get pods
```
**Tu cherches dans cet ordre :**
- `STATUS` ≠ `Running` → va direct à l'étape 3
- `READY` `0/1` ou `1/2` → probe qui fail, va à l'étape 3
- `RESTARTS` > 0 → instable, va à l'étape 4 avec `--previous`
- `AGE` très récent qui se reset → CrashLoop

**Si tout est `1/1 Running`** → saute à l'étape 5 (problème côté service/réseau).

---

### 3. Describe du pod cassé
```bash
k -n $NS describe pod <pod>
```
**Tu lis du BAS vers le HAUT :**
- **Section `Events`** en bas → 90% des réponses sont là
- Cherche `Failed`, `BackOff`, `Unhealthy`, `FailedScheduling`
- Section `Containers` : regarde `State`, `Last State`, `Reason`
- Section `Conditions` : `Ready: False` confirme un problème de probe

**Reasons fréquents et action :**
| Reason | Action immédiate |
|---|---|
| `ImagePullBackOff` | Vérifier nom image (typo ? tag ?) |
| `CrashLoopBackOff` | Étape 4 avec `--previous` |
| `CreateContainerConfigError` | ConfigMap/Secret manquant |
| `FailedScheduling` | Ressources, taints, PVC pending |
| `Unhealthy` | readiness/liveness probe — check path/port |

---

### 4. Logs du container
```bash
k -n $NS logs <pod>
k -n $NS logs <pod> --previous   # si CrashLoop
k -n $NS logs <pod> -c <container>   # si multi-container
```
**Tu cherches :** la dernière ligne avant le crash. Erreurs de connexion DB, port déjà pris, fichier introuvable, env var manquante.

---

### 5. Services
```bash
k -n $NS get svc
```
**Tu cherches :**
- `CLUSTER-IP` = `<none>` → headless (normal pour StatefulSet)
- `PORT(S)` : note les ports exposés, tu vas les comparer après

---

### 6. ⭐ Endpoints — LE réflexe qui sauve
```bash
k -n $NS get endpoints
# ou plus court :
k -n $NS get ep
```
**La règle d'or :**
- **`ENDPOINTS` rempli (IPs)** → le service trouve ses pods, problème ailleurs
- **`ENDPOINTS` = `<none>`** → 🚨 le service ne trouve PAS ses pods

**Si `<none>`, 2 causes possibles :**

1. **Selector ne matche aucun pod :**
```bash
k -n $NS get svc <svc> -o yaml | grep -A3 selector
k -n $NS get pods --show-labels
# Compare manuellement → typo ? clé différente ?
```

2. **Pods matchent mais pas Ready** (readinessProbe fail) :
```bash
k -n $NS get pods -l <selector-du-svc>
# Si tu vois des pods 0/1 → retour étape 3
```

**Si endpoints OK mais service injoignable → vérifier targetPort vs containerPort :**
```bash
k -n $NS get svc <svc> -o yaml | grep -A2 targetPort
k -n $NS get pod <pod> -o yaml | grep -A2 containerPort
# Doivent matcher (numéro OU nom)
```

---

### 7. Events globaux du namespace
```bash
k -n $NS get events --sort-by=.lastTimestamp
```
**Tu cherches :** les `Warning` récents en bas. Souvent ça révèle un truc que tu as raté (FailedMount, FailedScheduling, BackOff).

---

## Cheat sheet : symptôme → étape qui résout

| Symptôme | Étape clé |
|---|---|
| Pod `Pending` | 3 (describe → Events) |
| Pod `CrashLoopBackOff` | 4 (logs --previous) |
| Pod `ImagePullBackOff` | 3 (describe → message) |
| Pod `0/1 Running` | 3 (describe → Readiness probe) |
| Service ne répond pas, pods OK | **6 (endpoints)** |
| `wget: connection refused` | 6 (targetPort mismatch) |
| `wget: bad address` | DNS — vérifier nom du service |
| Tout semble OK mais ça marche pas | 7 (events) |

---

## Les 3 commandes que tu dois taper SANS RÉFLÉCHIR

```bash
k -n $NS get pods                          # status
k -n $NS describe pod <pod>                # events
k -n $NS get ep                            # le réflexe qui sauve
```

**Test perso :** chronomètre-toi. Si tu mets plus de 5 secondes à taper l'une de ces 3 commandes, refais l'exo.

---

## Anti-patterns du junior

- ❌ Lancer `kubectl edit` direct sans avoir lu les events
- ❌ Recréer le pod sans comprendre pourquoi il crashait (le bug revient)
- ❌ Ignorer les `Warning` events parce que "ça a l'air d'aller"
- ❌ Lire les logs AVANT le describe (les events sont plus rapides à scanner)
- ❌ Oublier `-n <namespace>` et débugger dans `default`

---

## Setup minimal pour aller vite

```bash
# Dans ~/.bashrc
alias k='kubectl'
export NS=exo-001    # change selon l'exo en cours
source <(kubectl completion bash)
complete -o default -F __start_kubectl k
```

Puis tu tapes juste : `k -n $NS get pods` partout.
