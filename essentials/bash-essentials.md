# Bash — Survie pour le CKA

## Redirection

```bash
commande > file.yaml        # écrire dans un fichier (écrase)
commande >> file.yaml       # ajouter à la fin
commande 2>&1               # capturer aussi les erreurs
```

## Pipes

```bash
k get pods | grep Running
k describe pod x | grep -i image
k get pods -o yaml | grep -A5 "resources:"
```

## grep utiles

```bash
grep -i "mot"               # insensible à la casse
grep -A5 "mot"              # 5 lignes APRÈS le match
grep -B5 "mot"              # 5 lignes AVANT le match
grep -r "mot" /etc/         # récursif dans un dossier
grep -E "Error|Warning"     # regex étendue : Error OU Warning
grep -Ei "error|warn|fail"  # regex étendue + insensible à la casse

# Combo le plus utile à l'examen :
k describe pod <pod> | grep -E "State|Reason|Image|Node"
```

## Copier-coller dans le terminal

```
Ctrl+Shift+C    → copier
Ctrl+Shift+V    → coller
```

## Historique

```bash
Ctrl+R          # chercher dans l'historique (tape un mot, Enter pour exécuter)
!!              # relancer la dernière commande
!k              # relancer la dernière commande commençant par "k"
```

## Navigation

```bash
Ctrl+A          # début de la ligne
Ctrl+E          # fin de la ligne
Ctrl+U          # effacer toute la ligne
Ctrl+W          # effacer le mot avant le curseur
```

## Curl (tester un service depuis l'intérieur)

```bash
k exec -it <pod> -- curl http://<svc-name>.<namespace>.svc.cluster.local
k exec -it <pod> -- curl http://10.96.30.161:80
```

## SSH sur un node (vrai cluster)

```bash
ssh node01
sudo -i                     # devenir root
cat /etc/kubernetes/manifests/kube-scheduler.yaml
```

## Variables pratiques (setup examen)

```bash
export do='--dry-run=client -o yaml'
export now='--grace-period=0 --force'

# Usage :
k run pod1 --image=nginx $do > pod1.yaml
k delete pod pod1 $now
```
