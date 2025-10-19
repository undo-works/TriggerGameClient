import { CharacterImageState } from "~/entities/CharacterImageState";
import { HexUtils } from "./hexUtils";
import { GridConfig } from "./types";
import { Position } from "~/types";

export class GameView {


  private hexUtils: HexUtils;
  constructor(private scene: Phaser.Scene, private gridConfig: GridConfig) {
    this.hexUtils = new HexUtils(gridConfig);
  }

  /**
  * 回避テキストを表示する
  * @param position - 表示する位置
  */
  showAvoidImage(position: Position) {
    const pixelPos = this.hexUtils.getHexPosition(position.col, position.row);

    const avoidImage = this.scene.add.image(
      pixelPos.x,
      pixelPos.y,
      "avoid"
    );

    // 一秒で消す
    this.scene.tweens.add({
      targets: avoidImage,
      alpha: 0,
      duration: 1000,
      ease: "Power2",
      onComplete: () => {
        avoidImage.destroy();
      },
    });
  }

  /**
   * ダメージテキストを表示する
   */
  showShieldImage(
    position: Position,
    damage: number
  ) {
    const pixelPos = this.hexUtils.getHexPosition(position.col, position.row);

    const shieldImage = this.scene.add.image(
      pixelPos.x,
      pixelPos.y,
      damage >= 50 ? "shield_hexagon_blue" : damage >= 20 ? "shield_hexagon_yellow" : "shield_hexagon_red"
    );

    // 一秒で消す
    this.scene.tweens.add({
      targets: shieldImage,
      alpha: 0,
      duration: 1000,
      ease: "Power2",
      onComplete: () => {
        shieldImage.destroy();
      },
    });
  }

  /**
   * ベイルアウト表示と撃破されたキャラクターの削除
   * @param character - 撃破されたキャラクター
   * @param onDestroy - キャラクター削除時に実行するコールバック関数
   */
  showBailOutAndRemoveCharacter(character: CharacterImageState, onDestroy?: () => void) {

    const pixelPos = this.hexUtils.getHexPosition(character.position.col, character.position.row);

    // ベイルアウトテキストを作成
    const bailOutText = this.scene.add.text(
      pixelPos.x,
      pixelPos.y - this.gridConfig.hexRadius * 0.8,
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
    this.scene.tweens.add({
      targets: bailOutText,
      y: pixelPos.y - this.gridConfig.hexRadius * 2,
      alpha: 0,
      duration: 2000,
      ease: "Power2",
      onComplete: () => {
        bailOutText.destroy();
      },
    });

    // キャラクターを徐々に透明にして削除
    this.scene.tweens.add({
      targets: character,
      alpha: 0,
      duration: 1000,
      delay: 500, // ベイルアウトテキスト表示後少し待ってから開始
      ease: "Power2",
      onComplete: () => {
        character.image.destroy();
        // 削除時の実行関数があれば呼び出す
        onDestroy?.();
      },
    });
  }

  /**
   * 六角形のタイルごとに位置情報を書き込む
   * @param hexagon - 六角形のGraphicsオブジェクト
   * @param camera - Phaserのカメラオブジェクト
   * @todo: ある程度開発が進んだら不要になるかも
   */
  writeTilePositionDirect = (col: number, row: number) => {
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
  };

  /**
   * トリガー扇形の表示を作成する
   * （アニメーション追従でもこちらを利用する）
   * @param graphics - 既存のGraphicsオブジェクト（nullの場合は新規作成）
   * @param centerX - 扇形の中心X座標
   * @param centerY - 扇形の中心Y座標
   * @param direction - 扇形の向き（度数法、0度が右、反時計回り）
   * @param color - 扇形の色（16進数）
   * @param alpha - 扇形の透明度（0.0〜1.0）
   * @param triggerAngle - 扇形の角度（デフォルト60度）
   * @param triggerRange - 扇形の範囲（デフォルト3マス）
   * @param triggerName - 扇形のラベル名（デフォルト空文字）
   * @returns 作成または更新されたGraphicsオブジェクト
   */
  drawTriggerFanShape(
    graphics: Phaser.GameObjects.Graphics | null,
    centerX: number,
    centerY: number,
    direction: number,
    color: number,
    alpha: number,
    triggerAngle: number = 60,
    triggerRange: number = 3,
    triggerName: string = "",
  ): Phaser.GameObjects.Graphics {
    const triggerGraphics = graphics ?? this.scene.add.graphics();
    triggerGraphics.setDepth(1);

    // 扇形の設定（トリガーの実際のangleとrangeを使用）
    // WARNING: サーバー側の処理とそろえること
    const radius = this.gridConfig.hexHeight * (triggerRange + 0.5); // 半径はrangeに基づく
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

    // ラベルを追加（実際のトリガー射程に基づいて位置を計算、敵の場合は180度補正）
    const mainLabel = this.scene.add.text(
      centerX +
      Math.cos((correctedDirection * Math.PI) / 180) *
      this.gridConfig.hexRadius *
      triggerRange + 1.0,
      centerY +
      Math.sin((correctedDirection * Math.PI) / 180) *
      this.gridConfig.hexRadius *
      triggerRange + 1.0,
      triggerName,
      {
        fontSize: "14px",
        color: `#${color.toString(16).padStart(6, '0')}`,
        backgroundColor: "#ffffffdd",
        padding: { x: 8, y: 4 },
        fontStyle: "bold",
      }
    );
    mainLabel.setOrigin(0.5);
    mainLabel.setDepth(3);

    // ラベル用の保存領域を追加
    triggerGraphics.setData("label", mainLabel);

    return triggerGraphics;
  }

  /**
   * トリガー範囲内のマスの中心に赤い点を表示する
   * @param centerX - トリガー中心のX座標
   * @param centerY - トリガー中心のY座標
   * @param direction - トリガーの向き（度数法）
   * @param triggerAngle - トリガーの角度
   * @param triggerRange - トリガーの範囲
   * @param pointColor - 赤い点の色（デフォルトは赤色0xff0000）
   * @return 描画した点のGraphicsオブジェクトの配列
   */
  drawTriggerRangePoints(
    centerCol: number,
    centerRow: number,
    direction: number,
    triggerAngle: number,
    triggerRange: number,
    pointColor: number = 0xff0000
  ) {
    // 既存の赤い点を削除（もしあれば）
    const existingPoints = this.scene.children.getChildren().filter(child =>
      child.getData && child.getData('triggerRangePoint') === true
    );
    existingPoints.forEach(point => point.destroy());

    const centerPos = this.hexUtils.getHexPosition(centerCol, centerRow);

    const correctedDirection = direction - 90;

    const points: Phaser.GameObjects.Graphics[] = [];

    // トリガー範囲内のマスをチェック
    for (let col = centerCol - triggerRange - 5; col <= centerCol + triggerRange + 5; col++) {
      for (let row = centerRow - triggerRange - 5; row <= centerRow + triggerRange + 5; row++) {
        // グリッド範囲内かチェック
        if (col < 0 || col >= this.gridConfig.gridWidth ||
          row < 0 || row >= this.gridConfig.gridHeight) {
          continue;
        }

        // 中心からの距離をチェック
        const distance = this.hexUtils.calculateHexDistance(centerCol, centerRow, col, row);
        if (distance > this.gridConfig.hexHeight * (triggerRange + 0.5)) {
          continue;
        }

        // マスの中心座標を取得
        const hexPosition = this.hexUtils.getHexPosition(col, row);

        // 中心からマスへの角度を計算
        const angleToHex = Math.atan2(
          hexPosition.y - centerPos.y,
          hexPosition.x - centerPos.x
        ) * (180 / Math.PI);

        // 角度を0-360度の範囲に正規化
        const normalizedAngleToHex = ((angleToHex + 360) % 360);
        const normalizedDirection = ((correctedDirection + 360) % 360);

        // トリガー角度の範囲内かチェック
        const halfAngle = triggerAngle / 2;
        let angleDiff = Math.abs(normalizedAngleToHex - normalizedDirection);

        // 360度境界を跨ぐ場合の調整
        if (angleDiff > 180) {
          angleDiff = 360 - angleDiff;
        }

        if (angleDiff <= halfAngle) {
          // 赤い点を描画
          const point = this.scene.add.graphics();
          point.fillStyle(pointColor, 0.6); // 指定された色、60%透明度
          point.fillCircle(hexPosition.x, hexPosition.y, 6); // 半径6pxの円
          point.setDepth(1); // トリガー扇形より前面に表示
          point.setData('triggerRangePoint', true); // 識別用データ
          points.push(point);
        }
      }
    }
    return points;
  }


  /**
   * アニメーション付きの矢印を描画
   * @param fromCharacter - 矢印の始点となるキャラクターのImageオブジェクト
   * @param toCharacter - 矢印の終点となるキャラクターのImageオブジェクト
   * @param color - 矢印の色（デフォルトは赤色0xff0000）
   * @returns 描画した矢印のGraphicsオブジェクト
   */
  drawAnimatedArrowBetweenCharacters(
    fromCharacter: Phaser.GameObjects.Image,
    toCharacter: Phaser.GameObjects.Image,
  ): Phaser.GameObjects.Graphics {
    const fromX = fromCharacter.x;
    const fromY = fromCharacter.y;
    const toX = toCharacter.x;
    const toY = toCharacter.y;
    const arrowGraphics = this.drawArrow(this.scene, fromX, fromY, toX, toY);
    arrowGraphics.setAlpha(0);

    // キャラクターを徐々に透明にして削除
    this.scene.tweens.add({
      targets: arrowGraphics,
      alpha: 1,
      duration: 250,
      delay: 0,
      ease: "Power2",
      onComplete: () => { },
    });
    return arrowGraphics;
  }


  /**
 * 2点間に矢印を描画する関数
 * @param {Phaser.Scene} scene - シーンオブジェクト
 * @param {number} x1 - 始点のX座標
 * @param {number} y1 - 始点のY座標
 * @param {number} x2 - 終点のX座標
 * @param {number} y2 - 終点のY座標
 * @returns {Phaser.GameObjects.Graphics} Graphicsオブジェクト
 */
  private drawArrow(scene: Phaser.Scene, x1: number, y1: number, x2: number, y2: number): Phaser.GameObjects.Graphics {
    const graphics = scene.add.graphics({
      lineStyle: { width: 4, color: 0x263238 },
      fillStyle: { color: 0xECEFF1 }
    });

    const arrowSize = 15; // 矢印の先端の大きさ

    // 線の描画
    graphics.beginPath();
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
    graphics.stroke();
    graphics.setDepth(1); // トリガー扇形より前面に表示

    // 矢印の角度を計算 (ラジアン)
    const angle = Phaser.Math.Angle.Between(x1, y1, x2, y2);

    // 先端の三角形を描画
    // 角度から少しずらした3点を計算し、終点に配置
    graphics.fillTriangle(
      x2,
      y2,
      x2 - Math.cos(angle - Math.PI / 6) * arrowSize,
      y2 - Math.sin(angle - Math.PI / 6) * arrowSize,
      x2 - Math.cos(angle + Math.PI / 6) * arrowSize,
      y2 - Math.sin(angle + Math.PI / 6) * arrowSize
    );

    return graphics;
  }
}