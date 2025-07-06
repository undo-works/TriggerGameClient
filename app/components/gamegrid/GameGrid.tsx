import { useEffect, useRef } from 'react';

/**
 * Phaserゲームシーンを動的に作成するファクトリ関数
 * SSR対応のため、Phaserオブジェクトを引数として受け取る
 */
const createGridScene = (Phaser: typeof import('phaser')) => {
  return class GridScene extends Phaser.Scene {
    // グリッドの設定
    private gridSize: number = 32;     // 1マスのサイズ（ピクセル）
    private gridWidth: number = 36;    // グリッドの幅（マス数）
    private gridHeight: number = 36;   // グリッドの高さ（マス数）
    
    // 六角形グリッドの設定
    private hexRadius: number = 24;    // 六角形の半径
    private hexWidth: number = this.hexRadius * 2;         // 六角形の幅
    private hexHeight: number = this.hexRadius * Math.sqrt(3); // 六角形の高さ
    
    // Phaserオブジェクト
    private hoveredCell: { x: number; y: number } | null = null;  // マウスでホバーしているセル
    private cellHighlight!: Phaser.GameObjects.Graphics;  // セルのハイライト表示用
    private playerCharacters: Phaser.GameObjects.Image[] = [];  // 自分のキャラクター
    private enemyCharacters: Phaser.GameObjects.Image[] = [];   // 相手のキャラクター
    
    // キャラクター選択・移動関連
    private selectedCharacter: Phaser.GameObjects.Image | null = null;  // 選択されたキャラクター
    private selectedCharacterPosition: { col: number; row: number } | null = null;  // 選択されたキャラクターの位置
    private movableHexes: Phaser.GameObjects.Graphics[] = [];  // 移動可能な六角形のハイライト
    private characterPositions: Map<Phaser.GameObjects.Image, { col: number; row: number }> = new Map();  // キャラクターの位置情報
    constructor() {
      super({ key: 'GridScene' });
    }

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
      this.load.image('character01', '/character/01.svg');
      this.load.image('character02', '/character/02.svg');
      this.load.image('character03', '/character/03.svg');
      this.load.image('character04', '/character/04.svg');
    }

    /**
     * 背景テクスチャ（白色）を動的に作成
     * HTMLのCanvasを使って白色のテクスチャを描画し、Phaserテクスチャとして登録
     */
    private createBackgroundTexture() {
      // HTMLのCanvasを作成
      const canvas = document.createElement('canvas');
      canvas.width = this.gridSize;
      canvas.height = this.gridSize;
      const ctx = canvas.getContext('2d')!;

      // 背景色を設定（真っ白）
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, this.gridSize, this.gridSize);

      // 作成したCanvasをPhaserテクスチャとして登録
      this.textures.addCanvas('whiteTile', canvas);
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
      const y = row * this.hexHeight + (col % 2 === 1 ? this.hexHeight / 2 : 0) + this.hexRadius + offsetY;
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
    private getAdjacentHexes(col: number, row: number): { col: number; row: number }[] {
      const adjacent = [];
      const isOddCol = col % 2 === 1;
      
      // 六角形グリッドの隣接パターン（偶数列と奇数列で異なる）
      const directions = isOddCol ? [
        { col: 0, row: -1 },  // 上
        { col: 1, row: 0 },   // 右上
        { col: 1, row: 1 },   // 右下
        { col: 0, row: 1 },   // 下
        { col: -1, row: 1 },  // 左下
        { col: -1, row: 0 }   // 左上
      ] : [
        { col: 0, row: -1 },  // 上
        { col: 1, row: -1 },  // 右上
        { col: 1, row: 0 },   // 右下
        { col: 0, row: 1 },   // 下
        { col: -1, row: 0 },  // 左下
        { col: -1, row: -1 }  // 左上
      ];

      for (const dir of directions) {
        const newCol = col + dir.col;
        const newRow = row + dir.row;
        
        // グリッド範囲内かチェック
        if (newCol >= 0 && newCol < this.gridWidth && newRow >= 0 && newRow < this.gridHeight) {
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
    private getCharacterAt(col: number, row: number): Phaser.GameObjects.Image | null {
      for (const [character, position] of this.characterPositions.entries()) {
        if (position.col === col && position.row === row) {
          return character;
        }
      }
      return null;
    }

    /**
     * Phaserのcreate段階で呼ばれる
     * ゲームオブジェクトの初期化を行う
     */
    create() {
      this.createBackgroundTiles();  // 背景タイルを配置
      this.createGrid();             // グリッドラインを描画
      this.createCharacters();       // キャラクターを配置
      this.createMouseInteraction(); // マウスイベントを設定
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
      this.cellHighlight.setVisible(false);  // 初期状態では非表示
      this.cellHighlight.setDepth(0.5);      // 背景より前、キャラクターより後ろ
    }

    /**
     * マウスイベントを設定する（六角形グリッド対応）
     */
    private createMouseInteraction() {
      // マウス移動イベント
      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        // マウス座標を六角形グリッド座標に変換
        const hexCoord = this.pixelToHex(pointer.x, pointer.y);

        // グリッド範囲内かどうかチェック
        if (hexCoord.col >= 0 && hexCoord.col < this.gridWidth && 
            hexCoord.row >= 0 && hexCoord.row < this.gridHeight) {
          // 範囲内の場合、ホバー状態を更新
          this.hoveredCell = { x: hexCoord.col, y: hexCoord.row };
          this.updateCellHighlight();
        } else {
          // 範囲外の場合、ハイライトを非表示
          this.hoveredCell = null;
          this.cellHighlight.setVisible(false);
        }
      });

      // マウスクリックイベント
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        // マウス座標を六角形グリッド座標に変換
        const hexCoord = this.pixelToHex(pointer.x, pointer.y);

        // グリッド範囲内の場合
        if (hexCoord.col >= 0 && hexCoord.col < this.gridWidth && 
            hexCoord.row >= 0 && hexCoord.row < this.gridHeight) {
          
          // そのマスにキャラクターがいるかチェック
          const characterAtPosition = this.getCharacterAt(hexCoord.col, hexCoord.row);
          
          if (characterAtPosition && this.playerCharacters.includes(characterAtPosition)) {
            // プレイヤーキャラクターをクリックした場合：選択
            this.selectCharacter(characterAtPosition);
            console.log(`キャラクターを選択: (${hexCoord.col}, ${hexCoord.row})`);
          } else if (this.selectedCharacter) {
            // キャラクターが選択されている状態で空のマスをクリック
            const adjacentHexes = this.getAdjacentHexes(
              this.selectedCharacterPosition!.col, 
              this.selectedCharacterPosition!.row
            );
            
            // クリックされた位置が移動可能マスかチェック
            const isMovable = adjacentHexes.some(hex => 
              hex.col === hexCoord.col && hex.row === hexCoord.row
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
            console.log(`クリックされた六角形: (${hexCoord.col}, ${hexCoord.row})`);
          }
        }
      });
    }

    /**
     * キャラクターを選択する
     * @param character 選択されたキャラクター
     */
    private selectCharacter(character: Phaser.GameObjects.Image) {
      // 既に選択されているキャラクターをリセット
      this.clearSelection();
      
      // 新しいキャラクターを選択
      this.selectedCharacter = character;
      this.selectedCharacterPosition = this.characterPositions.get(character) || null;
      
      if (this.selectedCharacterPosition) {
        // 選択されたキャラクターを強調表示
        character.setTint(0xffff00); // 黄色で強調
        
        // 移動可能なマスを表示
        this.showMovableHexes();
      }
    }

    /**
     * 移動可能な六角形マスを表示する
     */
    private showMovableHexes() {
      if (!this.selectedCharacterPosition) return;
      
      const adjacentHexes = this.getAdjacentHexes(
        this.selectedCharacterPosition.col, 
        this.selectedCharacterPosition.row
      );
      
      // 隣接する6マスに緑色のハイライトを表示
      adjacentHexes.forEach(hex => {
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
      this.movableHexes.forEach(hex => hex.destroy());
      this.movableHexes = [];
      
      // 選択状態をリセット
      this.selectedCharacter = null;
      this.selectedCharacterPosition = null;
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
      
      // キャラクターの位置情報を更新
      this.characterPositions.set(this.selectedCharacter, { col: targetCol, row: targetRow });
      
      // 選択状態をクリア
      this.clearSelection();
      
      console.log(`キャラクターが (${targetCol}, ${targetRow}) に移動しました`);
    }
    private updateCellHighlight() {
      if (!this.hoveredCell) return;

      // 前のハイライトをクリア
      this.cellHighlight.clear();
      
      // 六角形の位置を計算
      const pos = this.getHexPosition(this.hoveredCell.x, this.hoveredCell.y);
      
      // 薄い青色で六角形をハイライト
      this.cellHighlight.fillStyle(0x87ceeb, 0.5);  // 色と透明度
      
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
        { col: 2, row: 23 },  // 左から3番目
        { col: 8, row: 23 },  // 左から5番目
        { col: 16, row: 23 },  // 左から7番目
        { col: 22, row: 23 }   // 左から9番目
      ];

      const playerCharacterKeys = ['character01', 'character02', 'character03', 'character04'];

      // 自分のキャラクターを配置
      playerPositions.forEach((pos, index) => {
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
      });

      // 相手のキャラクター（上辺行）を配置
      const enemyPositions = [
        { col: 2, row: 1 },   // 左から3番目
        { col: 8, row: 1 },   // 左から5番目
        { col: 16, row: 1 },   // 左から7番目
        { col: 22, row: 1 }    // 左から9番目
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
  };
};

/**
 * PhaserゲームのReactコンポーネント
 * SSR（Server-Side Rendering）対応のため、動的インポートを使用
 */
const GameGrid = () => {
  // PhaserゲームインスタンスのRef（型安全性のため動的インポートの型を使用）
  const gameRef = useRef<import('phaser').Game | null>(null);
  
  // ゲームを表示するDOMコンテナのRef
  const containerRef = useRef<HTMLDivElement>(null);

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
        const Phaser = await import('phaser');
        
        // GridSceneクラスを作成（Phaserオブジェクトを渡す）
        const GridScene = createGridScene(Phaser);

        // Phaserゲームの設定（六角形グリッドに適したサイズ）
        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO,              // 自動的にWebGLまたはCanvasを選択
          width: 1360,                     // ゲーム画面の幅（六角形グリッドに合わせて調整）
          height: 1644,                    // ゲーム画面の高さ（六角形グリッドに合わせて調整）
          backgroundColor: '#ffffff',     // 背景色（真っ白）
          parent: containerRef.current,   // ゲームを表示するDOM要素
          scene: GridScene,               // 使用するシーン
          physics: {
            default: 'arcade',            // 物理エンジン（今回は使用しないがデフォルト設定）
            arcade: {
              gravity: { y: 0, x: 0 },    // 重力なし
              debug: false                // デバッグ表示なし
            }
          }
        };

        // 二重チェック：再度ゲームインスタンスが存在しないことを確認
        if (!gameRef.current) {
          // Phaserゲームインスタンスを作成
          gameRef.current = new Phaser.Game(config);
        }
      } catch (error) {
        console.error('Phaserの読み込みに失敗しました:', error);
      }
    };

    // Phaser読み込みを実行
    loadPhaser();

    // コンポーネントのクリーンアップ関数
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);  // Phaserゲームインスタンスを破棄
        gameRef.current = null;
      }
    };
  }, []); // 空の依存配列で初回のみ実行

  return (
    <div className="game-container">
      {/* Phaserゲームが表示されるコンテナ */}
      <div ref={containerRef} className="border border-gray-300 rounded-lg" />
    </div>
  );
};

export default GameGrid;
