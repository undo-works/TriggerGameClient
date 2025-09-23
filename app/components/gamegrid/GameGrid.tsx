import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "@remix-run/react";
import { CHARACTER_STATUS, TRIGGER_STATUS } from "../../constants/status";
import {
  useWebSocket,
  type WebSocketMessage,
} from "../../contexts/WebSocketContext";
import { HexUtils } from "./hexUtils";
import type {
  CombatResult,
  CombatStepResult,
  StepCharacterResult,
  TurnCompleteResult,
} from "./types";
import { playerCharacterKeys, playerPositions } from "~/utils/CharacterConfig";
import { CharacterManager } from "./characterManager";
import { CharacterImageState } from "~/entities/CharacterImageState";
import { PlayerCharacterState } from "~/entities/PlayerCharacterState";

/**
 * Phaserゲームシーンを動的に作成するファクトリ関数
 * SSR対応のため、Phaserオブジェクトを引数として受け取る
 */
const createGridScene = (Phaser: typeof import("phaser")) => {
  return class GridScene extends Phaser.Scene {
    // グリッドの設定
    private gridSize: number = 32; // 1マスのサイズ（ピクセル）
    private gridWidth: number = 36; // グリッドの幅（マス数）
    private gridHeight: number = 36; // グリッドの高さ（マス数）

    // 六角形グリッドの設定
    private hexRadius: number = 24; // 六角形の半径
    private hexWidth: number = this.hexRadius * 2; // 六角形の幅
    private hexHeight: number = this.hexRadius * Math.sqrt(3); // 六角形の高さ

    // グリッドの余白設定
    private marginLeft: number = 0; // 左側の余白
    private marginTop: number = 0; // 上側の余白

    // Phaserオブジェクト
    private hoveredCell: { x: number; y: number } | null = null; // マウスでホバーしているセル
    private cellHighlight!: Phaser.GameObjects.Graphics; // セルのハイライト表示用

    /** キャラクター管理 */
    private characterManager: CharacterManager = new CharacterManager();

    // トリガー設定フェーズ
    private triggerSettingMode: boolean = false; // トリガー設定モード
    private triggerSettingType: "main" | "sub" | null = null; // 設定中のトリガータイプ
    private triggerFan: Phaser.GameObjects.Graphics | null = null; // トリガー扇形の表示
    private isDraggingTrigger: boolean = false; // トリガー扇形をドラッグ中かどうか
    private currentTriggerAngle: number = 0; // 現在のトリガー角度

    constructor() {
      super({ key: "GridScene" });
    }

    // 行動履歴
    private actionHistory: {
      character: Phaser.GameObjects.Image;
      mainAzimuth: number;
      subAzimuth: number;
      position: { col: number; row: number };
      mainTrigger: string;
      subTrigger: string;
      timestamp: string;
    }[] = [];

    // ユニット行動モード関連
    private isActionMode: boolean = false;
    private actionAnimationInProgress: boolean = false;

    /** グリッドフィールドの関数群 */
    private hexUtils!: HexUtils;

    // トリガー表示管理
    private triggerDisplays: Map<
      Phaser.GameObjects.Image,
      {
        mainTrigger: Phaser.GameObjects.Graphics | null;
        subTrigger: Phaser.GameObjects.Graphics | null;
      }
    > = new Map();

    /**
     * Phaserのpreload段階で呼ばれる
     * アセット（画像、音声など）の読み込みを行う
     */
    preload() {
      this.createBackgroundTexture();
      this.loadCharacterAssets();
    }

    /**
     * キャラクター画像を読み込む
     */
    private loadCharacterAssets() {
      // キャラクター画像を読み込み
      this.load.image("character01", "/character/01.svg");
      this.load.image("character02", "/character/02.svg");
      this.load.image("character03", "/character/03.svg");
      this.load.image("character04", "/character/04.svg");
    }

    /**
     * 背景テクスチャ（白色）を動的に作成
     * HTMLのCanvasを使って白色のテクスチャを描画し、Phaserテクスチャとして登録
     */
    private createBackgroundTexture() {
      // HTMLのCanvasを作成
      const canvas = document.createElement("canvas");
      canvas.width = this.gridSize;
      canvas.height = this.gridSize;
      const ctx = canvas.getContext("2d")!;

      // 背景色を設定（真っ白）
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, this.gridSize, this.gridSize);

      // 作成したCanvasをPhaserテクスチャとして登録
      this.textures.addCanvas("whiteTile", canvas);
    }

    /**
     * 余白を初期化する（画面サイズの半分程度）
     */
    private initializeMargins() {
      // ゲームのキャンバスサイズを取得
      const gameWidth = this.cameras.main.width;
      const gameHeight = this.cameras.main.height;

      // 画面の横幅/縦幅の半分程度の余白を設定
      this.marginLeft = gameWidth * 0.5;
      this.marginTop = gameHeight * 0.5;
    }

    /**
     * トリガーの扇形エリアを描画する
     * @param centerCol 中心列
     * @param centerRow 中心行
     * @param direction 方向（度数）
     * @param angle 角度範囲（度数）
     * @param range 射程
     * @param color 色（16進数）
     * @param alpha 透明度
     */
    private drawTriggerFan(
      centerCol: number,
      centerRow: number,
      direction: number,
      angle: number,
      range: number,
      color: number = 0xff6b6b,
      alpha: number = 0.4
    ): Phaser.GameObjects.Graphics {
      const centerPos = this.hexUtils.getHexPosition(centerCol, centerRow);
      const fanGraphics = this.add.graphics();

      // 扇形の描画
      fanGraphics.fillStyle(color, alpha);
      fanGraphics.lineStyle(2, color, 0.8);

      // 扇形の範囲（ピクセル単位での半径）
      const fanRadius = range * this.hexRadius * 2;

      // 角度をラジアンに変換（Phaserは-90度オフセット）
      const startAngle = ((direction - angle / 2 - 90) * Math.PI) / 180;
      const endAngle = ((direction + angle / 2 - 90) * Math.PI) / 180;

      // 扇形を描画
      fanGraphics.beginPath();
      fanGraphics.moveTo(centerPos.x, centerPos.y);
      fanGraphics.arc(
        centerPos.x,
        centerPos.y,
        fanRadius,
        startAngle,
        endAngle
      );
      fanGraphics.closePath();
      fanGraphics.fillPath();
      fanGraphics.strokePath();

      fanGraphics.setDepth(0.7);
      fanGraphics.setInteractive(
        new Phaser.Geom.Circle(centerPos.x, centerPos.y, fanRadius),
        Phaser.Geom.Circle.Contains
      );

      return fanGraphics;
    }

    /**
     * マウス位置から角度を計算する（カメラのズーム・スクロール対応）
     * @param centerX 中心X座標（世界座標）
     * @param centerY 中心Y座標（世界座標）
     * @param mouseX マウスX座標（スクリーン座標）
     * @param mouseY マウスY座標（スクリーン座標）
     * @returns 角度（度数）
     */
    private calculateMouseAngle(
      centerX: number,
      centerY: number,
      mouseX: number,
      mouseY: number
    ): number {
      // カメラのズームとスクロールを考慮したマウス座標変換
      const camera = this.cameras.main;
      const worldMouseX = (mouseX + camera.scrollX) / camera.zoom;
      const worldMouseY = (mouseY + camera.scrollY) / camera.zoom;

      const dx = worldMouseX - centerX;
      const dy = worldMouseY - centerY;
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      return angle;
    }

    /**
     * カメラの設定（スクロールと拡大縮小）
     */
    private setupCamera() {
      // カメラの境界を設定（グリッド全体をカバー + 余白）
      const gridWidth = this.gridWidth * this.hexWidth * 0.75 + this.hexWidth;
      const gridHeight = this.gridHeight * this.hexHeight + this.hexHeight;

      // 余白を含めたワールドサイズ
      const worldWidth = gridWidth + this.marginLeft * 2;
      const worldHeight = gridHeight + this.marginTop * 2;

      // カメラの境界を設定
      this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

      // 初期位置を中央に設定（余白を考慮）
      this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);

      // 三段階のズームレベル
      const zoomLevels = [0.5, 1.0, 2.0]; // 縮小、普通、拡大
      let currentZoomIndex = 1; // 初期値は普通（1.0）

      // マウスホイールで三段階ズーム
      this.input.on(
        "wheel",
        (
          pointer: Phaser.Input.Pointer,
          gameObjects: Phaser.GameObjects.GameObject[],
          deltaX: number,
          deltaY: number
        ) => {
          const camera = this.cameras.main;

          if (deltaY > 0) {
            // ズームアウト（縮小方向）
            if (currentZoomIndex > 0) {
              currentZoomIndex--;
            }
          } else {
            // ズームイン（拡大方向）
            if (currentZoomIndex < zoomLevels.length - 1) {
              currentZoomIndex++;
            }
          }

          const newZoom = zoomLevels[currentZoomIndex];
          camera.setZoom(newZoom);

          // ズームレベルをReact側に通知
          zoomChangeEmitter.dispatchEvent(
            new CustomEvent("zoomChanged", {
              detail: { zoomLevel: currentZoomIndex, zoom: newZoom },
            })
          );
        }
      );

      // WASDキーでカメラ移動
      const cursors = this.input.keyboard?.createCursorKeys();
      if (cursors && this.input.keyboard) {
        this.input.keyboard.on("keydown-W", () => {
          this.cameras.main.scrollY -= 50;
        });

        this.input.keyboard.on("keydown-S", () => {
          this.cameras.main.scrollY += 50;
        });

        this.input.keyboard.on("keydown-A", () => {
          this.cameras.main.scrollX -= 50;
        });

        this.input.keyboard.on("keydown-D", () => {
          this.cameras.main.scrollX += 50;
        });

        // 矢印キーでも移動可能
        this.input.keyboard.on("keydown-UP", () => {
          this.cameras.main.scrollY -= 50;
        });

        this.input.keyboard.on("keydown-DOWN", () => {
          this.cameras.main.scrollY += 50;
        });

        this.input.keyboard.on("keydown-LEFT", () => {
          this.cameras.main.scrollX -= 50;
        });

        this.input.keyboard.on("keydown-RIGHT", () => {
          this.cameras.main.scrollX += 50;
        });
      }
    }

    /**
     * 六角形グリッドのユーティリティを初期化する
     */
    initializeHexUtils() {
      this.hexUtils = new HexUtils({
        gridSize: this.gridSize,
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        hexRadius: this.hexRadius,
        hexWidth: this.hexWidth,
        hexHeight: this.hexHeight,
        marginLeft: this.marginLeft,
        marginTop: this.marginTop,
      });
    }

    /**
     * Phaserのcreate段階で呼ばれる
     * ゲームオブジェクトの初期化を行う
     */
    create() {
      this.initializeMargins(); // 余白を初期化
      this.setupCamera(); // カメラの設定を最初に行う
      this.initializeHexUtils(); // 六角形グリッドのユーティリティ初期化
      this.createBackgroundTiles(); // 背景タイルを配置
      this.createGrid(); // グリッドラインを描画
      this.createCharacters(); // キャラクターを配置
      this.createMouseInteraction(); // マウスイベントを設定
      this.createKeyboardInteraction(); // キーボードイベントを設定
      this.setupActionModeListeners(); // 行動モードのイベントリスナーを設定
    }

    /**
     * 行動モードのイベントリスナーを設定
     */
    private setupActionModeListeners() {
      const handleExecuteActions = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { turnCompleteResult, playerId } = customEvent.detail;
        this.executeAllActions(turnCompleteResult, playerId);
      };

      executeActionsEmitter.addEventListener(
        "executeAllActions",
        handleExecuteActions
      );
    }

    /**
     * 背景タイルを六角形グリッドに敷き詰める
     */
    private createBackgroundTiles() {
      // 各グリッドセルに六角形の背景を配置
      for (let col = 0; col < this.gridWidth; col++) {
        for (let row = 0; row < this.gridHeight; row++) {
          const pos = this.hexUtils.getHexPosition(col, row);

          // 六角形を描画
          const hexagon = this.add.graphics();
          hexagon.fillStyle(0xffffff, 1.0); // 白色
          hexagon.lineStyle(1, 0x000000, 0.3); // 黒色の境界線（線幅、色、透明度）

          const vertices = this.hexUtils.getHexVertices(pos.x, pos.y);
          hexagon.beginPath();
          hexagon.moveTo(vertices[0], vertices[1]);
          for (let i = 2; i < vertices.length; i += 2) {
            hexagon.lineTo(vertices[i], vertices[i + 1]);
          }
          hexagon.closePath();
          hexagon.fillPath();
          hexagon.strokePath();

          hexagon.setDepth(0); // 背景レイヤー
        }
      }
    }

    /**
     * グリッドライン（六角形の境界線は背景タイルで描画済み）
     */
    private createGrid() {
      // セルハイライト用のGraphicsオブジェクトを作成
      this.cellHighlight = this.add.graphics();
      this.cellHighlight.setVisible(false); // 初期状態では非表示
      this.cellHighlight.setDepth(0.5); // 背景より前、キャラクターより後ろ
    }

    /**
     * マウスイベントを設定する（六角形グリッド対応）
     */
    private createMouseInteraction() {
      // カメラドラッグ用の変数
      let isDraggingCamera = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let cameraStartX = 0;
      let cameraStartY = 0;

      // マウス移動イベント
      this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        // カメラドラッグ中の処理
        if (isDraggingCamera) {
          const deltaX = pointer.x - dragStartX;
          const deltaY = pointer.y - dragStartY;
          this.cameras.main.scrollX = cameraStartX - deltaX;
          this.cameras.main.scrollY = cameraStartY - deltaY;
          return;
        }

        // 行動モード中は操作を無効化
        if (this.isActionMode || this.actionAnimationInProgress) {
          return;
        }

        // トリガー扇形をドラッグ中の場合
        if (
          this.isDraggingTrigger &&
          this.characterManager.selectedCharacter &&
          this.triggerFan
        ) {
          const centerPos = this.hexUtils.getHexPosition(
            this.characterManager.selectedCharacter.position.col,
            this.characterManager.selectedCharacter.position.row
          );
          const newAngle = this.calculateMouseAngle(
            centerPos.x,
            centerPos.y,
            pointer.x,
            pointer.y
          );
          this.currentTriggerAngle = newAngle;
          this.updateTriggerFan();
          return;
        }

        // 通常のホバー処理（左クリック操作でない場合はスキップ）
        if (
          !this.triggerSettingMode &&
          !pointer.rightButtonDown() &&
          !pointer.middleButtonDown()
        ) {
          const hexCoord = this.hexUtils.pixelToHex(
            pointer.x,
            pointer.y,
            this.cameras.main
          );
          if (
            hexCoord.col >= 0 &&
            hexCoord.col < this.gridWidth &&
            hexCoord.row >= 0 &&
            hexCoord.row < this.gridHeight
          ) {
            this.hoveredCell = { x: hexCoord.col, y: hexCoord.row };
            this.updateCellHighlight();
          } else {
            this.hoveredCell = null;
            this.cellHighlight.setVisible(false);
          }
        }
      });

      // マウスクリックイベント
      this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        // 右クリックまたは中クリックの場合はカメラドラッグ開始
        if (pointer.rightButtonDown() || pointer.middleButtonDown()) {
          isDraggingCamera = true;
          dragStartX = pointer.x;
          dragStartY = pointer.y;
          cameraStartX = this.cameras.main.scrollX;
          cameraStartY = this.cameras.main.scrollY;
          return;
        }

        // 行動モード中は操作を無効化
        if (this.isActionMode || this.actionAnimationInProgress) {
          console.log("行動実行中のため操作できません");
          return;
        }
        // トリガー設定モードの場合
        if (
          this.triggerSettingMode &&
          this.triggerFan &&
          this.characterManager.selectedCharacter
        ) {
          this.isDraggingTrigger = true;
          return;
        }

        // マウス座標を六角形グリッド座標に変換
        const hexCoord = this.hexUtils.pixelToHex(
          pointer.x,
          pointer.y,
          this.cameras.main
        );

        // グリッド範囲内の場合
        if (
          hexCoord.col >= 0 &&
          hexCoord.col < this.gridWidth &&
          hexCoord.row >= 0 &&
          hexCoord.row < this.gridHeight
        ) {
          // そのマスにキャラクターがいるかチェック
          const characterAtPosition =
            this.characterManager.getPlayerCharacterAt(
              hexCoord.col,
              hexCoord.row
            );

          if (characterAtPosition) {
            if (
              characterAtPosition === this.characterManager.selectedCharacter
            ) {
              // 既に選択されているキャラクターを再度クリック：トリガー設定モードに入る
              console.log(
                `選択中のキャラクターをクリック: トリガー設定モードに入ります`
              );
              const actionPoints = characterAtPosition.actionPoints || 0;
              // 行動力を消費
              this.consumeActionPoint(actionPoints - 1);
              this.startTriggerSetting();
            } else {
              // 他のプレイヤーキャラクターをクリックした場合：選択
              this.selectCharacter(characterAtPosition.image);
              console.log(
                `キャラクターを選択: (${hexCoord.col}, ${hexCoord.row})`
              );
            }
          } else if (this.characterManager.selectedCharacter) {
            // キャラクターが選択されている状態で空のマスをクリックしたパターン
            const actionPoints =
              this.characterManager.playerCharacters.find(
                (char) =>
                  char.image === this.characterManager.selectedCharacter?.image
              )?.actionPoints || 0;
            const adjacentHexes = this.hexUtils.getAdjacentHexes(
              this.characterManager.selectedCharacter.position.col,
              this.characterManager.selectedCharacter.position.row,
              actionPoints
            );

            // クリックされた位置が移動可能マスかチェック
            const isMovable = adjacentHexes.find(
              (hex) => hex.col === hexCoord.col && hex.row === hexCoord.row
            );

            // 移動前のポジションを保存
            this.characterManager.beforePosition =
              this.characterManager.selectedCharacter.position;

            if (isMovable && !characterAtPosition) {
              this.moveCharacter(hexCoord.col, hexCoord.row);
              // 移動後にトリガー設定モードに入る
              this.startTriggerSetting();
              // 行動力を消費
              this.consumeActionPoint(isMovable.remainActiveCount);
            } else {
              // 移動不可能なマスをクリック：選択解除
              this.clearSelection();
            }
          } else {
            // 何も選択されていない状態でクリック
            console.log(
              `クリックされた六角形: (${hexCoord.col}, ${hexCoord.row})`
            );
          }
        }
      });

      // マウス離上イベント
      this.input.on("pointerup", () => {
        // カメラドラッグ終了
        if (isDraggingCamera) {
          isDraggingCamera = false;
          return;
        }

        if (this.isDraggingTrigger && this.triggerSettingMode) {
          this.isDraggingTrigger = false;
          this.completeTriggerSetting(this.currentTriggerAngle);
        }
      });
    }

    /**
     * キャラクターを選択する
     * @param character 選択されたキャラクター
     */
    private selectCharacter(character: Phaser.GameObjects.Image) {
      // 行動力をチェック
      const selectedCharacter =
        this.characterManager.findPlayerCharacterByImage(character);
      if (selectedCharacter && selectedCharacter.actionPoints <= 0) {
        console.log("このキャラクターは既に行動が完了しています。");
        return;
      }

      // 既に選択されているキャラクターをリセット
      this.clearSelection();

      // 新しいキャラクターを選択
      this.characterManager.selectedCharacter = selectedCharacter;

      if (this.characterManager.selectedCharacter) {
        // 選択されたキャラクターを強調表示
        character.setTint(0xffff00); // 黄色で強調

        // 移動可能なマスを表示
        this.showMovableHexes();

        // React側にキャラクター選択を通知
        notifyCharacterSelection(
          this.characterManager.selectedCharacter.id,
          this.characterManager.selectedCharacter.actionPoints
        );
      }
    }

    /**
     * 移動可能な六角形マスを表示する
     */
    private showMovableHexes() {
      if (!this.characterManager.selectedCharacter) {
        console.log(
          "キャラクターが選択されていません。",
          this.characterManager.selectedCharacter
        );
        return;
      }

      // 前回の移動可能マスを削除
      this.characterManager.movableHexes.forEach((hex) => hex.destroy());
      this.characterManager.movableHexes = [];

      const selectedCharacter =
        this.characterManager.findPlayerCharacterByImage(
          this.characterManager.selectedCharacter.image
        );
      if (!selectedCharacter) return;

      // 行動力をチェック
      const actionPoints = selectedCharacter.actionPoints || 0;

      const adjacentHexes = this.hexUtils.getAdjacentHexes(
        this.characterManager.selectedCharacter.position.col,
        this.characterManager.selectedCharacter.position.row,
        actionPoints
      );

      // 現在の位置をオレンジ色でハイライト（トリガー設定可能を示す）
      const currentPos = this.hexUtils.getHexPosition(
        selectedCharacter.position.col,
        selectedCharacter.position.row
      );
      const currentHex = this.add.graphics();
      currentHex.fillStyle(0xff8c00, 0.3); // オレンジ色、透明度0.3
      currentHex.lineStyle(2, 0xff6600, 1.0); // 濃いオレンジ色の境界線

      const currentVertices = this.hexUtils.getHexVertices(
        currentPos.x,
        currentPos.y
      );
      currentHex.beginPath();
      currentHex.moveTo(currentVertices[0], currentVertices[1]);
      for (let i = 2; i < currentVertices.length; i += 2) {
        currentHex.lineTo(currentVertices[i], currentVertices[i + 1]);
      }
      currentHex.closePath();
      currentHex.fillPath();
      currentHex.strokePath();

      currentHex.setDepth(0.8); // キャラクターより後ろ、背景より前
      this.characterManager.movableHexes.push(currentHex);

      // 隣接する6マスに緑色のハイライトを表示（行動力が残っている場合のみ）
      if (actionPoints > 0) {
        adjacentHexes.forEach((hex) => {
          // そのマスに他のキャラクターがいない場合のみ移動可能
          if (!this.characterManager.isCharacterAt(hex.col, hex.row)) {
            const pos = this.hexUtils.getHexPosition(hex.col, hex.row);

            const movableHex = this.add.graphics();
            movableHex.fillStyle(0x00ff00, 0.4); // 緑色、透明度0.4
            movableHex.lineStyle(2, 0x00aa00, 1.0); // 濃い緑色の境界線

            const vertices = this.hexUtils.getHexVertices(pos.x, pos.y);
            movableHex.beginPath();
            movableHex.moveTo(vertices[0], vertices[1]);
            for (let i = 2; i < vertices.length; i += 2) {
              movableHex.lineTo(vertices[i], vertices[i + 1]);
            }
            movableHex.closePath();
            movableHex.fillPath();
            movableHex.strokePath();

            movableHex.setDepth(0.8); // キャラクターより後ろ、背景より前

            // 移動可能マスのリストに追加
            this.characterManager.movableHexes.push(movableHex);
          }
        });
      }
    }

    /**
     * 選択状態をクリアする
     */
    private clearSelection() {
      // 選択されたキャラクターの色を元に戻す
      if (this.characterManager.selectedCharacter) {
        // プレイヤーキャラクターか敵キャラクターかで色を分ける
        if (
          this.characterManager.playerCharacters.includes(
            this.characterManager.selectedCharacter
          )
        ) {
          this.characterManager.selectedCharacter.image.setTint(0xadd8e6); // 薄い青色
        } else {
          this.characterManager.selectedCharacter.image.setTint(0xffb6c1); // 薄い赤色
        }
      }

      // 移動可能マスを削除
      this.characterManager.movableHexes.forEach((hex) => hex.destroy());
      this.characterManager.movableHexes = [];

      // トリガー表示をクリア
      this.clearAllTriggerDisplays();

      // トリガー設定モードをリセット
      this.triggerSettingMode = false;
      this.triggerSettingType = null;

      // 選択状態をリセット
      this.characterManager.selectedCharacter = null;

      // React側にキャラクター選択解除を通知
      notifyCharacterSelection(null, 0);
    }

    /**
     * キャラクターを指定された位置に移動する
     * @param targetCol 移動先の列
     * @param targetRow 移動先の行
     */
    private moveCharacter(targetCol: number, targetRow: number) {
      if (!this.characterManager.selectedCharacter) return;

      // 移動先の位置を計算
      const targetPosition = this.hexUtils.getHexPosition(targetCol, targetRow);

      // キャラクターを移動
      this.characterManager.selectedCharacter.image.setPosition(
        targetPosition.x,
        targetPosition.y
      );

      // // キャラクターの位置情報を更新（移動後の位置）
      this.characterManager.selectedCharacter.position = {
        col: targetCol,
        row: targetRow,
      };

      console.log(`キャラクターが (${targetCol}, ${targetRow}) に移動しました`);
    }

    /**
     * キャラクターのトリガー方向を表示する（ユニット行動モード専用）
     */
    private showTriggerDirections(character: Phaser.GameObjects.Image) {
      // 行動モード中のみ表示
      if (!this.isActionMode) return;

      // キャラクターが削除されている場合は何もしない
      if (!character || character.scene === null) return;

      // キャラクターがマップに存在しない場合は何もしない
      const selectedCharacterState =
        this.characterManager.findCharacterByImage(character);
      if (!selectedCharacterState) return;

      // 既存のトリガー表示をクリア
      this.clearTriggerDisplayForCharacter(character);

      const position = selectedCharacterState.position;
      const directions = selectedCharacterState.direction;
      const characterId = selectedCharacterState.id;

      if (!position || !directions || !characterId) return;

      // キャラクターのステータスを取得
      const characterKey = characterId as keyof typeof CHARACTER_STATUS;
      const characterStatus = CHARACTER_STATUS[characterKey];
      if (!characterStatus) return;

      const centerPos = this.hexUtils.getHexPosition(
        position.col,
        position.row
      );

      // メイントリガーのステータスを取得
      const mainTriggerKey =
        characterStatus.main as keyof typeof TRIGGER_STATUS;
      const mainTriggerStatus = TRIGGER_STATUS[mainTriggerKey];

      // サブトリガーのステータスを取得
      const subTriggerKey = characterStatus.sub as keyof typeof TRIGGER_STATUS;
      const subTriggerStatus = TRIGGER_STATUS[subTriggerKey];

      // 敵キャラクターかどうかを判定
      const isEnemyCharacter = this.characterManager.enemyCharacters.includes(
        selectedCharacterState
      );

      // 敵の場合は角度に180度を加算
      const mainDirection = isEnemyCharacter
        ? directions.main + 180
        : directions.main;
      const subDirection = isEnemyCharacter
        ? directions.sub + 180
        : directions.sub;

      // メイントリガーを表示（赤系クリアカラー、実際のangleとrangeを使用）
      const mainTrigger = this.createTriggerDisplay(
        centerPos.x,
        centerPos.y,
        mainDirection,
        0xff4444, // 赤系
        0.3,
        mainTriggerStatus.angle,
        mainTriggerStatus.range
      );

      // サブトリガーを表示（青系クリアカラー、実際のangleとrangeを使用）
      const subTrigger = this.createTriggerDisplay(
        centerPos.x,
        centerPos.y,
        subDirection,
        0x4444ff, // 青系
        0.2,
        subTriggerStatus.angle,
        subTriggerStatus.range
      );

      // ラベルを追加（実際のトリガー射程に基づいて位置を計算、敵の場合は180度補正）
      const mainLabel = this.add.text(
        centerPos.x +
          Math.cos(((mainDirection - 90) * Math.PI) / 180) *
            this.hexRadius *
            mainTriggerStatus.range *
            2,
        centerPos.y +
          Math.sin(((mainDirection - 90) * Math.PI) / 180) *
            this.hexRadius *
            mainTriggerStatus.range *
            2,
        "Main",
        {
          fontSize: "10px",
          color: "#ff4444",
          backgroundColor: "#ffffff",
          padding: { x: 2, y: 1 },
        }
      );
      mainLabel.setOrigin(0.5);
      mainLabel.setDepth(3);

      const subLabel = this.add.text(
        centerPos.x +
          Math.cos(((subDirection - 90) * Math.PI) / 180) *
            this.hexRadius *
            subTriggerStatus.range *
            2,
        centerPos.y +
          Math.sin(((subDirection - 90) * Math.PI) / 180) *
            this.hexRadius *
            subTriggerStatus.range *
            2,
        "Sub",
        {
          fontSize: "10px",
          color: "#4444ff",
          backgroundColor: "#ffffff",
          padding: { x: 2, y: 1 },
        }
      );
      subLabel.setOrigin(0.5);
      subLabel.setDepth(3);

      // トリガー表示を保存（ラベルも含める）
      this.triggerDisplays.set(character, {
        mainTrigger,
        subTrigger,
      });

      // ラベル用の保存領域を追加
      mainTrigger.setData("label", mainLabel);
      subTrigger.setData("label", subLabel);
    }

    /**
     * キャラクターの現在位置に基づいてトリガー表示を更新（アニメーション追従用）
     */
    private updateTriggerPositionsForCharacter(
      character: Phaser.GameObjects.Image,
      stepChar: StepCharacterResult,
      playerId: string
    ) {
      if (!this.isActionMode) {
        console.log(
          "アクションモードではないため、トリガー表示を更新しません",
          stepChar
        );
        return;
      }
      // キャラクターが削除されている場合は何もしない
      if (!character || character.scene === null) {
        console.log(
          "キャラクターが削除されているため、トリガー表示を更新しません",
          stepChar
        );
        return;
      }
      // キャラクターがマップに存在しない場合は何もしない
      const characterState =
        this.characterManager.findCharacterByImage(character);
      if (!characterState) {
        console.log(
          "キャラクターがマップに存在しないため、トリガー表示を更新しません",
          stepChar
        );
        return;
      }
      // キャラクターが撃墜されている場合は削除
      if (stepChar.isDefeat) {
        console.log(
          "キャラクターが撃墜されているため、トリガー表示を更新しません",
          stepChar
        );
        character.setVisible(false);
        return;
      }
      const directions = characterState.direction;
      const characterId = stepChar.characterId;
      if (!directions || !characterId) return;

      // キャラクターのステータスを取得
      const characterStatus = stepChar.characterStatus;
      if (!characterStatus) {
        console.warn("キャラクターステータスが見つかりません", stepChar);
        return;
      }

      // メイントリガーのステータスを取得
      const mainTriggerKey =
        characterStatus.main as keyof typeof TRIGGER_STATUS;
      const mainTriggerStatus = TRIGGER_STATUS[mainTriggerKey];

      // サブトリガーのステータスを取得
      const subTriggerKey = characterStatus.sub as keyof typeof TRIGGER_STATUS;
      const subTriggerStatus = TRIGGER_STATUS[subTriggerKey];

      // 敵キャラクターかどうかを判定
      const isEnemyCharacter = stepChar.playerId !== playerId;

      // 敵の場合は角度に180度を加算
      const mainDirection = isEnemyCharacter
        ? directions.main + 180
        : directions.main;
      const subDirection = isEnemyCharacter
        ? directions.sub + 180
        : directions.sub;

      const displays = this.triggerDisplays.get(character);
      if (!displays) return;

      // キャラクターの現在のピクセル位置を使用
      const currentX = character.x;
      const currentY = character.y;

      // メイントリガーの表示を更新
      if (displays.mainTrigger) {
        displays.mainTrigger.clear();
        this.drawTriggerFanShape(
          displays.mainTrigger,
          currentX,
          currentY,
          mainDirection,
          0xff4444,
          0.3,
          mainTriggerStatus.angle,
          mainTriggerStatus.range
        );

        // メインラベルの位置も更新
        const mainLabel = displays.mainTrigger.getData(
          "label"
        ) as Phaser.GameObjects.Text;
        if (mainLabel) {
          mainLabel.setPosition(
            currentX +
              Math.cos(((mainDirection - 90) * Math.PI) / 180) *
                this.hexRadius *
                mainTriggerStatus.range *
                2,
            currentY +
              Math.sin(((mainDirection - 90) * Math.PI) / 180) *
                this.hexRadius *
                mainTriggerStatus.range *
                2
          );
        }
      }

      // サブトリガーの表示を更新
      if (displays.subTrigger) {
        displays.subTrigger.clear();
        this.drawTriggerFanShape(
          displays.subTrigger,
          currentX,
          currentY,
          subDirection,
          0x4444ff,
          0.2,
          subTriggerStatus.angle,
          subTriggerStatus.range
        );

        // サブラベルの位置も更新
        const subLabel = displays.subTrigger.getData(
          "label"
        ) as Phaser.GameObjects.Text;
        if (subLabel) {
          subLabel.setPosition(
            currentX +
              Math.cos(((subDirection - 90) * Math.PI) / 180) *
                this.hexRadius *
                subTriggerStatus.range *
                2,
            currentY +
              Math.sin(((subDirection - 90) * Math.PI) / 180) *
                this.hexRadius *
                subTriggerStatus.range *
                2
          );
        }
      }
    }

    /**
     * トリガー扇形の表示を作成する
     */
    private createTriggerDisplay(
      centerX: number,
      centerY: number,
      direction: number,
      color: number,
      alpha: number,
      triggerAngle: number = 60,
      triggerRange: number = 3
    ): Phaser.GameObjects.Graphics {
      const triggerGraphics = this.add.graphics();
      triggerGraphics.setDepth(1);

      // 扇形の設定（トリガーの実際のangleとrangeを使用）
      const radius = this.hexRadius * triggerRange * 2;
      const fanAngle = triggerAngle;

      // Phaserの座標系に合わせて角度を補正（-90度）
      const correctedDirection = direction - 90;

      // 開始角度と終了角度を計算（度数を使用）
      const startAngle = (correctedDirection - fanAngle / 2) * (Math.PI / 180);
      const endAngle = (correctedDirection + fanAngle / 2) * (Math.PI / 180);

      // 扇形を描画
      triggerGraphics.fillStyle(color, alpha);
      triggerGraphics.lineStyle(2, color, 0.8);

      triggerGraphics.beginPath();
      triggerGraphics.moveTo(centerX, centerY);
      triggerGraphics.arc(
        centerX,
        centerY,
        radius,
        startAngle,
        endAngle,
        false
      );
      triggerGraphics.closePath();
      triggerGraphics.fillPath();
      triggerGraphics.strokePath();

      return triggerGraphics;
    }

    /**
     * 既存のGraphicsオブジェクトに扇形を描画する（アニメーション追従用）
     */
    private drawTriggerFanShape(
      graphics: Phaser.GameObjects.Graphics,
      centerX: number,
      centerY: number,
      direction: number,
      color: number,
      alpha: number,
      triggerAngle: number = 60,
      triggerRange: number = 3
    ) {
      // 扇形の設定（トリガーの実際のangleとrangeを使用）
      const radius = this.hexRadius * triggerRange * 2;
      const fanAngle = triggerAngle;

      // Phaserの座標系に合わせて角度を補正（-90度）
      const correctedDirection = direction - 90;

      // 開始角度と終了角度を計算（度数を使用）
      const startAngle = (correctedDirection - fanAngle / 2) * (Math.PI / 180);
      const endAngle = (correctedDirection + fanAngle / 2) * (Math.PI / 180);

      // 扇形を描画
      graphics.fillStyle(color, alpha);
      graphics.lineStyle(2, color, 0.8);

      graphics.beginPath();
      graphics.moveTo(centerX, centerY);
      graphics.arc(centerX, centerY, radius, startAngle, endAngle, false);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
    }

    /**
     * 全てのトリガー表示をクリア
     */
    private clearAllTriggerDisplays() {
      this.triggerDisplays.forEach((displays) => {
        if (displays.mainTrigger) {
          // ラベルも削除
          const mainLabel = displays.mainTrigger.getData("label");
          if (mainLabel) mainLabel.destroy();
          displays.mainTrigger.destroy();
        }
        if (displays.subTrigger) {
          // ラベルも削除
          const subLabel = displays.subTrigger.getData("label");
          if (subLabel) subLabel.destroy();
          displays.subTrigger.destroy();
        }
      });
      this.triggerDisplays.clear();
    }

    /**
     * 特定のキャラクターのトリガー表示をクリア
     */
    private clearTriggerDisplayForCharacter(
      character: Phaser.GameObjects.Image
    ) {
      const displays = this.triggerDisplays.get(character);
      if (displays) {
        if (displays.mainTrigger) {
          // ラベルも削除
          const mainLabel = displays.mainTrigger.getData("label");
          if (mainLabel) mainLabel.destroy();
          displays.mainTrigger.destroy();
        }
        if (displays.subTrigger) {
          // ラベルも削除
          const subLabel = displays.subTrigger.getData("label");
          if (subLabel) subLabel.destroy();
          displays.subTrigger.destroy();
        }
        this.triggerDisplays.delete(character);
      }
    }
    private updateCellHighlight() {
      if (!this.hoveredCell) return;

      // 前のハイライトをクリア
      this.cellHighlight.clear();

      // 六角形の位置を計算
      const pos = this.hexUtils.getHexPosition(
        this.hoveredCell.x,
        this.hoveredCell.y
      );

      // 薄い青色で六角形をハイライト
      this.cellHighlight.fillStyle(0x87ceeb, 0.5); // 色と透明度

      const vertices = this.hexUtils.getHexVertices(pos.x, pos.y);
      this.cellHighlight.beginPath();
      this.cellHighlight.moveTo(vertices[0], vertices[1]);
      for (let i = 2; i < vertices.length; i += 2) {
        this.cellHighlight.lineTo(vertices[i], vertices[i + 1]);
      }
      this.cellHighlight.closePath();
      this.cellHighlight.fillPath();

      // ハイライトを表示
      this.cellHighlight.setVisible(true);
    }

    /**
     * キャラクターを六角形グリッドに配置する
     */
    private createCharacters() {
      // 自分のキャラクターを配置
      playerPositions.forEach((pos, index) => {
        const characterId = "character" + String(index + 1).padStart(2, "0"); // "01", "02", "03", "04"
        const position = this.hexUtils.getHexPosition(pos.col, pos.row);
        const character = this.add.image(
          position.x,
          position.y,
          playerCharacterKeys[index]
        );
        character.setOrigin(0.5, 0.5);
        character.setDisplaySize(this.hexRadius * 1.2, this.hexRadius * 1.2); // 六角形に合わせたサイズ
        character.setDepth(2); // 前面に表示

        // 青い色調を追加（自分のキャラクター識別用）
        character.setTint(0xadd8e6); // 薄い青色

        // キャラクターをクリック可能にする
        character.setInteractive();

        // 初期行動力を設定
        const characterKey = characterId as keyof typeof CHARACTER_STATUS;
        const characterStatus = CHARACTER_STATUS[characterKey];
        this.characterManager.playerCharacters.push(
          new PlayerCharacterState(
            character,
            { col: pos.col, row: pos.row },
            characterId,
            { main: 0, sub: 0 },
            null,
            characterStatus.activeCount,
            null,
            this.hexUtils
          )
        );
      });

      // 相手のキャラクター（上辺行）を配置
      const enemyPositions = [
        { col: 4, row: 34 },
        { col: 12, row: 34 },
        { col: 20, row: 34 },
        { col: 28, row: 34 },
      ];

      // 相手のキャラクターを配置（逆転した座標を使用）
      enemyPositions.forEach((pos, index) => {
        const invertedPos = this.hexUtils.invertPosition(pos);
        const position = this.hexUtils.getHexPosition(
          invertedPos.col,
          invertedPos.row
        );
        const characterId = "character" + String(index + 1).padStart(2, "0"); // 敵キャラクターID: "01", "02", "03", "04"
        const character = this.add.image(
          position.x,
          position.y,
          playerCharacterKeys[index]
        );
        character.setOrigin(0.5, 0.5);
        character.setDisplaySize(this.hexRadius * 1.2, this.hexRadius * 1.2); // 六角形に合わせたサイズ
        character.setDepth(2); // 前面に表示

        // 赤い色調を追加（相手のキャラクター識別用）
        character.setTint(0xffb6c1); // 薄い赤色

        // 相手のキャラクターは上下反転
        character.setFlipY(true);

        this.characterManager.enemyCharacters.push({
          image: character,
          id: characterId,
          position: { col: invertedPos.col, row: invertedPos.row },
          direction: { main: 180, sub: 180 },
          triggerDisplay: null,
        });
      });
    }

    /**
     * 個別の戦闘結果を処理する
     */
    private processCombatResult(result: CombatResult) {
      // 戦闘エフェクトの表示
      if (result.isHit) {
        if (result.isAvoid) {
          console.log("攻撃が回避されました！");
          // 回避表示
          this.showAvoidText(result.defender);
        } else {
          // ダメージ表示（回避されていない場合のみ）
          this.showDamageText(result.defender, result.damage);
        }

        if (result.isDefeat) {
          // ベイルアウト表示と撃破処理
          this.showBailOutAndRemoveCharacter(result.defender);
        }
      }
    }

    /**
     * 回避テキストを表示する
     */
    private showAvoidText(character: Phaser.GameObjects.Image) {
      // キャラクターの位置を取得
      const position =
        this.characterManager.findCharacterByImage(character)?.position;
      if (!position) return;

      const pixelPos = this.hexUtils.getHexPosition(position.col, position.row);

      // 回避テキストを作成
      const avoidText = this.add.text(
        pixelPos.x,
        pixelPos.y - this.hexRadius * 0.8,
        "MISS",
        {
          fontSize: "14px",
          color: "#00ff00",
          fontStyle: "bold",
          backgroundColor: "#000000",
          padding: { x: 4, y: 2 },
        }
      );
      avoidText.setOrigin(0.5);
      avoidText.setDepth(10); // 最前面に表示

      // アニメーション: 上に移動しながらフェードアウト
      this.tweens.add({
        targets: avoidText,
        y: pixelPos.y - this.hexRadius * 2,
        alpha: 0,
        duration: 1500,
        ease: "Power2",
        onComplete: () => {
          avoidText.destroy();
        },
      });
    }

    /**
     * ダメージテキストを表示する
     */
    private showDamageText(
      character: Phaser.GameObjects.Image,
      damage: number
    ) {
      // キャラクターの位置を取得
      const position =
        this.characterManager.findCharacterByImage(character)?.position;
      if (!position) return;

      const pixelPos = this.hexUtils.getHexPosition(position.col, position.row);

      // ダメージテキストを作成
      const damageText = this.add.text(
        pixelPos.x,
        pixelPos.y - this.hexRadius * 0.8,
        `-${damage}`,
        {
          fontSize: "16px",
          color: "#ff0000",
          fontStyle: "bold",
          backgroundColor: "#ffffff",
          padding: { x: 4, y: 2 },
        }
      );
      damageText.setOrigin(0.5);
      damageText.setDepth(10); // 最前面に表示

      // アニメーション: 上に移動しながらフェードアウト
      this.tweens.add({
        targets: damageText,
        y: pixelPos.y - this.hexRadius * 2,
        alpha: 0,
        duration: 1500,
        ease: "Power2",
        onComplete: () => {
          damageText.destroy();
        },
      });
    }

    /**
     * ベイルアウト表示と撃破されたキャラクターの削除
     */
    private showBailOutAndRemoveCharacter(character: Phaser.GameObjects.Image) {
      // キャラクターの位置を取得
      const position =
        this.characterManager.findCharacterByImage(character)?.position;
      if (!position) return;

      const pixelPos = this.hexUtils.getHexPosition(position.col, position.row);

      // ベイルアウトテキストを作成
      const bailOutText = this.add.text(
        pixelPos.x,
        pixelPos.y - this.hexRadius * 0.8,
        "ベイルアウト",
        {
          fontSize: "14px",
          color: "#ffffff",
          fontStyle: "bold",
          backgroundColor: "#000000",
          padding: { x: 6, y: 3 },
        }
      );
      bailOutText.setOrigin(0.5);
      bailOutText.setDepth(10); // 最前面に表示

      // ベイルアウトテキストのアニメーション
      this.tweens.add({
        targets: bailOutText,
        y: pixelPos.y - this.hexRadius * 2,
        alpha: 0,
        duration: 2000,
        ease: "Power2",
        onComplete: () => {
          bailOutText.destroy();
        },
      });

      // キャラクターを徐々に透明にして削除
      this.tweens.add({
        targets: character,
        alpha: 0,
        duration: 1000,
        delay: 500, // ベイルアウトテキスト表示後少し待ってから開始
        ease: "Power2",
        onComplete: () => {
          // キャラクターを完全に削除
          this.removeCharacterCompletely(character);
        },
      });
    }

    /**
     * キャラクターを完全に削除する
     */
    private removeCharacterCompletely(character: Phaser.GameObjects.Image) {
      // HPバーを削除
      const hpBar = character.getData("hpBar");
      if (hpBar) {
        hpBar.destroy();
      }

      // 各種マップからキャラクターを削除
      this.characterManager.findCharacterByImage(character)?.image.destroy();

      // トリガー表示をクリア
      this.clearTriggerDisplayForCharacter(character);

      // キャラクターオブジェクトを削除
      character.destroy();

      console.log("キャラクターが完全に削除されました");
    }

    /**
     * トリガー設定モードを開始する
     */
    private startTriggerSetting() {
      if (!this.characterManager.selectedCharacter) return;

      this.triggerSettingMode = true;
      this.triggerSettingType = "main";

      // キャラクターを紫色で強調表示（トリガー設定モード）
      this.characterManager.selectedCharacter.image.setTint(0xff00ff);

      // mainトリガーの設定を開始
      this.showTriggerFan();
    }

    /**
     * トリガー扇形を表示する
     */
    private showTriggerFan() {
      if (!this.characterManager.selectedCharacter || !this.triggerSettingType)
        return;

      const characterState = this.characterManager.findCharacterByImage(
        this.characterManager.selectedCharacter.image
      );
      if (!characterState) return;

      // キャラクターのステータスを取得
      const characterKey = characterState.id as keyof typeof CHARACTER_STATUS;
      const characterStatus = CHARACTER_STATUS[characterKey];
      if (!characterStatus) return;

      // 設定中のトリガータイプに応じて装備を取得
      const triggerName =
        this.triggerSettingType === "main"
          ? characterStatus.main
          : characterStatus.sub;
      const triggerStatus =
        TRIGGER_STATUS[triggerName as keyof typeof TRIGGER_STATUS];
      if (!triggerStatus) return;

      // キャラクター固有の角度と射程を使用
      const angle = triggerStatus.angle;
      const range = triggerStatus.range;

      console.log(
        `${triggerName}（${this.triggerSettingType}）トリガーの向きを設定してください（角度範囲: ${angle}度, 射程: ${range}）`
      );
      console.log(
        "扇形をドラッグして角度を調整し、マウスを離すかクリックで確定してください"
      );

      // 初期角度を設定（現在の向きまたはデフォルト）
      this.currentTriggerAngle = characterState.direction
        ? characterState.direction[this.triggerSettingType]
        : 0;

      // subトリガーの場合は色を変える
      const color = this.triggerSettingType === "main" ? 0xff6b6b : 0x6b6bff;

      // 扇形を描画（移動後の位置を中心に）
      this.triggerFan = this.drawTriggerFan(
        this.characterManager.selectedCharacter.position.col,
        this.characterManager.selectedCharacter.position.row,
        this.currentTriggerAngle,
        angle,
        range,
        color
      );
    }

    /**
     * トリガー扇形の表示を更新する
     */
    private updateTriggerFan() {
      if (
        !this.triggerFan ||
        !this.characterManager.selectedCharacter ||
        !this.triggerSettingType
      )
        return;

      const characterState = this.characterManager.findCharacterByImage(
        this.characterManager.selectedCharacter.image
      );
      if (!characterState) return;

      // キャラクターのステータスを取得
      const characterKey = characterState.id as keyof typeof CHARACTER_STATUS;
      const characterStatus = CHARACTER_STATUS[characterKey];
      if (!characterStatus) return;

      // 設定中のトリガータイプに応じて装備を取得
      const triggerName =
        this.triggerSettingType === "main"
          ? characterStatus.main
          : characterStatus.sub;
      const triggerStatus =
        TRIGGER_STATUS[triggerName as keyof typeof TRIGGER_STATUS];
      if (!triggerStatus) return;

      // 既存の扇形を削除
      this.triggerFan.destroy();

      // 新しい扇形を描画（移動後の位置を中心に）
      const angle = triggerStatus.angle;
      const range = triggerStatus.range;

      // subトリガーの場合は色を変える
      const color = this.triggerSettingType === "main" ? 0xff6b6b : 0x6b6bff;

      this.triggerFan = this.drawTriggerFan(
        this.characterManager.selectedCharacter.position.col,
        this.characterManager.selectedCharacter.position.row,
        this.currentTriggerAngle,
        angle,
        range,
        color
      );
    }

    /**
     * トリガー設定を完了する
     * @param direction 設定された方向
     */
    private completeTriggerSetting(direction: number) {
      if (!this.characterManager.selectedCharacter || !this.triggerSettingType)
        return;

      const characterState = this.characterManager.findCharacterByImage(
        this.characterManager.selectedCharacter.image
      );
      if (!characterState) return;

      // 現在のキャラクターの向きを取得または初期化
      let directions = characterState.direction;
      if (!directions) {
        directions = { main: 0, sub: 0 };
        characterState.direction = directions;
      }

      // 方向を設定
      directions[this.triggerSettingType] = direction;

      console.log(
        `${this.triggerSettingType}トリガーの向きを ${direction.toFixed(
          1
        )}度 に設定しました`
      );

      // 次のトリガー設定または完了
      if (this.triggerSettingType === "main") {
        this.triggerSettingType = "sub";
        this.clearTriggerDisplay();
        this.showTriggerFan();
      } else {
        this.finishTriggerSetting();
      }
    }

    /**
     * トリガー設定を終了する
     */
    private finishTriggerSetting() {
      // 行動履歴を記録
      this.recordActionHistory();

      this.triggerSettingMode = false;
      this.triggerSettingType = null;
      this.clearTriggerDisplay();

      console.log("トリガー設定が完了しました");

      if (!this.characterManager.selectedCharacter) return;
      // 行動力が残っているかチェック
      const remainingActionPoints =
        this.characterManager.findPlayerCharacterByImage(
          this.characterManager.selectedCharacter?.image
        )?.actionPoints ?? 0;

      if (remainingActionPoints > 0) {
        // 行動力が残っている場合：キャラクター選択を維持し、移動可能マスを再表示
        console.log(
          `行動力が${remainingActionPoints}残っています。次の行動を設定してください。`
        );
        this.showMovableHexes();

        // React側にキャラクター選択を維持することを通知
        notifyCharacterSelection(
          this.characterManager.selectedCharacter?.id,
          remainingActionPoints
        );
      } else {
        // 行動力が0の場合：選択をクリア
        console.log("行動力が0になりました。キャラクター選択をクリアします。");
        this.clearSelection();
      }

      // 行動履歴記録後に全キャラクターの行動力をチェック
      this.checkAllCharactersActionPointsCompleted();
    }

    /**
     * 行動力を消費する
     * @param remainingMoves 残りの移動回数
     */
    private consumeActionPoint(remainingMoves: number) {
      if (!this.characterManager.selectedCharacter) return;
      const currentActionPoints =
        this.characterManager.findPlayerCharacterByImage(
          this.characterManager.selectedCharacter?.image
        )?.actionPoints ?? 0;

      if (currentActionPoints && currentActionPoints > 0) {
        this.characterManager.findPlayerCharacterByImage(
          this.characterManager.selectedCharacter?.image
        )!.actionPoints = remainingMoves;

        console.log(
          `キャラクター${this.characterManager.selectedCharacter?.id}の行動力を消費しました。残り: ${remainingMoves}`
        );

        // React側に行動力の変更を通知
        actionPointsEmitter.dispatchEvent(
          new CustomEvent("actionPointsChanged", {
            detail: {
              characterId: this.characterManager.selectedCharacter?.id,
              remainingPoints: remainingMoves,
            },
          })
        );

        // 行動力が0になった場合、「行動設定済み」テキストを表示
        if (remainingMoves === 0) {
          this.showActionCompletedText(
            this.characterManager.selectedCharacter.image
          );
        }

        // 注意: 全キャラクターのチェックはfinishTriggerSetting()で行う
      }
    }

    /**
     * 全キャラクターの行動力が0になったかチェック
     */
    private checkAllCharactersActionPointsCompleted() {
      let allCompleted = true;
      let totalRemainingPoints = 0;

      // プレイヤーキャラクターの行動力をチェック
      for (const character of this.characterManager.playerCharacters) {
        const actionPoints =
          this.characterManager.findPlayerCharacterByImage(character.image)
            ?.actionPoints || 0;
        totalRemainingPoints += actionPoints;
        if (actionPoints > 0) {
          allCompleted = false;
        }
      }

      console.log(`残り行動力合計: ${totalRemainingPoints}`);

      if (allCompleted && this.characterManager.playerCharacters.length > 0) {
        console.log(
          "全キャラクターの行動が完了しました！行動履歴を送信します..."
        );
        this.sendActionHistoryToServer();
      }
    }

    /**
     * 行動履歴をサーバーに送信する
     */
    private sendActionHistoryToServer() {
      // 全キャラクターの行動履歴を取得
      const allActionData = this.getActionHistory();

      console.log("送信する行動履歴:", allActionData);

      // React側にイベントを送信（WebSocket経由でサーバーに送信）
      allActionsCompletedEmitter.dispatchEvent(
        new CustomEvent("allActionsCompleted", {
          detail: {
            actionHistory: allActionData,
            timestamp: new Date().toISOString(),
          },
        })
      );
    }

    /**
     * 行動完了テキストを表示する
     */
    private showActionCompletedText(character: Phaser.GameObjects.Image) {
      const characterState =
        this.characterManager.findPlayerCharacterByImage(character);
      if (!characterState) return;

      const pixelPos = this.hexUtils.getHexPosition(
        characterState.position.col,
        characterState.position.row
      );

      // 既存のテキストがあれば削除
      const existingText = characterState.completeText;
      if (existingText) {
        existingText.destroy();
      }

      // 新しいテキストを作成
      const text = this.add.text(pixelPos.x, pixelPos.y - 40, "行動設定済み", {
        fontSize: "12px",
        color: "#ff0000",
        backgroundColor: "#ffffff",
        padding: { x: 4, y: 2 },
      });
      text.setOrigin(0.5, 0.5);
      text.setDepth(3); // キャラクターより前面

      characterState.completeText = text;
    }

    /**
     * トリガー表示をクリアする
     */
    private clearTriggerDisplay() {
      if (this.triggerFan) {
        this.triggerFan.destroy();
        this.triggerFan = null;
      }
    }

    /**
     * 行動履歴を記録する
     */
    private recordActionHistory() {
      /** 行動履歴を記録する */
      const pushActionHistory = (col: number, row: number) => {
        if (!this.characterManager.selectedCharacter) return;

        const characterState = this.characterManager.findPlayerCharacterByImage(
          this.characterManager.selectedCharacter.image
        );
        if (!characterState) return;

        const directions = characterState.direction;
        const mainTrigger =
          CHARACTER_STATUS[characterState.id as keyof typeof CHARACTER_STATUS]
            ?.main ?? null;
        const subTrigger =
          CHARACTER_STATUS[characterState.id as keyof typeof CHARACTER_STATUS]
            ?.sub ?? null;

        if (!directions || !mainTrigger || !subTrigger) {
          console.warn(
            "行動履歴の記録に失敗",
            directions,
            mainTrigger,
            subTrigger
          );
          return;
        }

        // 行動履歴に記録
        const action = {
          character: this.characterManager.selectedCharacter.image,
          position: {
            col: col,
            row: row,
          },
          mainAzimuth: directions.main,
          subAzimuth: directions.sub,
          mainTrigger: mainTrigger,
          subTrigger: subTrigger,
          timestamp: new Date().toISOString(),
        };

        this.actionHistory.push(action);

        // キャラクターIDを取得してログに出力
        console.log(
          `行動履歴を記録: キャラクター${
            characterState.id
          }, 位置(${col}, ${row}), mainトリガー: ${directions.main.toFixed(
            1
          )}度, subトリガー: ${directions.sub.toFixed(1)}度`
        );

        // グローバル履歴に追加
        const historyEntry: ActionHistory = {
          id: `${characterState.id}-${Date.now()}`,
          characterId: characterState.id,
          position: {
            x: col,
            y: row,
          },
          mainTriggerAngle: directions.main,
          subTriggerAngle: directions.sub,
          timestamp: Date.now(),
        };
        addToGlobalHistory(historyEntry);
      };

      if (!this.characterManager.selectedCharacter) return;

      if (this.characterManager.beforePosition) {
        // 移動前の位置がある場合、その位置を記録
        const { col, row } = this.characterManager.beforePosition;

        const movePath = this.hexUtils.findPath(
          { col: col, row: row },
          this.characterManager.selectedCharacter.position
        );

        for (const step of movePath) {
          // 移動可能マスをクリック：キャラクターを移動
          pushActionHistory(step.col, step.row);
        }
      } else {
        // 移動していない場合、現在の位置を記録
        const { col, row } = this.characterManager.selectedCharacter.position;
        pushActionHistory(col, row);
      }
    }

    /**
     * 行動履歴を取得する
     */
    public getActionHistory() {
      return this.actionHistory.map((action) => ({
        characterId:
          this.characterManager.findPlayerCharacterByImage(action.character)
            ?.id || "unknown",
        position: action.position,
        mainAzimuth: action.mainAzimuth,
        subAzimuth: action.subAzimuth,
        mainTrigger: action.mainTrigger,
        subTrigger: action.subTrigger,
        timestamp: action.timestamp,
      }));
    }

    /**
     * 行動履歴をコンソールに出力する
     */
    public printActionHistory() {
      console.log("=== 行動履歴 ===");
      if (this.actionHistory.length === 0) {
        console.log("履歴なし");
        return;
      }

      this.actionHistory.forEach((action, index) => {
        const characterId =
          this.characterManager.findPlayerCharacterByImage(action.character)
            ?.id || "unknown";
        console.log(`${index + 1}. キャラクター${characterId}:`);
        console.log(
          `   位置: (${action.position.col}, ${action.position.row})`
        );
        console.log(`   mainトリガー: ${action.mainAzimuth.toFixed(1)}度`);
        console.log(`   subトリガー: ${action.subAzimuth.toFixed(1)}度`);
        console.log(`   時刻: ${action.timestamp}`);
        console.log("");
      });
    }

    /**
     * 行動履歴をクリアする
     */
    public clearActionHistory() {
      this.actionHistory = [];
      clearGlobalHistory();
      console.log("行動履歴をクリアしました");
    }

    /**
     * キーボードイベントを設定する
     */
    private createKeyboardInteraction() {
      // キーボードイベントを設定
      this.input.keyboard!.on("keydown-H", () => {
        this.printActionHistory();
      });

      this.input.keyboard!.on("keydown-C", () => {
        this.clearActionHistory();
      });

      // 使用方法をコンソールに出力
      console.log("キーボードショートカット:");
      console.log("  H: 行動履歴を表示");
      console.log("  C: 行動履歴をクリア");
    }

    /**
     * 全ユニットの行動を実行する
     * @param playerActions プレイヤーの行動履歴
     * @param enemyActions 敵の行動履歴
     * @param turnNumber ターン番号
     */
    private executeAllActions(
      turnCompleteResult: TurnCompleteResult,
      playerId: string
    ) {
      console.log(`ターン ${turnCompleteResult.turnNumber} の行動実行開始`);
      this.isActionMode = true;
      this.actionAnimationInProgress = true;

      // 全キャラクターのトリガー方向を表示（行動モード専用）
      // 注意：キャラクターの移動に合わせてトリガーも更新される
      [
        ...this.characterManager.playerCharacters,
        ...this.characterManager.enemyCharacters,
      ].forEach((character) => {
        this.showTriggerDirections(character.image);
      });
      // ステップベースの移動システムを使用
      this.executeStepBasedActions(turnCompleteResult, playerId);
    }

    /**
     * ステップベースで全キャラクターの行動を実行
     */
    private executeStepBasedActions(
      turnCompleteResult: TurnCompleteResult,
      playerId: string
    ) {
      console.log(
        `ターン ${turnCompleteResult.turnNumber} 開始 - 総ステップ数: ${turnCompleteResult.totalSteps}`
      );

      let currentStepIndex = 0;

      const executeNextStep = () => {
        if (currentStepIndex < turnCompleteResult.allStepResults.length) {
          const stepResult =
            turnCompleteResult.allStepResults[currentStepIndex];
          console.log(`ステップ ${stepResult.stepNumber} を実行中...`);

          this.executeActionStep(stepResult, playerId);
          currentStepIndex++;

          if (stepResult.winnerId !== null) {
            // 勝者が決まった場合、即座に行動モードを終了
            this.isActionMode = false;
            alert(
              `あなたの${
                stepResult.winnerId === playerId ? "勝利" : "敗北"
              }です！\nトップ画面に戻ります`
            );
            window.location.href = "/";
          } else {
            // 次のステップを1.5秒後に実行（アニメーション完了を待つ）
            this.time.delayedCall(1500, executeNextStep);
          }
        } else {
          // 全ステップ完了
          console.log("全ステップが完了しました");
          this.time.delayedCall(500, () => {
            this.completeActionPhase(turnCompleteResult.turnNumber);
          });
        }
      };

      // 最初のステップを開始
      executeNextStep();
    }

    /**
     * 指定されたステップの行動を実行
     */
    private executeActionStep(stepResult: CombatStepResult, playerId: string) {
      console.log(`=== ステップ ${stepResult.stepNumber} 実行開始 ===`);

      const onStepComplete = () => {};

      // プレイヤーキャラクターの移動
      stepResult.stepCharacterResult
        .filter((char) => char.playerId === playerId)
        .forEach((playerCharacterStepAction) => {
          const character = this.findCharacterById(
            playerCharacterStepAction.characterId
          );
          if (character) {
            this.executeCharacterSingleStep(
              character.image,
              playerCharacterStepAction,
              false,
              playerId,
              onStepComplete
            );
          }
        });

      // 敵キャラクターの移動
      stepResult.stepCharacterResult
        .filter((char) => char.playerId !== playerId)
        .forEach((enemyCharacterStepAction) => {
          const character = this.findEnemyCharacterById(
            enemyCharacterStepAction.characterId
          );
          if (character) {
            this.executeCharacterSingleStep(
              character.image,
              enemyCharacterStepAction,
              true,
              playerId,
              onStepComplete
            );
          }
        });
    }

    /**
     * キャラクターの単一ステップ移動を実行
     */
    private executeCharacterSingleStep(
      character: Phaser.GameObjects.Image,
      stepChar: StepCharacterResult,
      isEnemy: boolean,
      playerId: string,
      onComplete: () => void
    ) {
      const targetPosition = isEnemy
        ? this.hexUtils.invertPosition(stepChar.position)
        : stepChar.position;
      const targetPixelPos = this.hexUtils.getHexPosition(
        targetPosition.col,
        targetPosition.row
      );

      // トリガー方向を設定
      this.characterManager.findCharacterByImage(character)!.direction = {
        main: stepChar.mainTriggerDirection,
        sub: stepChar.subTriggerDirection,
      };

      // 1秒で移動
      this.tweens.add({
        targets: character,
        x: targetPixelPos.x,
        y: targetPixelPos.y,
        duration: 1000,
        ease: "Power2",
        onUpdate: () => {
          if (this.isActionMode) {
            this.updateTriggerPositionsForCharacter(
              character,
              stepChar,
              playerId
            );
          }
        },
        onComplete: () => {
          // 位置情報を更新
          this.characterManager.findCharacterByImage(character)!.position =
            targetPosition;

          // トリガー表示を更新
          if (this.isActionMode) {
            this.showTriggerDirections(character);
          }

          onComplete();
        },
      });
    }

    /**
     * IDでキャラクターを検索
     */
    private findCharacterById(characterId: string): CharacterImageState | null {
      for (const character of this.characterManager.playerCharacters) {
        if (character.id === characterId) {
          return character;
        }
      }
      return null;
    }

    /**
     * IDで敵キャラクターを検索
     */
    private findEnemyCharacterById(
      characterId: string
    ): CharacterImageState | null {
      for (const character of this.characterManager.enemyCharacters) {
        if (character.id === characterId) {
          return character;
        }
      }
      return null;
    }

    /**
     * 行動フェーズを完了して設定モードに戻る
     */
    private completeActionPhase(turnNumber: number) {
      console.log("行動フェーズ完了 - 設定モードに戻ります");
      this.isActionMode = false;
      this.actionAnimationInProgress = false;

      // 全キャラクターのトリガー表示をクリア
      this.clearAllTriggerDisplays();

      // 全キャラクターの行動力をリセット
      this.resetAllActionPoints();

      // 行動履歴をクリア
      this.clearActionHistory();

      // React側に行動完了を通知
      actionExecutionCompletedEmitter.dispatchEvent(
        new CustomEvent("actionExecutionCompleted", {
          detail: {
            message: "行動フェーズが完了しました。新しいターンを開始します。",
            turnNumber: turnNumber,
          },
        })
      );
    }

    /**
     * 全キャラクターの行動力をリセット
     */
    private resetAllActionPoints() {
      this.characterManager.playerCharacters.forEach((character) => {
        const characterId = character.id;
        if (characterId) {
          const characterKey = characterId as keyof typeof CHARACTER_STATUS;
          const characterStatus = CHARACTER_STATUS[characterKey];
          if (characterStatus) {
            // 行動完了テキストを削除
            character.completeText?.destroy();
            // 行動力を最大値にリセット
            this.characterManager.findPlayerCharacterByImage(
              character.image
            )!.actionPoints = characterStatus.activeCount;
          }
        }
      });
    }

    // ...existing code...
  };
};

/**
 * PhaserゲームのReactコンポーネント
 * SSR（Server-Side Rendering）対応のため、動的インポートを使用
 */
const GameGrid = () => {
  // Remix Routerのナビゲーション
  const navigate = useNavigate();

  // PhaserゲームインスタンスのRef（型安全性のため動的インポートの型を使用）
  const gameRef = useRef<import("phaser").Game | null>(null);

  // ゲームを表示するDOMコンテナのRef
  const containerRef = useRef<HTMLDivElement>(null);

  // 選択されたキャラクターのIDを管理するステート
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null
  );

  // 選択されたキャラクターの行動力を管理するステート
  const [selectedCharacterActionPoints, setSelectedCharacterActionPoints] =
    useState<number>(0);

  // ゲームモードの状態管理
  const [gameMode, setGameMode] = useState<"setup" | "action">("setup");
  const [currentTurn, setCurrentTurn] = useState<number>(1);

  // ズームレベルの状態管理
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 0: 縮小, 1: 普通, 2: 拡大
  const zoomLevels = [0.5, 1.0, 2.0];
  const zoomLabels = ["縮小", "普通", "拡大"];

  // ズームレベルを変更する関数
  const changeZoomLevel = (newLevel: number) => {
    if (newLevel >= 0 && newLevel < zoomLevels.length && gameRef.current) {
      setZoomLevel(newLevel);
      // Phaserゲームのカメラズームを変更
      const scene = gameRef.current.scene.getScene("GridScene");
      if (
        scene &&
        (scene as { cameras: { main: { setZoom: (zoom: number) => void } } })
          .cameras
      ) {
        (
          scene as { cameras: { main: { setZoom: (zoom: number) => void } } }
        ).cameras.main.setZoom(zoomLevels[newLevel]);
      }
    }
  };

  // 対戦終了処理
  const handleEndMatch = () => {
    if (readyState === WebSocket.OPEN && playerId) {
      const messageData = {
        type: "cancel_matching" as const,
        playerId: playerId,
      };
      console.log("対戦終了メッセージを送信:", messageData);
      sendMessage(messageData);
    } else {
      console.error("WebSocket接続がないか、プレイヤーIDが不足しています");
    }
  };

  // WebSocketコンテキストを使用
  const {
    readyState,
    sendMessage,
    addMessageListener,
    removeMessageListener,
    playerId,
    matchId,
    setMatchId: setContextMatchId,
    connect,
  } = useWebSocket();

  // WebSocket接続とマッチIDの初期化
  useEffect(() => {
    // マッチIDを取得（URLパラメータから）
    const urlParams = new URLSearchParams(window.location.search);
    const currentMatchId =
      urlParams.get("matchId") || window.location.pathname.split("/").pop();
    if (currentMatchId && currentMatchId !== "game") {
      setContextMatchId(currentMatchId);
    }

    // 接続していない場合は接続を開始
    if (readyState !== WebSocket.OPEN && readyState !== WebSocket.CONNECTING) {
      connect();
    }
  }, [readyState, connect, setContextMatchId]);

  // 全行動完了イベントを監視してWebSocketで送信
  useEffect(() => {
    const handleAllActionsCompleted = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { actionHistory, timestamp } = customEvent.detail;

      if (readyState === WebSocket.OPEN && playerId && matchId) {
        const messageData = {
          type: "submit_actions" as const,
          turnNumber: currentTurn,
          playerId: playerId,
          matchId: matchId,
          actionHistory: actionHistory,
          timestamp: timestamp,
        };

        console.log("WebSocketでサーバーに行動履歴を送信:", messageData);
        sendMessage(messageData);

        // UI に送信完了を表示
        console.log("✅ 行動履歴の送信が完了しました！");
      } else {
        console.error(
          "WebSocket接続がないか、プレイヤーID/マッチIDが不足しています:",
          {
            readyState,
            playerId,
            matchId,
          }
        );
      }
    };

    allActionsCompletedEmitter.addEventListener(
      "allActionsCompleted",
      handleAllActionsCompleted
    );

    return () => {
      allActionsCompletedEmitter.removeEventListener(
        "allActionsCompleted",
        handleAllActionsCompleted
      );
    };
  }, [readyState, playerId, matchId, sendMessage, currentTurn]);

  // 敵側のアクションを受信してユニット行動モードに移行
  useEffect(() => {
    const handleTurnResultSubmitted = (data: WebSocketMessage) => {
      if (data.type === "turn_result") {
        console.log("敵側のアクションを受信:", data);
        setCurrentTurn(data.turnNumber || 1);
        setGameMode("action");

        // ユニット行動開始をPhaser側に通知
        executeActionsEmitter.dispatchEvent(
          new CustomEvent("executeAllActions", {
            detail: {
              turnCompleteResult: data.result,
              playerId: playerId,
            },
          })
        );
      }
    };

    // WebSocketメッセージリスナーを追加
    addMessageListener("turn_result", handleTurnResultSubmitted);

    return () => {
      removeMessageListener("turn_result", handleTurnResultSubmitted);
    };
  }, [addMessageListener, removeMessageListener]);

  // 対戦終了関連のWebSocketメッセージ処理
  useEffect(() => {
    const handleCancelMatchingResult = (data: WebSocketMessage) => {
      if (data.type === "cancel_matching_result") {
        console.log("対戦終了結果を受信:", data);
        if (data.status === "success") {
          console.log("対戦が正常に終了されました。ホーム画面に戻ります。");
          navigate("/", { replace: true });
        }
      }
    };

    const handleOpponentCancelledMatch = (data: WebSocketMessage) => {
      if (data.type === "opponent_cancelled_match") {
        console.log("相手が対戦を終了しました:", data);
        alert(
          data.message || "相手が対戦を終了しました。ホーム画面に戻ります。"
        );
        navigate("/", { replace: true });
      }
    };

    // WebSocketメッセージリスナーを追加
    addMessageListener("cancel_matching_result", handleCancelMatchingResult);
    addMessageListener(
      "opponent_cancelled_match",
      handleOpponentCancelledMatch
    );

    return () => {
      removeMessageListener(
        "cancel_matching_result",
        handleCancelMatchingResult
      );
      removeMessageListener(
        "opponent_cancelled_match",
        handleOpponentCancelledMatch
      );
    };
  }, [addMessageListener, removeMessageListener, navigate]);

  // ズーム変更の監視
  useEffect(() => {
    const handleZoomChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { zoomLevel: newZoomLevel } = customEvent.detail;
      setZoomLevel(newZoomLevel);
    };

    zoomChangeEmitter.addEventListener("zoomChanged", handleZoomChange);
    return () => {
      zoomChangeEmitter.removeEventListener("zoomChanged", handleZoomChange);
    };
  }, []);

  // 行動実行完了の処理
  useEffect(() => {
    const handleActionExecutionCompleted = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log("行動実行完了:", customEvent.detail.message);

      // 設定モードに戻る
      setGameMode("setup");

      setCurrentTurn(customEvent.detail.turnNumber + 1);

      console.log(
        "新しいターンを開始します - ターン",
        customEvent.detail.turnNumber + 1
      );
    };

    actionExecutionCompletedEmitter.addEventListener(
      "actionExecutionCompleted",
      handleActionExecutionCompleted
    );

    return () => {
      actionExecutionCompletedEmitter.removeEventListener(
        "actionExecutionCompleted",
        handleActionExecutionCompleted
      );
    };
  }, []);

  useEffect(() => {
    // キャラクター選択の変更を監視
    const handleCharacterSelection = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { characterId, actionPoints } = customEvent.detail;
      setSelectedCharacterId(characterId);
      setSelectedCharacterActionPoints(actionPoints);
    };

    characterSelectionEmitter.addEventListener(
      "characterSelected",
      handleCharacterSelection
    );
    return () => {
      characterSelectionEmitter.removeEventListener(
        "characterSelected",
        handleCharacterSelection
      );
    };
  }, [selectedCharacterId]);

  useEffect(() => {
    // DOM要素が存在しない場合は何もしない
    if (!containerRef.current) return;

    // 既にゲームインスタンスが存在する場合は何もしない
    if (gameRef.current) return;

    /**
     * Phaserライブラリを動的に読み込む関数
     * SSR時にwindowオブジェクトが存在しないため、クライアント側でのみ実行
     */
    const loadPhaser = async () => {
      try {
        // Phaserライブラリを動的にインポート
        const Phaser = await import("phaser");

        // GridSceneクラスを作成（Phaserオブジェクトを渡す）
        const GridScene = createGridScene(Phaser);

        // Phaserゲームの設定（画面サイズに合わせて調整）
        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO, // 自動的にWebGLまたはCanvasを選択
          width: window.innerWidth, // 画面幅に合わせて調整（余白を考慮）
          height: window.innerHeight, // 画面高さに合わせて調整（余白を考慮）
          backgroundColor: "#ffffff", // 背景色（真っ白）
          parent: containerRef.current, // ゲームを表示するDOM要素
          scene: GridScene, // 使用するシーン
          physics: {
            default: "arcade", // 物理エンジン（今回は使用しないがデフォルト設定）
            arcade: {
              gravity: { y: 0, x: 0 }, // 重力なし
              debug: false, // デバッグ表示なし
            },
          },
        };

        // 二重チェック：再度ゲームインスタンスが存在しないことを確認
        if (!gameRef.current) {
          // Phaserゲームインスタンスを作成
          gameRef.current = new Phaser.Game(config);
        }
      } catch (error) {
        console.error("Phaserの読み込みに失敗しました:", error);
      }
    };

    // Phaser読み込みを実行
    loadPhaser();

    // コンポーネントのクリーンアップ関数
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true); // Phaserゲームインスタンスを破棄
        gameRef.current = null;
      }
    };
  }, []); // 空の依存配列で初回のみ実行

  return (
    <div className="game-container relative w-full h-screen overflow-hidden">
      {/* ズームコントロール */}
      <div className="absolute top-2 left-2 bg-black bg-opacity-80 text-white p-2 rounded-lg shadow-lg text-sm z-50">
        <h4 className="font-bold mb-2 text-center">ズームレベル</h4>
        <div className="flex space-x-2">
          {zoomLabels.map((label, index) => (
            <button
              key={index}
              onClick={() => changeZoomLevel(index)}
              className={`px-2 py-1 rounded text-xs ${
                zoomLevel === index
                  ? "bg-blue-600 text-white"
                  : "bg-gray-600 text-gray-300 hover:bg-gray-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="text-xs text-gray-300 mt-1 text-center">
          現在: {zoomLevels[zoomLevel]}x
        </div>
      </div>

      {/* ゲームモード表示 */}
      <div className="absolute top-2 right-2 bg-black bg-opacity-80 text-white p-2 rounded-lg shadow-lg text-sm z-50">
        <div className="text-center">
          <h3 className="font-bold mb-2">
            {gameMode === "setup" ? "動きの設定モード" : "ユニットの行動モード"}
          </h3>
          <p className="text-xs text-gray-300">ターン {currentTurn}</p>
          {/* {enemyActions.length > 0 && gameMode === "action" && (
            <p className="text-xs text-yellow-300 mt-1">
              敵のアクション受信済み ({enemyActions.length}件)
            </p>
          )} */}
        </div>
      </div>

      {/* 操作説明 */}
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-80 text-white p-2 rounded-lg shadow-lg text-xs z-50 max-w-xs">
        <h4 className="font-bold mb-2">操作方法</h4>
        <div className="space-y-1">
          <div>• 左クリック: キャラクター選択・移動</div>
          <div>• 右クリック + ドラッグ: 画面移動</div>
          <div>• マウスホイール: 3段階ズーム切り替え</div>
          <div>• ズームボタン: 縮小・普通・拡大 選択</div>
          <div>• WASD または 矢印キー: カメラ移動</div>
        </div>
      </div>

      {/* 対戦終了ボタン */}
      <div className="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white p-2 rounded-lg shadow-lg text-sm z-50">
        <button
          onClick={handleEndMatch}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold transition-colors"
        >
          対戦終了
        </button>
      </div>

      {/* Phaserゲームが表示されるコンテナ */}
      <div
        ref={containerRef}
        className="w-full h-full border border-gray-300 rounded-lg overflow-hidden"
        style={{ maxWidth: "100vw", maxHeight: "100vh" }}
      />

      {/* 行動履歴表示 */}
      <ActionHistoryDisplay
        selectedCharacterId={selectedCharacterId}
        initialActionPoints={selectedCharacterActionPoints}
      />
    </div>
  );
};

// 行動履歴のインターフェース
interface ActionHistory {
  id: string;
  characterId: string;
  position: { x: number; y: number };
  mainTriggerAngle: number | null;
  subTriggerAngle: number | null;
  timestamp: number;
}

// グローバルな履歴配列
let globalActionHistory: ActionHistory[] = [];

// React側で履歴を表示するためのイベントエミッター
const historyEventEmitter = new EventTarget();

// 選択されたキャラクターをReact側に通知するためのイベントエミッター
const characterSelectionEmitter = new EventTarget();

// 行動力の変更をReact側に通知するためのイベントエミッター
const actionPointsEmitter = new EventTarget();

// 行動力チェック用のイベントエミッター
const allActionsCompletedEmitter = new EventTarget();

// 全ユニット行動実行用のイベントエミッター
const executeActionsEmitter = new EventTarget();

// 行動完了通知用のイベントエミッター
const actionExecutionCompletedEmitter = new EventTarget();

// ズーム変更通知用のイベントエミッター
const zoomChangeEmitter = new EventTarget();

// 履歴を追加する関数
function addToGlobalHistory(history: ActionHistory) {
  globalActionHistory.push(history);
  historyEventEmitter.dispatchEvent(new CustomEvent("historyUpdated"));
}

// 履歴をクリアする関数
function clearGlobalHistory() {
  globalActionHistory = [];
  historyEventEmitter.dispatchEvent(new CustomEvent("historyUpdated"));
}

// 選択されたキャラクターを通知する関数
function notifyCharacterSelection(
  characterId: string | null,
  actionPoints: number = 0
) {
  characterSelectionEmitter.dispatchEvent(
    new CustomEvent("characterSelected", {
      detail: { characterId, actionPoints },
    })
  );
}

// 履歴表示コンポーネント
const ActionHistoryDisplay: React.FC<{
  selectedCharacterId: string | null;
  initialActionPoints: number;
}> = ({ selectedCharacterId, initialActionPoints }) => {
  const [histories, setHistories] = useState<ActionHistory[]>([]);
  const [visible, setVisible] = useState(false);
  const [actionPoints, setActionPoints] = useState<number>(0);

  useEffect(() => {
    const updateHistories = () => {
      if (selectedCharacterId) {
        const characterHistories = globalActionHistory.filter(
          (h) => h.characterId === selectedCharacterId
        );
        setHistories(characterHistories);
        setVisible(characterHistories.length > 0);
      } else {
        setVisible(false);
      }
    };

    updateHistories();

    const handleHistoryUpdate = () => {
      updateHistories();
    };

    historyEventEmitter.addEventListener("historyUpdated", handleHistoryUpdate);
    return () => {
      historyEventEmitter.removeEventListener(
        "historyUpdated",
        handleHistoryUpdate
      );
    };
  }, [selectedCharacterId]);

  // 行動力の初期値を設定
  useEffect(() => {
    if (selectedCharacterId) {
      // Phaser側から渡された現在の行動力を使用
      setActionPoints(initialActionPoints);
    } else {
      setActionPoints(0);
    }
  }, [selectedCharacterId, initialActionPoints]);

  // 行動力の変更を監視
  useEffect(() => {
    const handleActionPointsChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { characterId, remainingPoints } = customEvent.detail;

      // 選択されたキャラクターの行動力変更の場合のみ更新
      if (selectedCharacterId && characterId === selectedCharacterId) {
        setActionPoints(remainingPoints);
      }
    };

    actionPointsEmitter.addEventListener(
      "actionPointsChanged",
      handleActionPointsChange
    );
    return () => {
      actionPointsEmitter.removeEventListener(
        "actionPointsChanged",
        handleActionPointsChange
      );
    };
  }, [selectedCharacterId]);

  if (!selectedCharacterId || (!visible && histories.length === 0)) return null;

  return (
    <div className="fixed top-2 left-60 bg-black bg-opacity-80 text-white p-2 rounded-lg shadow-lg text-sm z-50 max-w-sm">
      <h3 className="font-bold mb-2 text-center">
        行動履歴 - {selectedCharacterId}
      </h3>
      <h3 className="font-bold mb-2 text-center">
        行動力残り - {actionPoints}
      </h3>
      <div className="max-h-40 overflow-y-auto">
        {histories.slice(-5).map((history) => (
          <div
            key={history.id}
            className="mb-2 p-2 bg-gray-700 bg-opacity-50 rounded text-xs"
          >
            <div className="text-blue-300">
              位置: ({history.position.x}, {history.position.y})
            </div>
            {history.mainTriggerAngle !== null && (
              <div className="text-red-300">
                Main: {history.mainTriggerAngle.toFixed(2)}°
              </div>
            )}
            {history.subTriggerAngle !== null && (
              <div className="text-blue-300">
                Sub: {history.subTriggerAngle.toFixed(2)}°
              </div>
            )}
            <div className="text-gray-400 text-xs">
              {new Date(history.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameGrid;
