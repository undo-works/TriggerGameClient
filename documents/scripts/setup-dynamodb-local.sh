#!/bin/bash

echo "DynamoDB Local テーブル作成スクリプト"
echo "================================"

ENDPOINT="http://localhost:8001"

echo ""
echo "1. MatchTable を作成中..."
aws dynamodb create-table \
    --table-name MatchTable \
    --attribute-definitions \
        AttributeName=matchId,AttributeType=S \
        AttributeName=status,AttributeType=S \
        AttributeName=createdAt,AttributeType=N \
    --key-schema \
        AttributeName=matchId,KeyType=HASH \
    --global-secondary-indexes \
        'IndexName=status-createdAt-index,KeySchema=[{AttributeName=status,KeyType=HASH},{AttributeName=createdAt,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5}' \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --endpoint-url $ENDPOINT

echo ""
echo "2. PlayerTable を作成中..."
aws dynamodb create-table \
    --table-name PlayerTable \
    --attribute-definitions \
        AttributeName=playerId,AttributeType=S \
        AttributeName=status,AttributeType=S \
        AttributeName=lastActiveAt,AttributeType=N \
    --key-schema \
        AttributeName=playerId,KeyType=HASH \
    --global-secondary-indexes \
        'IndexName=status-lastActiveAt-index,KeySchema=[{AttributeName=status,KeyType=HASH},{AttributeName=lastActiveAt,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5}' \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --endpoint-url $ENDPOINT

echo ""
echo "3. GameStateTable を作成中..."
aws dynamodb create-table \
    --table-name GameStateTable \
    --attribute-definitions \
        AttributeName=matchId,AttributeType=S \
        AttributeName=turn,AttributeType=N \
    --key-schema \
        AttributeName=matchId,KeyType=HASH \
        AttributeName=turn,KeyType=RANGE \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --endpoint-url $ENDPOINT

echo ""
echo "4. ActionTable を作成中..."
aws dynamodb create-table \
    --table-name ActionTable \
    --attribute-definitions \
        AttributeName=matchId,AttributeType=S \
        AttributeName=actionId,AttributeType=S \
        AttributeName=matchTurn,AttributeType=S \
        AttributeName=submittedAt,AttributeType=N \
    --key-schema \
        AttributeName=matchId,KeyType=HASH \
        AttributeName=actionId,KeyType=RANGE \
    --global-secondary-indexes \
        'IndexName=turn-submittedAt-index,KeySchema=[{AttributeName=matchTurn,KeyType=HASH},{AttributeName=submittedAt,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5}' \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --endpoint-url $ENDPOINT

echo ""
echo "5. ConnectionTable を作成中..."
aws dynamodb create-table \
    --table-name ConnectionTable \
    --attribute-definitions \
        AttributeName=connectionId,AttributeType=S \
        AttributeName=playerId,AttributeType=S \
        AttributeName=connectedAt,AttributeType=N \
    --key-schema \
        AttributeName=connectionId,KeyType=HASH \
    --global-secondary-indexes \
        'IndexName=playerId-connectedAt-index,KeySchema=[{AttributeName=playerId,KeyType=HASH},{AttributeName=connectedAt,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5}' \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --endpoint-url $ENDPOINT

echo ""
echo "6. TurnResultTable を作成中..."
aws dynamodb create-table \
    --table-name TurnResultTable \
    --attribute-definitions \
        AttributeName=matchId,AttributeType=S \
        AttributeName=turn,AttributeType=N \
    --key-schema \
        AttributeName=matchId,KeyType=HASH \
        AttributeName=turn,KeyType=RANGE \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --endpoint-url $ENDPOINT

echo ""
echo "================================"
echo "全てのテーブルの作成が完了しました！"
echo ""
echo "テーブル一覧を確認しています..."
aws dynamodb list-tables --endpoint-url $ENDPOINT

echo ""
echo "設定完了！"
