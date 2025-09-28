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
    triggerRange: number = 3
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

    return triggerGraphics;
  }
}