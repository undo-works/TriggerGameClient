import { CharacterImageState } from "~/entities/CharacterImageState";
import { EnemyCharacterState } from "~/entities/EnemyCharacterState";
import { PlayerCharacterState } from "~/entities/PlayerCharacterState";
import { Position } from "~/types";

/**
 * キャラクター管理クラス
 */
export class CharacterManager {

  public playerCharacters: PlayerCharacterState[] = []; // 自分のキャラクター
  public enemyCharacters: EnemyCharacterState[] = []; // 相手のキャラクター

  // キャラクター選択・移動関連
  public selectedCharacter: PlayerCharacterState | null = null; // 選択されたキャラクター
  public movableHexes: Phaser.GameObjects.Graphics[] = []; // 移動可能な六角形のハイライト

  /** 選択キャラクターの前のポジション */
  public beforePosition: Position | null = null;



  /**
   * キャラクターを選択する（参照を共有）
   * @param characterImage 選択するキャラクターのPhaserオブジェクト
   */
  selectCharacter(characterImage: Phaser.GameObjects.Image): void {
    this.selectedCharacter = this.findPlayerCharacterByImage(characterImage);
  }

  /**
   * Phaserのキャラクターオブジェクトでプレイヤー側キャラクターを検索
   * @param characterImage Phaserのキャラクターオブジェクト
   * @return 見つかったPlayerCharacterStateオブジェクト、見つからなかった場合はnull
   */
  findCharacterByImage(
    characterImage: Phaser.GameObjects.Image
  ): CharacterImageState | null {
    for (const character of [...this.playerCharacters, ...this.enemyCharacters]) {
      if (character.image === characterImage) {
        return character;
      }
    }
    return null;
  }

  /**
   * Phaserのキャラクターオブジェクトでプレイヤー側キャラクターを検索
   * @param characterImage Phaserのキャラクターオブジェクト
   * @return 見つかったPlayerCharacterStateオブジェクト、見つからなかった場合はnull
   */
  findPlayerCharacterByImage(
    characterImage: Phaser.GameObjects.Image
  ): PlayerCharacterState | null {
    for (const character of this.playerCharacters) {
      if (character.image === characterImage) {
        return character;
      }
    }
    return null;
  }


/**
 * 指定された位置に味方キャラクターがいるかチェックする
 * @param col 列
 * @param row 行
 * @returns キャラクターがいる場合はそのキャラクター、いない場合はnull
 */
  getPlayerCharacterAt(
    col: number,
    row: number
  ): PlayerCharacterState | null {
    // プレイヤーキャラクターがマスにいるかチェック
    for (const characterState of this.playerCharacters) {
      if (
        characterState.position.col === col &&
        characterState.position.row === row
      ) {
        return characterState;
      }
    }
    return null;
  }


  /**
 * 指定された位置にキャラクターがいるかチェックする
 * @param col 列
 * @param row 行
 * @returns キャラクターがいる場合はtrue、いない場合はfalse
 */
  isCharacterAt(
    col: number,
    row: number
  ): boolean {
    // キャラクターがマスにいるかチェック
    for (const characterState of [...this.playerCharacters, ...this.enemyCharacters]) {
      if (
        characterState.position.col === col &&
        characterState.position.row === row
      ) {
        return true;
      }
    }
    return false;
  }
}
