# Azure Container Instances への CI/CD 構築手順

## 概要

GitHub にプッシュするたびに、Azure Container Instances (ACI) に自動デプロイする CI/CD パイプラインを構築します。

## 前提条件

- Azure アカウント
- GitHub アカウント
- Azure CLI のインストール
- Azure初回セットアップを実施済み

## 1. Azureでサービスプリンシパルの作成

```bash
# サブスクリプションIDを取得
az account show --query id --output tsv

# サービスプリンシパルを作成
# {subscription-id}は上記で取得したサブスクリプションIDに置き換えてください
az ad sp create-for-rbac --name "trigger-game-github-actions" --role contributor --scopes /subscriptions/{subscription-id}/resourceGroups/trigger-game-rg --sdk-auth

# Microsoft.ContainerInstanceのリソースプロバイダーを登録
az provider register --namespace Microsoft.ContainerInstance
```

## 2. GitHub Secrets の設定

GitHub リポジトリの **Settings > Secrets and variables > Actions > Repository secrets** で以下のシークレットを追加：

| Secret名 | 値 |
|---------|---|
| `AZURE_CREDENTIALS` | サービスプリンシパルのJSON全体 |
| `AZURE_REGISTRY_LOGIN_SERVER` | `triggergameacr.azurecr.io` |
| `AZURE_REGISTRY_USERNAME` | ACRのユーザー名 |
| `AZURE_REGISTRY_PASSWORD` | ACRのパスワード |
| `AZURE_RESOURCE_GROUP` | `trigger-game-rg` |
| `AZURE_CONTAINER_NAME` | `trigger-game-app` |
| `AZURE_CONTAINER_ENV_NAME` | `trigger-game-env` |

## 3. Dockerfile の作成

プロジェクトルートに `Dockerfile` を作成：

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS base

# Build引数を定義
ARG VITE_WS_SERVER_URL
ARG NODE_ENV=production

# 環境変数として設定
ENV VITE_WS_SERVER_URL=$VITE_WS_SERVER_URL
ENV NODE_ENV=$NODE_ENV

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM base AS production
WORKDIR /app

# Security: Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 remix

# Copy built application
COPY --from=deps --chown=remix:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=remix:nodejs /app/build ./build
COPY --from=build --chown=remix:nodejs /app/public ./public
COPY --chown=remix:nodejs package*.json ./

USER remix

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]
```

## 4. GitHub Actions ワークフローの作成

`.github/workflows/azure-deploy.yml` を作成：

```yaml
# .github/workflows/azure-deploy.yml
name: Deploy to Azure Container Apps

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ${{ secrets.AZURE_REGISTRY_LOGIN_SERVER }}
  IMAGE_NAME: trigger-game
  VITE_WS_SERVER_URL: ${{ vars.VITE_WS_SERVER_URL }}

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    # Checkout code
    - name: Checkout code
      uses: actions/checkout@v4

    # Setup Node.js
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    # Install dependencies and run tests
    - name: Install dependencies
      run: npm ci

    - name: Run tests
      run: npm test --if-present

    - name: Run linting
      run: npm run lint --if-present

    # Build Docker image
    - name: Log in to Azure Container Registry
      uses: azure/docker-login@v1
      with:
        login-server: ${{ secrets.AZURE_REGISTRY_LOGIN_SERVER }}
        username: ${{ secrets.AZURE_REGISTRY_USERNAME }}
        password: ${{ secrets.AZURE_REGISTRY_PASSWORD }}

    - name: Build and push Docker image
      run: |
        # Generate unique tag
        IMAGE_TAG=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
        LATEST_TAG=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
        
        # Build image
        docker build \
          --build-arg VITE_WS_SERVER_URL=${{ vars.VITE_WS_SERVER_URL }} \
          --build-arg NODE_ENV=production \
          -t $IMAGE_TAG \
          -t $LATEST_TAG .

        # Push images
        docker push $IMAGE_TAG
        docker push $LATEST_TAG
        
        # Set output for next step
        echo "IMAGE_TAG=$IMAGE_TAG" >> $GITHUB_ENV

    # Deploy to Azure Container Apps
    - name: Login to Azure
      uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}

    # Container Apps 環境の確保
    - name: Ensure Container Apps Environment
      run: |
        # Container Apps 環境が存在するかチェック
        az containerapp env show \
          --name trigger-game-env \
          --resource-group ${{ secrets.AZURE_RESOURCE_GROUP }} \
          --query "name" --output tsv || \
        az containerapp env create \
          --name trigger-game-env \
          --resource-group ${{ secrets.AZURE_RESOURCE_GROUP }} \
          --location japaneast

    # Container Apps へのデプロイ
    - name: Deploy to Azure Container Apps
      run: |
        # Container App が存在するかチェックして更新または作成
        if az containerapp show \
          --name ${{ secrets.AZURE_CONTAINER_NAME }} \
          --resource-group ${{ secrets.AZURE_RESOURCE_GROUP }} \
          --query "name" --output tsv > /dev/null 2>&1; then
          
          echo "Container App が存在します。更新中..."
          az containerapp update \
            --name ${{ secrets.AZURE_CONTAINER_NAME }} \
            --resource-group ${{ secrets.AZURE_RESOURCE_GROUP }} \
            --image ${{ env.IMAGE_TAG }} \
            --set-env-vars \
              NODE_ENV=production \
              PORT=3000 \
              VITE_WS_SERVER_URL=${{ vars.VITE_WS_SERVER_URL }}
        else
          echo "Container App が存在しません。新規作成中..."
          az containerapp create \
            --name ${{ secrets.AZURE_CONTAINER_NAME }} \
            --resource-group ${{ secrets.AZURE_RESOURCE_GROUP }} \
            --environment trigger-game-env \
            --image ${{ env.IMAGE_TAG }} \
            --target-port 3000 \
            --ingress external \
            --min-replicas 0 \
            --max-replicas 5 \
            --cpu 0.5 \
            --memory 1Gi \
            --registry-server ${{ secrets.AZURE_REGISTRY_LOGIN_SERVER }} \
            --registry-username ${{ secrets.AZURE_REGISTRY_USERNAME }} \
            --registry-password ${{ secrets.AZURE_REGISTRY_PASSWORD }} \
            --env-vars \
              NODE_ENV=production \
              PORT=3000 \
              VITE_WS_SERVER_URL=${{ vars.VITE_WS_SERVER_URL }}
        fi

    # Get deployment URL（Container Apps 用）
    - name: Get Container App URL
      run: |
        FQDN=$(az containerapp show \
          --resource-group ${{ secrets.AZURE_RESOURCE_GROUP }} \
          --name ${{ secrets.AZURE_CONTAINER_NAME }} \
          --query properties.configuration.ingress.fqdn \
          --output tsv)
        echo "🚀 Deployment successful!"
        echo "🌐 Application URL: https://$FQDN"
```

## 5. 環境変数の設定 (オプション)

本番環境用の環境変数が必要な場合、GitHub Secrets に追加して workflow で使用

```yaml
# ワークフロー内で環境変数を設定
- name: Deploy to Azure Container Instances
  run: |
    az container create \
      # ... 他のオプション ...
      --environment-variables \
        NODE_ENV=production \
        PORT=3000 \
        DATABASE_URL=${{ secrets.DATABASE_URL }} \
        SESSION_SECRET=${{ secrets.SESSION_SECRET }}
```

## 6. デプロイの確認

### 6.1 GitHub Actions の実行確認

1. GitHub リポジトリの **Actions** タブで実行状況を確認
2. 各ステップのログを確認

### 6.2 Azure Container Instances の確認

```bash
# コンテナの状態確認
az container show \
  --resource-group trigger-game-rg \
  --name trigger-game-app \
  --query "{Status:instanceView.state,FQDN:ipAddress.fqdn,IP:ipAddress.ip}" \
  --output table

# ログの確認
az container logs --resource-group trigger-game-rg --name trigger-game-app --follow
```

## 7. トラブルシューティング

### よくある問題と解決策

#### 7.1 認証エラー

```bash
# サービスプリンシパルの再作成
az ad sp create-for-rbac \
  --name "trigger-game-github-actions" \
  --role contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/trigger-game-rg \
  --sdk-auth
```

#### 7.2 コンテナが起動しない

```bash
# 詳細なログを確認
az container logs \
  --resource-group trigger-game-rg \
  --name trigger-game-app \
  --follow

# コンテナの詳細情報を確認
az container show --resource-group trigger-game-rg --name trigger-game-app
```

#### 7.3 ポート接続エラー

- Dockerfile の `EXPOSE 3000` を確認
- ACI の `--ports 3000` オプションを確認
- アプリケーションが正しいポートで起動しているか確認

## 8. コスト最適化

### 8.1 オートシャットダウン設定

```yaml
# 開発環境用: 夜間停止
- name: Stop container (development)
  if: github.ref != 'refs/heads/main'
  run: |
    az container stop \
      --resource-group ${{ secrets.AZURE_RESOURCE_GROUP }} \
      --name ${{ secrets.AZURE_CONTAINER_NAME }}
```

### 8.2 リソース制限

```bash
# 小さなリソースで開始
--cpu 0.5 \
--memory 0.5 \
```

## 9. セキュリティ強化

### 9.1 イメージの脆弱性スキャン

```yaml
# ワークフロー内に追加
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE_TAG }}
    format: 'sarif'
    output: 'trivy-results.sarif'

- name: Upload Trivy scan results to GitHub Security tab
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: 'trivy-results.sarif'
```

### 9.2 Secrets のローテーション

定期的に以下を更新：
- Azure サービスプリンシパル
- ACR のパスワード
- アプリケーション用の秘密鍵

## 10. 監視とアラート

### 10.1 Azure Monitor 設定

```bash
# ログ分析ワークスペースの作成
az monitor log-analytics workspace create \
  --resource-group trigger-game-rg \
  --workspace-name trigger-game-logs
```

これで GitHub にプッシュするたびに自動的に Azure Container Instances にデプロイされるようになります。

## 補足

- 初回デプロイ時は Azure リソースの作成に時間がかかる場合があります
- 本番環境では適切なドメイン設定とSSL証明書の設定を推奨します
- 定期的にコンテナイメージの更新とセキュリティパッチの適用を行ってください