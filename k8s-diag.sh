#!/usr/bin/env bash
# k8s-diag.sh — Diagnostic complet d'un namespace Kubernetes
# Usage: ./k8s-diag.sh <namespace>
#
# Vérifie tout ce qui casse en prod : pods, deployments, services
# (selector/endpoints/targetPort), configmaps/secrets référencés,
# PVCs, ingress, events, quotas. Sort des actions concrètes à mener.

NS="${1:-}"
if [[ -z "$NS" ]]; then
    echo "Usage: $0 <namespace>"
    exit 1
fi

command -v kubectl >/dev/null || { echo "kubectl requis"; exit 1; }
command -v jq      >/dev/null || { echo "jq requis"; exit 1; }

kubectl get ns "$NS" >/dev/null 2>&1 || { echo "Namespace '$NS' introuvable"; exit 1; }

# --- Couleurs ---
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'
B='\033[0;34m'; C='\033[0;36m'; BOLD='\033[1m'; N='\033[0m'

# --- Compteurs (via fichier pour survivre aux subshells) ---
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
echo 0 > "$TMP/errors"
echo 0 > "$TMP/warns"

bump() { local f="$TMP/$1"; echo $(( $(cat "$f") + 1 )) > "$f"; }
err()  { echo -e "${R}✗ $1${N}"; bump errors; }
warn() { echo -e "${Y}⚠ $1${N}"; bump warns;  }
ok()   { echo -e "${G}✓ $1${N}"; }
info() { echo -e "${C}→ $1${N}"; }
hint() { echo -e "  ${B}💡 $1${N}"; }
section() { echo -e "\n${BOLD}═══ $1 ═══${N}"; }

# ═══════════════════════════════════════════════════════════
# 1. PODS
# ═══════════════════════════════════════════════════════════
section "PODS"
PODS=$(kubectl get pods -n "$NS" -o json)
PCOUNT=$(echo "$PODS" | jq '.items | length')

if [[ "$PCOUNT" -eq 0 ]]; then
    warn "Aucun pod dans le namespace"
else
    info "$PCOUNT pod(s) trouvé(s)"

    # Pods avec phase ≠ Running/Succeeded
    while IFS=$'\t' read -r name phase; do
        [[ -z "$name" ]] && continue
        err "Pod '$name' phase=$phase"

        # Raison container waiting
        reason=$(kubectl get pod "$name" -n "$NS" -o jsonpath='{.status.containerStatuses[0].state.waiting.reason}' 2>/dev/null)
        msg=$(kubectl get pod "$name" -n "$NS" -o jsonpath='{.status.containerStatuses[0].state.waiting.message}' 2>/dev/null)
        [[ -n "$reason" ]] && echo "    reason: $reason"
        [[ -n "$msg"    ]] && echo "    message: $msg"

        case "$reason" in
            ImagePullBackOff|ErrImagePull|InvalidImageName)
                hint "Image introuvable/typo. Vérifier: kubectl describe pod $name -n $NS"
                hint "Si registry privé: il faut un imagePullSecret"
                ;;
            CrashLoopBackOff)
                hint "Logs du crash précédent: kubectl logs $name -n $NS --previous"
                hint "Souvent: commande qui sort, probe mal configurée, config invalide"
                ;;
            CreateContainerConfigError|CreateContainerError)
                hint "ConfigMap/Secret manquant ou clé inexistante. Vérifier envFrom/volumes"
                ;;
            RunContainerError)
                hint "Commande/entrypoint invalide. kubectl describe pod $name -n $NS"
                ;;
            ContainerCreating)
                hint "Peut-être un volume (PVC) non Bound ou un secret en cours de mount"
                ;;
            "")
                # Phase Pending sans reason container = scheduling
                if [[ "$phase" == "Pending" ]]; then
                    hint "Scheduling failure. kubectl describe pod $name -n $NS | grep -A5 Events"
                    hint "Causes: ressources insuffisantes, taints, nodeSelector, PVC pending"
                fi
                ;;
        esac
    done < <(echo "$PODS" | jq -r '.items[] | select(.status.phase!="Running" and .status.phase!="Succeeded") | [.metadata.name, .status.phase] | @tsv')

    # Pods Running mais pas ready (probe)
    while read -r name; do
        [[ -z "$name" ]] && continue
        warn "Pod '$name' Running mais pas Ready (readinessProbe fail probable)"
        hint "kubectl describe pod $name -n $NS | grep -A5 Readiness"
        hint "kubectl logs $name -n $NS"
    done < <(echo "$PODS" | jq -r '.items[] | select(.status.phase=="Running") | select([.status.containerStatuses[]?.ready] | any(.==false)) | .metadata.name')

    # RestartCount élevé
    while IFS=$'\t' read -r pod cont count; do
        [[ -z "$pod" ]] && continue
        warn "Pod '$pod' container '$cont' a redémarré $count fois"
        hint "kubectl logs $pod -c $cont -n $NS --previous"
    done < <(echo "$PODS" | jq -r '.items[] | .metadata.name as $n | .status.containerStatuses[]? | select(.restartCount>3) | [$n, .name, .restartCount] | @tsv')

    # OOMKilled dans last state
    while IFS=$'\t' read -r pod cont; do
        [[ -z "$pod" ]] && continue
        err "Pod '$pod' container '$cont' a été OOMKilled (mémoire insuffisante)"
        hint "Augmenter resources.limits.memory ou chercher une fuite mémoire"
    done < <(echo "$PODS" | jq -r '.items[] | .metadata.name as $n | .status.containerStatuses[]? | select(.lastState.terminated.reason=="OOMKilled") | [$n, .name] | @tsv')
fi

# ═══════════════════════════════════════════════════════════
# 2. DEPLOYMENTS
# ═══════════════════════════════════════════════════════════
section "DEPLOYMENTS"
DEPS=$(kubectl get deploy -n "$NS" -o json)
DCOUNT=$(echo "$DEPS" | jq '.items | length')

if [[ "$DCOUNT" -eq 0 ]]; then
    info "Aucun deployment"
else
    while IFS=$'\t' read -r name desired ready avail; do
        [[ -z "$name" ]] && continue
        if [[ "$desired" != "$ready" ]]; then
            err "Deployment '$name': $ready/$desired ready (avail=$avail)"
            # Check progressing condition
            prog=$(echo "$DEPS" | jq -r --arg n "$name" '.items[] | select(.metadata.name==$n) | .status.conditions[]? | select(.type=="Progressing") | .reason')
            [[ -n "$prog" ]] && echo "    progressing reason: $prog"
            hint "kubectl rollout status deploy/$name -n $NS"
            hint "kubectl describe deploy $name -n $NS"
            [[ "$prog" == "ProgressDeadlineExceeded" ]] && \
                hint "Rollback: kubectl rollout undo deploy/$name -n $NS"
        else
            ok "Deployment '$name': $ready/$desired"
        fi
    done < <(echo "$DEPS" | jq -r '.items[] | [.metadata.name, (.spec.replicas|tostring), (.status.readyReplicas//0|tostring), (.status.availableReplicas//0|tostring)] | @tsv')
fi

# ═══════════════════════════════════════════════════════════
# 3. SERVICES (le plus critique — selector/targetPort/endpoints)
# ═══════════════════════════════════════════════════════════
section "SERVICES"
SVCS=$(kubectl get svc -n "$NS" -o json)
SCOUNT=$(echo "$SVCS" | jq '.items | length')

if [[ "$SCOUNT" -eq 0 ]]; then
    info "Aucun service"
else
    while read -r svc; do
        [[ -z "$svc" ]] && continue
        sj=$(echo "$SVCS" | jq --arg n "$svc" '.items[] | select(.metadata.name==$n)')
        stype=$(echo "$sj" | jq -r '.spec.type')

        if [[ "$stype" == "ExternalName" ]]; then
            ok "Service '$svc' (ExternalName → $(echo "$sj" | jq -r .spec.externalName))"
            continue
        fi

        selector=$(echo "$sj" | jq -r '.spec.selector // {} | to_entries | map("\(.key)=\(.value)") | join(",")')

        if [[ -z "$selector" ]]; then
            warn "Service '$svc' sans selector (headless ou géré manuellement)"
            continue
        fi

        # Endpoints
        ep_count=$(kubectl get endpoints "$svc" -n "$NS" -o json 2>/dev/null | jq '[.subsets[]?.addresses[]?] | length')
        ep_count=${ep_count:-0}

        if [[ "$ep_count" -eq 0 ]]; then
            err "Service '$svc' a 0 endpoints (selector: $selector)"
            matching=$(kubectl get pods -n "$NS" -l "$selector" -o json | jq '.items | length')
            if [[ "$matching" -eq 0 ]]; then
                hint "Selector ne matche AUCUN pod. Labels existants:"
                kubectl get pods -n "$NS" -o json | jq -r '.items[] | "    \(.metadata.name): \(.metadata.labels)"' | head -5
                hint "Corriger: kubectl label pod <pod> -n $NS <key>=<value>"
                hint "Ou corriger le service: kubectl edit svc $svc -n $NS"
            else
                hint "$matching pod(s) matchent mais aucun Ready. readinessProbe failing?"
            fi
            continue
        fi

        # Vérifier targetPort vs containerPort des pods sélectionnés
        first_pod=$(kubectl get pods -n "$NS" -l "$selector" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
        if [[ -n "$first_pod" ]]; then
            cports=$(kubectl get pod "$first_pod" -n "$NS" -o jsonpath='{.spec.containers[*].ports[*].containerPort}' 2>/dev/null)
            cnames=$(kubectl get pod "$first_pod" -n "$NS" -o jsonpath='{.spec.containers[*].ports[*].name}' 2>/dev/null)

            mismatch=0
            while IFS=$'\t' read -r sport tport; do
                [[ -z "$tport" ]] && continue
                if [[ "$tport" =~ ^[0-9]+$ ]]; then
                    # Numeric targetPort
                    if [[ -n "$cports" ]] && ! echo " $cports " | grep -q " $tport "; then
                        err "Service '$svc' port $sport→$tport: aucun container n'expose $tport (dispo: ${cports:-aucun déclaré})"
                        hint "kubectl patch svc $svc -n $NS --type=json -p='[{\"op\":\"replace\",\"path\":\"/spec/ports/0/targetPort\",\"value\":<BON_PORT>}]'"
                        mismatch=1
                    fi
                else
                    # Named targetPort
                    if [[ -n "$cnames" ]] && ! echo " $cnames " | grep -q " $tport "; then
                        err "Service '$svc' targetPort nommé '$tport' introuvable (noms dispo: ${cnames:-aucun})"
                        mismatch=1
                    fi
                fi
            done < <(echo "$sj" | jq -r '.spec.ports[] | [(.port|tostring), (.targetPort|tostring)] | @tsv')

            [[ $mismatch -eq 0 ]] && ok "Service '$svc' → $ep_count endpoint(s) [$stype]"
        fi
    done < <(echo "$SVCS" | jq -r '.items[].metadata.name')
fi

# ═══════════════════════════════════════════════════════════
# 4. CONFIGMAPS & SECRETS — références fantômes
# ═══════════════════════════════════════════════════════════
section "CONFIGMAPS & SECRETS (références)"
CMS=$(kubectl get cm -n "$NS" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)
SECS=$(kubectl get secret -n "$NS" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)

# Collecter toutes les références depuis les pods
REFS=$(echo "$PODS" | jq -r '
    .items[] | .metadata.name as $p |
    (.spec.containers[]?.envFrom[]? |
        if .configMapRef then [$p, "envFrom", .configMapRef.name, "cm"]
        elif .secretRef then [$p, "envFrom", .secretRef.name, "sec"]
        else empty end | @tsv),
    (.spec.containers[]?.env[]?.valueFrom? |
        if .configMapKeyRef then [$p, "env", .configMapKeyRef.name, "cm"]
        elif .secretKeyRef then [$p, "env", .secretKeyRef.name, "sec"]
        else empty end | @tsv),
    (.spec.volumes[]? |
        if .configMap then [$p, "volume", .configMap.name, "cm"]
        elif .secret then [$p, "volume", .secret.secretName, "sec"]
        else empty end | @tsv)
' 2>/dev/null | sort -u)

missing=0
while IFS=$'\t' read -r pod kind name type; do
    [[ -z "$name" ]] && continue
    if [[ "$type" == "cm" ]]; then
        if ! echo " $CMS " | grep -q " $name "; then
            err "Pod '$pod' ($kind) référence ConfigMap '$name' → INEXISTANT"
            hint "kubectl create cm $name -n $NS --from-literal=key=value"
            missing=1
        fi
    else
        if ! echo " $SECS " | grep -q " $name "; then
            err "Pod '$pod' ($kind) référence Secret '$name' → INEXISTANT"
            hint "kubectl create secret generic $name -n $NS --from-literal=key=value"
            missing=1
        fi
    fi
done <<< "$REFS"
[[ $missing -eq 0 ]] && ok "Toutes les références CM/Secret sont résolues"

# ═══════════════════════════════════════════════════════════
# 5. PVCs
# ═══════════════════════════════════════════════════════════
section "PERSISTENT VOLUME CLAIMS"
PVCS=$(kubectl get pvc -n "$NS" -o json 2>/dev/null)
PVCCOUNT=$(echo "$PVCS" | jq '.items | length')
if [[ "$PVCCOUNT" -eq 0 ]]; then
    info "Aucun PVC"
else
    while IFS=$'\t' read -r name phase sc; do
        [[ -z "$name" ]] && continue
        if [[ "$phase" != "Bound" ]]; then
            err "PVC '$name' en statut $phase (storageClass: $sc)"
            hint "kubectl describe pvc $name -n $NS"
            hint "Vérifier qu'une StorageClass '$sc' existe et provisionne"
        else
            ok "PVC '$name' Bound"
        fi
    done < <(echo "$PVCS" | jq -r '.items[] | [.metadata.name, .status.phase, (.spec.storageClassName//"default")] | @tsv')
fi

# ═══════════════════════════════════════════════════════════
# 6. INGRESS
# ═══════════════════════════════════════════════════════════
section "INGRESS"
ING=$(kubectl get ingress -n "$NS" -o json 2>/dev/null)
ICOUNT=$(echo "$ING" | jq '.items | length')
if [[ "$ICOUNT" -eq 0 ]]; then
    info "Aucun ingress"
else
    while IFS=$'\t' read -r ing host svc port; do
        [[ -z "$ing" ]] && continue
        if ! kubectl get svc "$svc" -n "$NS" >/dev/null 2>&1; then
            err "Ingress '$ing' host='$host' → service '$svc' INEXISTANT"
        else
            svc_ports=$(kubectl get svc "$svc" -n "$NS" -o jsonpath='{.spec.ports[*].port}')
            if [[ "$port" =~ ^[0-9]+$ ]] && ! echo " $svc_ports " | grep -q " $port "; then
                err "Ingress '$ing' → $svc:$port mais service expose: $svc_ports"
            else
                ok "Ingress '$ing' ($host) → $svc:$port"
            fi
        fi
    done < <(echo "$ING" | jq -r '.items[] | .metadata.name as $n | .spec.rules[]? | .host as $h | .http.paths[]? | [$n, ($h//"*"), .backend.service.name, (.backend.service.port.number // .backend.service.port.name | tostring)] | @tsv')
fi

# ═══════════════════════════════════════════════════════════
# 7. RESOURCE QUOTA / LIMIT RANGE
# ═══════════════════════════════════════════════════════════
section "QUOTAS & LIMITS"
QUOTA=$(kubectl get resourcequota -n "$NS" -o json 2>/dev/null)
QCOUNT=$(echo "$QUOTA" | jq '.items | length')
if [[ "$QCOUNT" -gt 0 ]]; then
    echo "$QUOTA" | jq -r '.items[] | .metadata.name as $n | .status | "  \($n): used=\(.used) hard=\(.hard)"'
    # Detecter saturation
    while IFS=$'\t' read -r qname resource used hard; do
        [[ -z "$qname" ]] && continue
        # Comparaison basique string (suffit pour détecter le =)
        if [[ "$used" == "$hard" ]]; then
            warn "Quota '$qname' saturé: $resource = $used/$hard"
        fi
    done < <(echo "$QUOTA" | jq -r '.items[] | .metadata.name as $n | .status.hard | to_entries[] | [$n, .key, (.value|tostring), (.value|tostring)] | @tsv' 2>/dev/null)
else
    info "Aucun ResourceQuota"
fi

# ═══════════════════════════════════════════════════════════
# 8. NETWORK POLICIES (informatif)
# ═══════════════════════════════════════════════════════════
section "NETWORK POLICIES"
NP=$(kubectl get networkpolicy -n "$NS" -o json 2>/dev/null)
NPCOUNT=$(echo "$NP" | jq '.items | length')
if [[ "$NPCOUNT" -gt 0 ]]; then
    warn "$NPCOUNT NetworkPolicy active(s) — peut bloquer le trafic"
    echo "$NP" | jq -r '.items[] | "  - \(.metadata.name) (pods: \(.spec.podSelector.matchLabels // "all"))"'
    hint "Si un service est injoignable, vérifier les règles ingress/egress"
else
    info "Aucune NetworkPolicy"
fi

# ═══════════════════════════════════════════════════════════
# 9. EVENTS WARNING
# ═══════════════════════════════════════════════════════════
section "ÉVÉNEMENTS RÉCENTS (Warning)"
EVENTS=$(kubectl get events -n "$NS" --field-selector type=Warning --sort-by='.lastTimestamp' 2>/dev/null | tail -10)
if [[ -n "$EVENTS" ]] && [[ "$(echo "$EVENTS" | wc -l)" -gt 1 ]]; then
    echo "$EVENTS"
else
    ok "Aucun event Warning récent"
fi

# ═══════════════════════════════════════════════════════════
# RÉSUMÉ
# ═══════════════════════════════════════════════════════════
ERRORS=$(cat "$TMP/errors")
WARNS=$(cat "$TMP/warns")

section "RÉSUMÉ"
echo "Namespace: $NS"
if [[ "$ERRORS" -eq 0 && "$WARNS" -eq 0 ]]; then
    echo -e "${G}✓ Tout est OK${N}"
    exit 0
else
    [[ "$ERRORS" -gt 0 ]] && echo -e "${R}✗ $ERRORS erreur(s) critique(s)${N}"
    [[ "$WARNS"  -gt 0 ]] && echo -e "${Y}⚠ $WARNS avertissement(s)${N}"
    exit 1
fi
