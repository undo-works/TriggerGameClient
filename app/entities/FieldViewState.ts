import { HexUtils } from "~/components/gamegrid/hexUtils";
import { GridConfig } from "~/components/gamegrid/types";
import { FIELD_STEPS } from "~/constants/FieldData";

interface FieldViewCell {
  /** 可視性の色付けグラフィック */
  backGroundGraphic: Phaser.GameObjects.Graphics | null;
  /** そのセルが視認可能かどうか */
  canSight: boolean;
  /** タイル状の座標テキスト */
  tilePositionText: Phaser.GameObjects.Text | null;
}

/**
 * フィールドの視界領域の表示などを管理するクラス
 */
export class FieldViewState {
  /** フィールド状態を保持する2次元配列 */
  private fieldView: FieldViewCell[][]

  constructor(private hexUtils: HexUtils, private scene: Phaser.Scene, private gridConfig: GridConfig) {
    // フィールドビューを初期化（列×行）
    this.fieldView = Array.from({ length: gridConfig.gridWidth }, () =>
      Array.from({ length: gridConfig.gridHeight }, (): FieldViewCell => ({
      backGroundGraphic: null,
      canSight: false,
      tilePositionText: null,
      }))
    );
    // 背景画像の作成
    this.createBackground();
    // 背景タイルの作成
    this.createBackgroundTiles();
    // 
  }

  /**
   * 背景画像を作成・配置する
   */
  private createBackground() {
    const position = this.hexUtils.getHexPosition(
      0,
      0
    );

    // 背景画像を追加
    const background = this.scene.add.image(position.x - this.gridConfig.hexWidth / 2, position.y - this.gridConfig.hexHeight / 2, "gameBackground");
    background.setOrigin(0, 0); // 左上角を基準点に設定
    background.setDepth(0.2);
    background.setAlpha(0.7);
  }

  /**
   * 背景タイルを六角形グリッドに敷き詰める
   */
  private createBackgroundTiles() {
    // 各グリッドセルに六角形の背景を配置
    for (let col = 0; col < this.gridConfig.gridWidth; col++) {
      for (let row = 0; row < this.gridConfig.gridHeight; row++) {
        const pos = this.hexUtils.getHexPosition(col, row);

        // 六角形を描画
        const hexagon = this.scene.add.graphics();
        hexagon.fillStyle(0xB0BEC5, 1); // グレーの塗りつぶし
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

        // 六角形の位置情報を書き込む
        this.writeTilePositionDirect(col, row);
      }
    }
  }

  /**
   * タイル上に表示するテキストを更新する
   * @param {"position" | "buildingHeight"} tileType - 表示するテキストの種類
   */
  changeTileText = (tileType: "position" | "buildingHeight") => {
    // 既存のテキストを削除
    this.fieldView.forEach((filedRow) => {
      filedRow.forEach((info) => {
        info.tilePositionText?.destroy();
        info.tilePositionText = null;
      });
    });
    // 新しいテキストを作成
    for (let col = 0; col < this.gridConfig.gridWidth; col++) {
      for (let row = 0; row < this.gridConfig.gridHeight; row++) {
        if (tileType === "position") {
          this.writeTilePositionDirect(col, row);
        } else if (tileType === "buildingHeight") {
          this.writeTileBuildingHeight(col, row);
        }
      }
    }
  }
  /**
   * 六角形のタイルごとに位置情報を書き込む
   * @param col - タイルの列番号
   * @param row - タイルの行番号 
   * @todo: ある程度開発が進んだら不要になるかも
   */
  private writeTilePositionDirect = (col: number, row: number) => {
    const pos = this.hexUtils.getHexPosition(col, row);
    const coordText = `${col},${row}`;

    const positionText = this.scene.add.text(pos.x, pos.y, coordText, {
      fontSize: "9px",
      color: "#000",
      fontFamily: "monospace",
      backgroundColor: "rgba(255, 255, 255, 0.7)",
      padding: { x: 2, y: 1 },
    });

    positionText.setOrigin(0.5, 0.5);
    positionText.setDepth(0.1);
    this.fieldView[col][row].tilePositionText = positionText;
  };

  /**
   * 六角形のタイルごとに建物の高さを書き込む
   * @param col - タイルの列番号
   * @param row - タイルの行番号
   */
  private writeTileBuildingHeight = (col: number, row: number) => {
    const pos = this.hexUtils.getHexPosition(col, row);
    const buildingHeight = FIELD_STEPS[row][col];
    if (buildingHeight !== 0) {
      // 建物の高さが0でない場合のみ表示
      const positionText = this.scene.add.text(pos.x, pos.y, buildingHeight.toString(), {
        fontSize: "9px",
        color: "#000",
        fontFamily: "monospace",
        padding: { x: 2, y: 1 },
      });

      positionText.setOrigin(0.5, 0.5);
      positionText.setDepth(2);
      this.fieldView[col][row].tilePositionText = positionText;
    }
  };


  /** 
   * 視認可能エリアのフィールドビューを設定する
   * @param sightArea 視認可能エリアの2次元配列
   */
  setSightAreaFieldView(sightArea: boolean[][]) {

    if (this.scene === null) {
      console.warn("Sceneが未初期化のため、視認可能エリアのフィールドビューを設定できません。");
      return;
    }
    for (const [rowIndex, row] of sightArea.entries()) {
      for (const [colIndex, col] of row.entries()) {

        if (col && !this.fieldView[colIndex][rowIndex].canSight) {
          // 視認可能エリアで、まだ背景グラフィックがない場合、新規作成
          const pos = this.hexUtils.getHexPosition(colIndex, rowIndex);

          // 六角形を描画
          const hexagon = this.scene.add.graphics();
          hexagon.fillStyle(0xffffff, 1); // 白色の塗りつぶし
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
        } else {
          // 既存の背景グラフィックがあれば削除
          this.fieldView[colIndex][rowIndex]?.backGroundGraphic?.destroy();
        }
      }
    }
  }
}