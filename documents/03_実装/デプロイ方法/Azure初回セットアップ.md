# Azure初回セットアップ

## 概要

Azureにリソースグループの作成やコンテナの配置などの初回セットアップを行う

## 前提条件

- Azure アカウント
- GitHub アカウント
- Azure CLI のインストール

## 1. Azure リソースの準備

### 事前準備

#### Azure CLI をインストール

以下URLから[Azure CLIの最新のMSI(64ビット)]をクリックしてダウンロード

https://learn.microsoft.com/ja-jp/cli/azure/install-azure-cli-windows?view=azure-cli-latest&pivots=msi

ダウンロードしたmsiファイルを実行してインストールする

### 1.1 Azure CLI でログイン

```bash
az login
```

### 1.2 リソースグループの作成

```bash
# リソースグループを作成
az group create --name trigger-game-rg --location japaneast
```

### 1.3 Azure Container Apps の作成

```bash
# Container Apps のリソースプロバイダーを登録
az provider register --namespace Microsoft.App

# Container Apps の監視を有効化
az provider register --namespace Microsoft.OperationalInsights

# Container Apps 環境を作成
az containerapp env create \
  --name trigger-game-env \
  --resource-group trigger-game-rg \
  --location japaneast

# Container App を作成（Scale to Zero 有効）
az containerapp create \
  --name trigger-game-app \
  --resource-group trigger-game-rg \
  --environment trigger-game-env \
  --image triggergameacr.azurecr.io/trigger-game:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 10 \
  --cpu 0.5 \
  --memory 1Gi \
  --registry-server triggergameacr.azurecr.io \
  --registry-username [ACRユーザー名] \
  --registry-password [ACRパスワード]
```

