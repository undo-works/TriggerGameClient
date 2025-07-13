# DynamoDB Local セットアップガイド

## 前提条件
- DynamoDB Localが http://localhost:8001 で起動していること
- AWS CLIがインストールされていること

## セットアップ手順

### 1. WindowsでAWS CLIの設定（初回のみ）
```cmd
aws configure
```
以下のように設定（DynamoDB Localでは実際の値は不要）:
- AWS Access Key ID: `test`
- AWS Secret Access Key: `test`
- Default region name: `us-east-1`
- Default output format: `json`

### 2. スクリプトの実行

#### Windows:
```cmd
cd c:\Users\markz\Documents\09_Trigger\TriggerApp\scripts
setup-dynamodb-local.bat
```

#### Mac/Linux:
```bash
cd /Users/markz/Documents/09_Trigger/TriggerApp/scripts
chmod +x setup-dynamodb-local.sh
./setup-dynamodb-local.sh
```

### 3. テーブル作成の確認
スクリプト実行後、以下のコマンドでテーブルが正しく作成されたことを確認:

```bash
aws dynamodb list-tables --endpoint-url http://localhost:8001
```

期待される結果:
```json
{
    "TableNames": [
        "ActionTable",
        "ConnectionTable", 
        "GameStateTable",
        "MatchTable",
        "PlayerTable",
        "TurnResultTable"
    ]
}
```

## 個別テーブルの確認

### テーブル詳細の確認:
```bash
aws dynamodb describe-table --table-name MatchTable --endpoint-url http://localhost:8001
```

### テーブルの削除（必要に応じて）:
```bash
aws dynamodb delete-table --table-name MatchTable --endpoint-url http://localhost:8001
```

## トラブルシューティング

### エラー: "The security token included in the request is invalid"
- AWS CLIの設定を確認してください
- `aws configure`で適当な値を設定してください（DynamoDB Localでは認証は不要）

### エラー: "Table already exists"
- テーブルが既に存在する場合のエラーです
- 削除してから再実行するか、既存のテーブルをそのまま使用してください

### エラー: "Could not connect to the endpoint URL"
- DynamoDB Localが起動していることを確認してください
- ポート8001でアクセス可能かチェックしてください

## データの投入例

### サンプルデータを投入:
```bash
# プレイヤーデータを投入
aws dynamodb put-item \
    --table-name PlayerTable \
    --item '{
        "playerId": {"S": "player1"},
        "connectionId": {"S": "test-conn-1"}, 
        "status": {"S": "online"},
        "lastActiveAt": {"N": "1672531200"}
    }' \
    --endpoint-url http://localhost:8001

# マッチデータを投入
aws dynamodb put-item \
    --table-name MatchTable \
    --item '{
        "matchId": {"S": "match-001"},
        "status": {"S": "waiting"},
        "player1Id": {"S": "player1"},
        "currentTurn": {"N": "0"},
        "phase": {"S": "setup"},
        "createdAt": {"N": "1672531200"}
    }' \
    --endpoint-url http://localhost:8001
```

### データの確認:
```bash
aws dynamodb scan --table-name PlayerTable --endpoint-url http://localhost:8001
aws dynamodb scan --table-name MatchTable --endpoint-url http://localhost:8001
```
