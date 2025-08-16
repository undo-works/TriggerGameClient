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

### 1.3 Azure Container Registry (ACR) の作成

```bash
# Container Registry のリソースプロバイダーを登録
az provider register --namespace Microsoft.ContainerRegistry

# コンテナレジストリを作成
az acr create --resource-group trigger-game-rg --name triggergameacr --sku Basic --admin-enabled true

# ログイン認証情報を取得
az acr credential show --name triggergameacr
```

