/**
 * メイントリガーとサブトリガーの向きを定義
 * @interface TriggerDirection
 * @property {number} main - メイントリガーの向き
 * @property {number} sub - サブトリガーの向き
 */
export interface TriggerDirection {
  main: number;
  sub: number;
}

/**
 * グリッド上のマスの座標を定義
 * @interface Position
 * @property {number} col - 列番号
 * @property {number} row - 行番号
 */
export interface Position {
  col: number;
  row: number;
}

/**
 * メイントリガーとサブトリガーの表示オブジェクトを定義
 * @interface TriggerDisplay
 * @property {Phaser.GameObjects.Graphics | null} main - メイントリガー
 * @property {Phaser.GameObjects.Graphics | null} sub - サブトリガー
 */
export interface TriggerDisplay {
  mainTrigger: Phaser.GameObjects.Graphics | null;
  subTrigger: Phaser.GameObjects.Graphics | null;
}