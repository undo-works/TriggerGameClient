import React, { useEffect, useRef, useState } from "react";
import { CHARACTER_STATUS, TRIGGER_STATUS } from "../../constants/status";

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

    // Phaserオブジェクト
    private hoveredCell: { x: number; y: number } | null = null; // マウスでホバーしているセル
    private cellHighlight!: Phaser.GameObjects.Graphics; // セルのハイライト表示用
    private playerCharacters: Phaser.GameObjects.Image[] = []; // 自分のキャラクター
    private enemyCharacters: Phaser.GameObjects.Image[] = []; // 相手のキャラクター

    // キャラクター選択・移動関連
    private selectedCharacter: Phaser.GameObjects.Image | null = null; // 選択されたキャラクター
    private selectedCharacterPosition: { col: number; row: number } | null =
      null; // 選択されたキャラクターの位置
    private movableHexes: Phaser.GameObjects.Graphics[] = []; // 移動可能な六角形のハイライト
    private characterPositions: Map<
      Phaser.GameObjects.Image,
      { col: number; row: number }
    > = new Map(); // キャラクターの位置情報
    private characterIds: Map<Phaser.GameObjects.Image, string> = new Map(); // キャラクターIDの管理
    private characterDirections: Map<
      Phaser.GameObjects.Image,
      { main: number; sub: number }
    > = new Map(); // キャラクターの向き（度数）

    // 行動力の管理
    private characterActionPoints: Map<Phaser.GameObjects.Image, number> =
      new Map(); // キャラクターの行動力
    private actionCompletedTexts: Map<
      Phaser.GameObjects.Image,
      Phaser.GameObjects.Text
    > = new Map(); // 行動完了テキスト

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
      timestamp: string;
    }[] = [];

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
     * 六角形グリッドの座標を計算する
     * @param col 列インデックス
     * @param row 行インデックス
     * @returns {x, y} ピクセル座標
     */
    private getHexPosition(col: number, row: number): { x: number; y: number } {
      const offsetX = 30; // 左側の余白
      const offsetY = 200; // 上側の余白

      const x = col * this.hexWidth * 0.75 + this.hexRadius + offsetX;
      const y =
        row * this.hexHeight +
        (col % 2 === 1 ? this.hexHeight / 2 : 0) +
        this.hexRadius +
        offsetY;
      return { x, y };
    }

    /**
     * ピクセル座標から六角形グリッド座標に変換する
     * @param x ピクセルX座標
     * @param y ピクセルY座標
     * @returns {col, row} グリッド座標
     */
    private pixelToHex(x: number, y: number): { col: number; row: number } {
      const offsetX = 30; // 左側の余白
      const offsetY = 200; // 上側の余白

      const adjustedX = x - offsetX - this.hexRadius;
      const adjustedY = y - offsetY - this.hexRadius;

      const col = Math.round(adjustedX / (this.hexWidth * 0.75));
      const offsetYForCol = col % 2 === 1 ? this.hexHeight / 2 : 0;
      const row = Math.round((adjustedY - offsetYForCol) / this.hexHeight);
      return { col, row };
    }

    /**
     * 六角形の頂点座標を計算する
     * @param centerX 中心X座標
     * @param centerY 中心Y座標
     * @returns 頂点座標の配列
     */
    private getHexVertices(centerX: number, centerY: number): number[] {
      const vertices: number[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const x = centerX + this.hexRadius * Math.cos(angle);
        const y = centerY + this.hexRadius * Math.sin(angle);
        vertices.push(x, y);
      }
      return vertices;
    }

    /**
     * 六角形グリッドの隣接する6マスの座標を取得する
     * @param col 中心の列
     * @param row 中心の行
     * @returns 隣接する6マスの座標配列
     */
    private getAdjacentHexes(
      col: number,
      row: number
    ): { col: number; row: number }[] {
      const adjacent = [];
      const isOddCol = col % 2 === 1;

      // 六角形グリッドの隣接パターン（偶数列と奇数列で異なる）
      const directions = isOddCol
        ? [
            { col: 0, row: -1 }, // 上
            { col: 1, row: 0 }, // 右上
            { col: 1, row: 1 }, // 右下
            { col: 0, row: 1 }, // 下
            { col: -1, row: 1 }, // 左下
            { col: -1, row: 0 }, // 左上
          ]
        : [
            { col: 0, row: -1 }, // 上
            { col: 1, row: -1 }, // 右上
            { col: 1, row: 0 }, // 右下
            { col: 0, row: 1 }, // 下
            { col: -1, row: 0 }, // 左下
            { col: -1, row: -1 }, // 左上
          ];

      for (const dir of directions) {
        const newCol = col + dir.col;
        const newRow = row + dir.row;

        // グリッド範囲内かチェック
        if (
          newCol >= 0 &&
          newCol < this.gridWidth &&
          newRow >= 0 &&
          newRow < this.gridHeight
        ) {
          adjacent.push({ col: newCol, row: newRow });
        }
      }

      return adjacent;
    }

    /**
     * 指定された位置にキャラクターがいるかチェックする
     * @param col 列
     * @param row 行
     * @returns キャラクターがいる場合はそのキャラクター、いない場合はnull
     */
    private getCharacterAt(
      col: number,
      row: number
    ): Phaser.GameObjects.Image | null {
      for (const [character, position] of this.characterPositions.entries()) {
        if (position.col === col && position.row === row) {
          return character;
        }
      }
      return null;
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
      const centerPos = this.getHexPosition(centerCol, centerRow);
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
     * マウス位置から角度を計算する
     * @param centerX 中心X座標
     * @param centerY 中心Y座標
     * @param mouseX マウスX座標
     * @param mouseY マウスY座標
     * @returns 角度（度数）
     */
    private calculateMouseAngle(
      centerX: number,
      centerY: number,
      mouseX: number,
      mouseY: number
    ): number {
      const dx = mouseX - centerX;
      const dy = mouseY - centerY;
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      return angle;
    }

    /**
     * Phaserのcreate段階で呼ばれる
     * ゲームオブジェクトの初期化を行う
     */
    create() {
      this.createBackgroundTiles(); // 背景タイルを配置
      this.createGrid(); // グリッドラインを描画
      this.createCharacters(); // キャラクターを配置
      this.createMouseInteraction(); // マウスイベントを設定
      this.createKeyboardInteraction(); // キーボードイベントを設定
    }

    /**
     * 背景タイルを六角形グリッドに敷き詰める
     */
    private createBackgroundTiles() {
      // 各グリッドセルに六角形の背景を配置
      for (let col = 0; col < this.gridWidth; col++) {
        for (let row = 0; row < this.gridHeight; row++) {
          const pos = this.getHexPosition(col, row);

          // 六角形を描画
          const hexagon = this.add.graphics();
          hexagon.fillStyle(0xffffff, 1.0); // 白色
          hexagon.lineStyle(1, 0x000000, 0.3); // 黒色の境界線（線幅、色、透明度）

          const vertices = this.getHexVertices(pos.x, pos.y);
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
      // マウス移動イベント
      this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        // トリガー扇形をドラッグ中の場合
        if (
          this.isDraggingTrigger &&
          this.selectedCharacterPosition &&
          this.triggerFan
        ) {
          const centerPos = this.getHexPosition(
            this.selectedCharacterPosition.col,
            this.selectedCharacterPosition.row
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

        // 通常のホバー処理
        if (!this.triggerSettingMode) {
          const hexCoord = this.pixelToHex(pointer.x, pointer.y);
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
        // トリガー設定モードの場合
        if (
          this.triggerSettingMode &&
          this.triggerFan &&
          this.selectedCharacterPosition
        ) {
          this.isDraggingTrigger = true;
          return;
        }

        // マウス座標を六角形グリッド座標に変換
        const hexCoord = this.pixelToHex(pointer.x, pointer.y);

        // グリッド範囲内の場合
        if (
          hexCoord.col >= 0 &&
          hexCoord.col < this.gridWidth &&
          hexCoord.row >= 0 &&
          hexCoord.row < this.gridHeight
        ) {
          // そのマスにキャラクターがいるかチェック
          const characterAtPosition = this.getCharacterAt(
            hexCoord.col,
            hexCoord.row
          );

          if (
            characterAtPosition &&
            this.playerCharacters.includes(characterAtPosition)
          ) {
            if (characterAtPosition === this.selectedCharacter) {
              // 既に選択されているキャラクターを再度クリック：トリガー設定モードに入る
              console.log(
                `選択中のキャラクターをクリック: トリガー設定モードに入ります`
              );
              this.startTriggerSetting();
            } else {
              // 他のプレイヤーキャラクターをクリックした場合：選択
              this.selectCharacter(characterAtPosition);
              console.log(
                `キャラクターを選択: (${hexCoord.col}, ${hexCoord.row})`
              );
            }
          } else if (this.selectedCharacter) {
            // キャラクターが選択されている状態で空のマスをクリック
            const adjacentHexes = this.getAdjacentHexes(
              this.selectedCharacterPosition!.col,
              this.selectedCharacterPosition!.row
            );

            // クリックされた位置が移動可能マスかチェック
            const isMovable = adjacentHexes.some(
              (hex) => hex.col === hexCoord.col && hex.row === hexCoord.row
            );

            if (isMovable && !characterAtPosition) {
              // 移動可能マスをクリック：キャラクターを移動
              this.moveCharacter(hexCoord.col, hexCoord.row);
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
      const actionPoints = this.characterActionPoints.get(character) || 0;
      if (actionPoints <= 0) {
        console.log("このキャラクターは既に行動が完了しています。");
        return;
      }

      // 既に選択されているキャラクターをリセット
      this.clearSelection();

      // 新しいキャラクターを選択
      this.selectedCharacter = character;
      this.selectedCharacterPosition =
        this.characterPositions.get(character) || null;

      if (this.selectedCharacterPosition) {
        // 選択されたキャラクターを強調表示
        character.setTint(0xffff00); // 黄色で強調

        // 移動可能なマスを表示
        this.showMovableHexes();

        // React側にキャラクター選択を通知
        const characterId = this.characterIds.get(character) || null;
        const currentActionPoints =
          this.characterActionPoints.get(character) || 0;
        notifyCharacterSelection(characterId, currentActionPoints);
      }
    }

    /**
     * 移動可能な六角形マスを表示する
     */
    private showMovableHexes() {
      if (!this.selectedCharacterPosition || !this.selectedCharacter) return;

      // 行動力をチェック
      const actionPoints =
        this.characterActionPoints.get(this.selectedCharacter) || 0;

      const adjacentHexes = this.getAdjacentHexes(
        this.selectedCharacterPosition.col,
        this.selectedCharacterPosition.row
      );

      // 現在の位置をオレンジ色でハイライト（トリガー設定可能を示す）
      const currentPos = this.getHexPosition(
        this.selectedCharacterPosition.col,
        this.selectedCharacterPosition.row
      );
      const currentHex = this.add.graphics();
      currentHex.fillStyle(0xff8c00, 0.3); // オレンジ色、透明度0.3
      currentHex.lineStyle(2, 0xff6600, 1.0); // 濃いオレンジ色の境界線

      const currentVertices = this.getHexVertices(currentPos.x, currentPos.y);
      currentHex.beginPath();
      currentHex.moveTo(currentVertices[0], currentVertices[1]);
      for (let i = 2; i < currentVertices.length; i += 2) {
        currentHex.lineTo(currentVertices[i], currentVertices[i + 1]);
      }
      currentHex.closePath();
      currentHex.fillPath();
      currentHex.strokePath();

      currentHex.setDepth(0.8); // キャラクターより後ろ、背景より前
      this.movableHexes.push(currentHex);

      // 隣接する6マスに緑色のハイライトを表示（行動力が残っている場合のみ）
      if (actionPoints > 0) {
        adjacentHexes.forEach((hex) => {
          // そのマスに他のキャラクターがいない場合のみ移動可能
          if (!this.getCharacterAt(hex.col, hex.row)) {
            const pos = this.getHexPosition(hex.col, hex.row);

            const movableHex = this.add.graphics();
            movableHex.fillStyle(0x00ff00, 0.4); // 緑色、透明度0.4
            movableHex.lineStyle(2, 0x00aa00, 1.0); // 濃い緑色の境界線

            const vertices = this.getHexVertices(pos.x, pos.y);
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
            this.movableHexes.push(movableHex);
          }
        });
      }
    }

    /**
     * 選択状態をクリアする
     */
    private clearSelection() {
      // 選択されたキャラクターの色を元に戻す
      if (this.selectedCharacter) {
        // プレイヤーキャラクターか敵キャラクターかで色を分ける
        if (this.playerCharacters.includes(this.selectedCharacter)) {
          this.selectedCharacter.setTint(0xadd8e6); // 薄い青色
        } else {
          this.selectedCharacter.setTint(0xffb6c1); // 薄い赤色
        }
      }

      // 移動可能マスを削除
      this.movableHexes.forEach((hex) => hex.destroy());
      this.movableHexes = [];

      // トリガー表示をクリア
      this.clearTriggerDisplay();

      // トリガー設定モードをリセット
      this.triggerSettingMode = false;
      this.triggerSettingType = null;

      // 選択状態をリセット
      this.selectedCharacter = null;
      this.selectedCharacterPosition = null;

      // React側にキャラクター選択解除を通知
      notifyCharacterSelection(null, 0);
    }

    /**
     * キャラクターを指定された位置に移動する
     * @param targetCol 移動先の列
     * @param targetRow 移動先の行
     */
    private moveCharacter(targetCol: number, targetRow: number) {
      if (!this.selectedCharacter || !this.selectedCharacterPosition) return;

      // 移動先の位置を計算
      const targetPosition = this.getHexPosition(targetCol, targetRow);

      // キャラクターを移動
      this.selectedCharacter.setPosition(targetPosition.x, targetPosition.y);

      // キャラクターの位置情報を更新（移動後の位置）
      this.characterPositions.set(this.selectedCharacter, {
        col: targetCol,
        row: targetRow,
      });

      // 選択されたキャラクターの位置も更新（扇形描画で使用）
      this.selectedCharacterPosition = {
        col: targetCol,
        row: targetRow,
      };

      console.log(`キャラクターが (${targetCol}, ${targetRow}) に移動しました`);

      // 移動後にトリガー設定モードに入る
      this.startTriggerSetting();
    }
    private updateCellHighlight() {
      if (!this.hoveredCell) return;

      // 前のハイライトをクリア
      this.cellHighlight.clear();

      // 六角形の位置を計算
      const pos = this.getHexPosition(this.hoveredCell.x, this.hoveredCell.y);

      // 薄い青色で六角形をハイライト
      this.cellHighlight.fillStyle(0x87ceeb, 0.5); // 色と透明度

      const vertices = this.getHexVertices(pos.x, pos.y);
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
      // 自分のキャラクター（底辺行）を配置
      const playerPositions = [
        { col: 2, row: 23 }, // 左から3番目
        { col: 8, row: 23 }, // 左から5番目
        { col: 16, row: 23 }, // 左から7番目
        { col: 22, row: 23 }, // 左から9番目
      ];

      const playerCharacterKeys = [
        "character01",
        "character02",
        "character03",
        "character04",
      ];

      // 自分のキャラクターを配置
      playerPositions.forEach((pos, index) => {
        const characterId = String(index + 1).padStart(2, "0"); // "01", "02", "03", "04"
        const position = this.getHexPosition(pos.col, pos.row);
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

        this.playerCharacters.push(character);
        // キャラクターの位置情報を記録
        this.characterPositions.set(character, { col: pos.col, row: pos.row });
        // キャラクターIDを記録
        this.characterIds.set(character, characterId);
        // 初期向きを設定（主トリガー: 上向き, 副トリガー: 上向き）
        this.characterDirections.set(character, { main: 300, sub: 300 });

        // 初期行動力を設定
        const characterKey =
          `character${characterId}` as keyof typeof CHARACTER_STATUS;
        const characterStatus = CHARACTER_STATUS[characterKey];
        if (characterStatus) {
          this.characterActionPoints.set(
            character,
            characterStatus.activeCount
          );
        }
      });

      // 相手のキャラクター（上辺行）を配置
      const enemyPositions = [
        { col: 2, row: 1 }, // 左から3番目
        { col: 8, row: 1 }, // 左から5番目
        { col: 16, row: 1 }, // 左から7番目
        { col: 22, row: 1 }, // 左から9番目
      ];

      // 相手のキャラクターを配置（同じ画像を使用）
      enemyPositions.forEach((pos, index) => {
        const position = this.getHexPosition(pos.col, pos.row);
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

        this.enemyCharacters.push(character);
        // キャラクターの位置情報を記録
        this.characterPositions.set(character, { col: pos.col, row: pos.row });
      });
    }

    /**
     * トリガー設定モードを開始する
     */
    private startTriggerSetting() {
      if (!this.selectedCharacter || !this.selectedCharacterPosition) return;

      // 行動力をチェック
      const actionPoints =
        this.characterActionPoints.get(this.selectedCharacter) || 0;
      if (actionPoints <= 0) {
        console.log("行動力が不足しています。");
        this.clearSelection();
        return;
      }

      this.triggerSettingMode = true;
      this.triggerSettingType = "main";

      // キャラクターを紫色で強調表示（トリガー設定モード）
      this.selectedCharacter.setTint(0xff00ff);

      // mainトリガーの設定を開始
      this.showTriggerFan();
    }

    /**
     * トリガー扇形を表示する
     */
    private showTriggerFan() {
      if (
        !this.selectedCharacter ||
        !this.selectedCharacterPosition ||
        !this.triggerSettingType
      )
        return;

      const characterId = this.characterIds.get(this.selectedCharacter);
      if (!characterId) return;

      // キャラクターのステータスを取得
      const characterKey =
        `character${characterId}` as keyof typeof CHARACTER_STATUS;
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
      console.log(
        `扇形の中心位置: (${this.selectedCharacterPosition.col}, ${this.selectedCharacterPosition.row})`
      );

      // 初期角度を設定（現在の向きまたはデフォルト）
      const directions = this.characterDirections.get(this.selectedCharacter);
      this.currentTriggerAngle = directions
        ? directions[this.triggerSettingType]
        : 0;

      // subトリガーの場合は色を変える
      const color = this.triggerSettingType === "main" ? 0xff6b6b : 0x6b6bff;

      // 扇形を描画（移動後の位置を中心に）
      this.triggerFan = this.drawTriggerFan(
        this.selectedCharacterPosition.col,
        this.selectedCharacterPosition.row,
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
        !this.selectedCharacterPosition ||
        !this.triggerSettingType
      )
        return;

      const characterId = this.characterIds.get(this.selectedCharacter!);
      if (!characterId) return;

      // キャラクターのステータスを取得
      const characterKey =
        `character${characterId}` as keyof typeof CHARACTER_STATUS;
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
        this.selectedCharacterPosition.col,
        this.selectedCharacterPosition.row,
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
      if (!this.selectedCharacter || !this.triggerSettingType) return;

      // 現在のキャラクターの向きを取得または初期化
      let directions = this.characterDirections.get(this.selectedCharacter);
      if (!directions) {
        directions = { main: 0, sub: 0 };
        this.characterDirections.set(this.selectedCharacter, directions);
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
      // 行動力を消費
      this.consumeActionPoint();

      // 行動履歴を記録
      this.recordActionHistory();

      this.triggerSettingMode = false;
      this.triggerSettingType = null;
      this.clearTriggerDisplay();
      this.clearSelection();

      console.log("トリガー設定が完了しました");
    }

    /**
     * 行動力を消費する
     */
    private consumeActionPoint() {
      if (!this.selectedCharacter) return;

      const currentActionPoints = this.characterActionPoints.get(
        this.selectedCharacter
      );
      if (currentActionPoints && currentActionPoints > 0) {
        this.characterActionPoints.set(
          this.selectedCharacter,
          currentActionPoints - 1
        );

        const characterId =
          this.characterIds.get(this.selectedCharacter) || "unknown";
        const remainingPoints =
          this.characterActionPoints.get(this.selectedCharacter) || 0;

        console.log(
          `キャラクター${characterId}の行動力を消費しました。残り: ${remainingPoints}`
        );

        // React側に行動力の変更を通知
        actionPointsEmitter.dispatchEvent(
          new CustomEvent("actionPointsChanged", {
            detail: {
              characterId,
              remainingPoints,
            },
          })
        );

        // 行動力が0になった場合、「行動設定済み」テキストを表示
        if (remainingPoints === 0) {
          this.showActionCompletedText(this.selectedCharacter);
        }
      }
    }

    /**
     * 行動完了テキストを表示する
     */
    private showActionCompletedText(character: Phaser.GameObjects.Image) {
      const position = this.characterPositions.get(character);
      if (!position) return;

      const pixelPos = this.getHexPosition(position.col, position.row);

      // 既存のテキストがあれば削除
      const existingText = this.actionCompletedTexts.get(character);
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

      this.actionCompletedTexts.set(character, text);
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
      if (!this.selectedCharacter) return;

      const position = this.characterPositions.get(this.selectedCharacter);
      const directions = this.characterDirections.get(this.selectedCharacter);

      if (!position || !directions) return;

      // 行動履歴に記録
      const action = {
        character: this.selectedCharacter,
        position: { col: position.col, row: position.row },
        mainAzimuth: directions.main,
        subAzimuth: directions.sub,
        timestamp: new Date().toISOString(),
      };

      this.actionHistory.push(action);

      // キャラクターIDを取得してログに出力
      const characterId =
        this.characterIds.get(this.selectedCharacter) || "unknown";
      console.log(
        `行動履歴を記録: キャラクター${characterId}, 位置(${position.col}, ${
          position.row
        }), mainトリガー: ${directions.main.toFixed(
          1
        )}度, subトリガー: ${directions.sub.toFixed(1)}度`
      );

      // グローバル履歴に追加
      const historyEntry: ActionHistory = {
        id: `${characterId}-${Date.now()}`,
        characterId,
        position: { x: position.col, y: position.row },
        mainTriggerAngle: directions.main,
        subTriggerAngle: directions.sub,
        timestamp: Date.now(),
      };
      addToGlobalHistory(historyEntry);
    }

    /**
     * 行動履歴を取得する
     */
    public getActionHistory() {
      return this.actionHistory.map((action) => ({
        characterId: this.characterIds.get(action.character) || "unknown",
        position: action.position,
        mainAzimuth: action.mainAzimuth,
        subAzimuth: action.subAzimuth,
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
          this.characterIds.get(action.character) || "unknown";
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

    // ...existing code...
  };
};

/**
 * PhaserゲームのReactコンポーネント
 * SSR（Server-Side Rendering）対応のため、動的インポートを使用
 */
const GameGrid = () => {
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
  }, []);

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

        // Phaserゲームの設定（六角形グリッドに適したサイズ）
        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO, // 自動的にWebGLまたはCanvasを選択
          width: 1360, // ゲーム画面の幅（六角形グリッドに合わせて調整）
          height: 1644, // ゲーム画面の高さ（六角形グリッドに合わせて調整）
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
    <div className="game-container relative">
      {/* Phaserゲームが表示されるコンテナ */}
      <div ref={containerRef} className="border border-gray-300 rounded-lg" />

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
    <div className="fixed top-4 left-4 bg-black bg-opacity-60 text-white p-3 rounded-lg shadow-lg text-sm z-50 max-w-sm">
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
