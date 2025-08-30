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
az ad sp create-for-rbac --name "trigger-game-github-actions" --role contributor --scopes /subscriptions/{subscription-id}/resourceGroups/trigger-game-rg --json-auth

# Microsoft.Appのリソースプロバイダーを登録
az provider register --namespace Microsoft.App
```

## 2. GitHub Secrets の設定

GitHub リポジトリの **Settings > Secrets and variables > Actions > Repository secrets** で以下のシークレットを追加：

| Secret名 | 値 | 備考 |
|---------|---|------|
| `AZURE_CREDENTIALS` | サービスプリンシパルのJSON全体 | |
| `AZURE_REGISTRY_LOGIN_SERVER` | `triggergameacr.azurecr.io` | |
| `AZURE_REGISTRY_USERNAME` | ACRのユーザー名 | |
| `AZURE_REGISTRY_PASSWORD` | ACRのパスワード | |
| `AZURE_RESOURCE_GROUP` | `trigger-game-rg` | |
| `AZURE_CONTAINER_NAME` | `trigger-game-app` | |
| `AZURE_CONTAINER_ENV_NAME` | `trigger-game-env` | |
| `WEB_PUBSUB_CONNECTION_STRING` | Azure Web PubSub の接続文字列 | Web PubSubページの設定 > キー > 接続文字列 |

## 3. 環境変数の設定

GitHub リポジトリの **Settings > Secrets and variables > Actions > Repository variables** で以下の環境変数を追加：

| 環境変数名 | 値 |
|---------|---|
| `VITE_WS_SERVER_URL` | WebSocketサーバーのURL |
| `VITE_WEB_PUBSUB_AUTH_API_URL` | Web PubSub 認証APIのURL |

## 4. デプロイの確認

### 4.1 GitHub Actions の実行確認

1. GitHub リポジトリの **Actions** タブで実行状況を確認
2. 各ステップのログを確認

### 4.2 Azure Container Instances の確認

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

## 5. トラブルシューティング

### よくある問題と解決策

#### 5.1 認証エラー

```bash
# サービスプリンシパルの再作成
az ad sp create-for-rbac \
  --name "trigger-game-github-actions" \
  --role contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/trigger-game-rg \
  --sdk-auth
```

#### 5.2 コンテナが起動しない

```bash
# 詳細なログを確認
az container logs \
  --resource-group trigger-game-rg \
  --name trigger-game-app \
  --follow

# コンテナの詳細情報を確認
az container show --resource-group trigger-game-rg --name trigger-game-app
```

#### 5.3 ポート接続エラー

- Dockerfile の `EXPOSE 3000` を確認
- ACI の `--ports 3000` オプションを確認
- アプリケーションが正しいポートで起動しているか確認

## 6. コスト最適化

### 6.1 オートシャットダウン設定

```yaml
# 開発環境用: 夜間停止
- name: Stop container (development)
  if: github.ref != 'refs/heads/main'
  run: |
    az container stop \
      --resource-group ${{ secrets.AZURE_RESOURCE_GROUP }} \
      --name ${{ secrets.AZURE_CONTAINER_NAME }}
```

### 6.2 リソース制限

```bash
# 小さなリソースで開始
--cpu 0.5 \
--memory 0.5 \
```

## 7. セキュリティ強化

### 7.1 イメージの脆弱性スキャン

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

### 7.2 Secrets のローテーション

定期的に以下を更新：
- Azure サービスプリンシパル
- ACR のパスワード
- アプリケーション用の秘密鍵

## 8. 監視とアラート

### 8.1 Azure Monitor 設定

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