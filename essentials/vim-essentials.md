# Vim — Survie pour le CKA

## ~/.vimrc à configurer avant l'examen

```
set expandtab
set tabstop=2
set shiftwidth=2
```

Sans ça → tabulations dures → YAML invalide → pods qui ne démarrent pas.

## Modes

```
i         → insérer (taper du texte)
Esc       → revenir en mode normal
```

## Sauvegarder / Quitter

```
:w        → sauvegarder
:wq       → sauvegarder et quitter
:q!       → quitter SANS sauvegarder (si tu as tout cassé)
```

## Navigation rapide

```
gg        → aller au début du fichier
G         → aller à la fin
:42       → aller à la ligne 42
0         → début de la ligne
$         → fin de la ligne
```

## Chercher

```
/mot      → chercher "mot"
n         → occurrence suivante
N         → occurrence précédente
```

## Éditer

```
dd        → supprimer la ligne courante
yy        → copier la ligne courante
p         → coller après le curseur
u         → annuler (undo)
Ctrl+r    → refaire (redo)
```

## Indentation YAML (le plus important)

```
>>        → indenter la ligne (mode normal)
<<        → désindenter la ligne
```

En mode insertion : utilise la touche Tab (si vimrc bien configuré → 2 espaces).

## Workflow type à l'examen

```bash
# 1. Générer le YAML
k run mypod --image=nginx $do > pod.yaml

# 2. Éditer les 2-3 lignes manquantes
vi pod.yaml

# 3. Appliquer
k apply -f pod.yaml

# 4. Vérifier
k get pod mypod
k describe pod mypod
```

## Si vim t'énerve en examen

```bash
# Utilise nano à la place — plus simple
nano /etc/kubernetes/manifests/kube-scheduler.yaml
# Ctrl+O → sauvegarder
# Ctrl+X → quitter
```
