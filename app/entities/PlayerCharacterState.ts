import { Position, TriggerDirection, TriggerDisplay } from "~/types";
import { CharacterImageState } from "./CharacterImageState";
import { HexUtils } from "~/components/gamegrid/hexUtils";

export class PlayerCharacterState extends CharacterImageState {
  constructor(
    image: Phaser.GameObjects.Image,
    position: Position,
    id: string,
    direction: TriggerDirection,
    triggerDisplay: TriggerDisplay | null,
    /** 残りの行動力 */
    public actionPoints: number,
    /** 行動設定完了表示 */
    public completeText: Phaser.GameObjects.Text | null,
    /** 座標計算系クラス */
    public hexUtils: HexUtils
  ) {
    super(
      image,
      position,
      id,
      direction,
      triggerDisplay
    );
  }

  /**
   * 目的地に向けて一番近くの隣接マスに移動する
   * @param target 目的地の座標
   * @return 移動した場合はtrue、すでに目的地にいる場合はfalse
   */
  moveTowardsAdjacent(target: Position): boolean {
    let result = false;
    if (target.col > this.position.col) {
      result = true;
      this.position.col += 1;
    } else if (target.col < this.position.col) {
      result = true;
      this.position.col -= 1;
    }

    if (target.row > this.position.row) {
      result = true;
      this.position.row += 1;
    } else if (target.row < this.position.row) {
      result = true;
      this.position.row -= 1;
    }

    if (result) {
      // 移動先のピクセル座標を計算
      const targetPosition = this.hexUtils.getHexPosition(this.position.col, this.position.row);
      this.image.setPosition(
        targetPosition.x,
        targetPosition.y
      );
      // 行動力を1減らす
      this.actionPoints = Math.max(0, this.actionPoints - 1);
    }

    return result;
  }


  /**
   * 行動完了テキストを表示する
   * @param scene Phaserのシーン
   */
  showActionCompletedText(scene: Phaser.Scene) {

    const pixelPos = this.hexUtils.getHexPosition(
      this.position.col,
      this.position.row
    );

    // 既存のテキストがあれば削除
    const existingText = this.completeText;
    if (existingText) {
      existingText.destroy();
    }

    // 新しいテキストを作成
    const text = scene.add.text(pixelPos.x, pixelPos.y - 40, "行動設定済み", {
      fontSize: "12px",
      color: "#ff0000",
      backgroundColor: "#ffffff",
      padding: { x: 4, y: 2 },
    });
    text.setOrigin(0.5, 0.5);
    text.setDepth(3); // キャラクターより前面

    this.completeText = text;
  }
}