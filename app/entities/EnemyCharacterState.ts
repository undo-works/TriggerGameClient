import { Position, TriggerDirection, TriggerDisplay } from "~/types";
import { CharacterImageState } from "./CharacterImageState";
import { GridConfig } from "~/components/gamegrid/types";


/**
 * 敵キャラクターごとの状態管理の型定義
 */
export class EnemyCharacterState extends CharacterImageState {
  constructor(
    image: Phaser.GameObjects.Image,
    position: Position,
    id: string,
    direction: TriggerDirection,
    triggerDisplay: TriggerDisplay | null,
    private gridConfig: GridConfig,
    /** 敵のプレイヤーに視認されているか */
    private isSeenByEnemy: boolean = false
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
   * 敵キャラクターの視認状態を設定する
   * @param seen 視認されている場合はtrue、されていない場合はfalse
   */
  setSeenByEnemy(seen: boolean) {
    if (this.isSeenByEnemy !== seen) {
      this.isSeenByEnemy = seen;
      this.setCharacterSeenOrNot();
    }
  }

  /**
   * 敵キャラクターの視認状態を設定し、画像を更新する
   */
  private setCharacterSeenOrNot() {
    if (this.isSeenByEnemy) {
      this.image.setTexture(this.id);
      this.image.setOrigin(0.5, 0.5);
      this.image.setDisplaySize(
        this.gridConfig.hexRadius * 1.2,
        this.gridConfig.hexRadius * 1.2
      ); // 六角形に合わせたサイズ
      this.image.setDepth(2); // 前面に表示
    } else {
      // 敵キャラクターが視認されていない状態にする処理
      this.image.setTexture('UNKNOWN');
      this.image.setOrigin(0.5, 0.5);
      this.image.setDisplaySize(
        this.gridConfig.hexRadius * 1.2,
        this.gridConfig.hexRadius * 1.2
      ); // 六角形に合わせたサイズ
      this.image.setDepth(2); // 前面に表示
    }
  }
}