#!/bin/bash
# Script de Sincronização e Commit Automático para o Sigjur
# Este script contorna o erro de R/W do iCloud e envia alterações diretamente ao GitHub.

REPO_URL="https://github.com/limaemazzetti-dot/sigjur.git"
ICLOUD_DIR="/Users/thiegojesus/Library/Mobile Documents/com~apple~CloudDocs/PROJETOS – APP/Sigjur – Plataforma de Advocacia"
SYNC_DIR="/tmp/sigjur-git-sync"

echo "=== Iniciando Sincronizacao Sigjur ==="
echo "Pasta iCloud: $ICLOUD_DIR"
echo "Pasta Git de Trabalho: $SYNC_DIR"
echo "GitHub Repo: $REPO_URL"

# Prepara diretorio de trabalho fora do iCloud
if [ ! -d "$SYNC_DIR" ]; then
    echo "Clonando repositorio GitHub..."
    rm -rf "$SYNC_DIR"
    git clone "$REPO_URL" "$SYNC_DIR"
    if [ $? -ne 0 ]; then
        echo "Falha ao clonar. Inicializando repositorio local no diretório temporário..."
        mkdir -p "$SYNC_DIR"
        cd "$SYNC_DIR" || exit 1
        git init
        git remote add origin "$REPO_URL"
    fi
fi

sync_and_push() {
    echo "Sincronizando arquivos do iCloud..."

    # Copia arquivos novos e alterados do iCloud para o workspace local
    # Ignora node_modules, .git, .output e arquivos de build
    rsync -av --delete \
      --exclude 'node_modules/' \
      --exclude '.git/' \
      --exclude '.output/' \
      --exclude 'dist/' \
      --exclude '.wrangler/' \
      "$ICLOUD_DIR/" "$SYNC_DIR/"

    cd "$SYNC_DIR" || return

    # Força a branch principal a ser main
    git branch -M main 2>/dev/null

    if [[ -n $(git status -s) ]]; then
        echo "Alterações detectadas! Enviando commits ao GitHub..."
        git add -A
        git commit -m "Auto-sync: $(date '+%Y-%m-%d %H:%M:%S')"

        echo "Realizando push para o Github..."
        git push -u origin main
        if [ $? -eq 0 ]; then
            echo "Concluído com sucesso na data $(date)"
        else
            echo "Erro no Git push. Verifique se realizou login no github ou SSH key."
        fi
    else
        echo "Sem alterações pendentes."
    fi
}

# Loop de monitoramento de alterações (roda a cada 15 segundos)
while true; do
    sync_and_push
    echo "Aguardando próxima verificação..."
    sleep 15
done
