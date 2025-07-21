import type { CharacterState, GridConfig } from './types';
import { CHARACTER_STATUS } from '../../constants/status';
import type { HexUtils } from './hexUtils';

/**
 * キャラクター管理クラス
 */
export class CharacterManager {
  private playerCharacters: Phaser.GameObjects.Image[] = [];
  private enemyCharacters: Phaser.GameObjects.Image[] = [];

  constructor(
    private scene: Phaser.Scene,
    private config: GridConfig,
    private hexUtils: HexUtils,
    private characterState: CharacterState
  ) {
    // CharacterStateの各Mapを初期化
    this.characterState.combatStats = this.characterState.combatStats || new Map();
    this.characterState.triggerStats = this.characterState.triggerStats || new Map();
  }

  /**
   * キャラクター画像を読み込む
   */
  loadCharacterAssets(): void {
    this.scene.load.image("character01", "/character/01.svg");
    this.scene.load.image("character02", "/character/02.svg");
    this.scene.load.image("character03", "/character/03.svg");
    this.scene.load.image("character04", "/character/04.svg");
  }

  /**
   * プレイヤーキャラクターと敵キャラクターを配置
   */
  createCharacters(): void {
    this.createPlayerCharacters();
    this.createEnemyCharacters();
  }

  /**
   * プレイヤーキャラクターを配置
   */
  private createPlayerCharacters(): void {
    const playerCharacterKeys = ["character01", "character02", "character03", "character04"];
    const playerPositions = [
      { col: 2, row: 35 }, // 左から3番目
      { col: 8, row: 35 }, // 左から5番目  
      { col: 16, row: 35 }, // 左から7番目
      { col: 22, row: 35 }, // 左から9番目
    ];

    playerPositions.forEach((pos, index) => {
      const position = this.hexUtils.getHexPosition(pos.col, pos.row);
      const character = this.scene.add.image(
        position.x,
        position.y,
        playerCharacterKeys[index]
      );
      character.setOrigin(0.5, 0.5);
      character.setDisplaySize(this.config.hexRadius * 1.2, this.config.hexRadius * 1.2);
      character.setDepth(2);
      character.setInteractive();

      this.playerCharacters.push(character);

      const characterId = String(index + 1).padStart(2, "0");
      this.characterState.positions.set(character, { col: pos.col, row: pos.row });
      this.characterState.ids.set(character, characterId);
      this.characterState.directions.set(character, { main: 300, sub: 300 });

      // 初期行動力を設定
      const characterKey = `character${characterId}` as keyof typeof CHARACTER_STATUS;
      const characterStatus = CHARACTER_STATUS[characterKey];
      if (characterStatus) {
        this.characterState.actionPoints.set(character, characterStatus.activeCount);
      }
    });
  }

  /**
   * 敵キャラクターを配置
   */
  private createEnemyCharacters(): void {
    const playerCharacterKeys = ["character01", "character02", "character03", "character04"];
    const enemyPositions = [
      { col: 2, row: 1 },
      { col: 8, row: 1 },
      { col: 16, row: 1 },
      { col: 22, row: 1 },
    ];

    enemyPositions.forEach((pos, index) => {
      const invertedPos = this.hexUtils.invertPosition(pos);
      const position = this.hexUtils.getHexPosition(invertedPos.col, invertedPos.row);
      const character = this.scene.add.image(
        position.x,
        position.y,
        playerCharacterKeys[index]
      );
      character.setOrigin(0.5, 0.5);
      character.setDisplaySize(this.config.hexRadius * 1.2, this.config.hexRadius * 1.2);
      character.setDepth(2);
      character.setTint(0xffb6c1);

      this.enemyCharacters.push(character);

      const characterId = String(index + 1).padStart(2, "0");
      this.characterState.positions.set(character, { col: invertedPos.col, row: invertedPos.row });
      this.characterState.ids.set(character, characterId);
      this.characterState.directions.set(character, { main: 300, sub: 300 });

      // 初期行動力を設定
      const characterKey = `character${characterId}` as keyof typeof CHARACTER_STATUS;
      const characterStatus = CHARACTER_STATUS[characterKey];
      if (characterStatus) {
        this.characterState.actionPoints.set(character, characterStatus.activeCount);
      }
    });
  }

  /**
   * 指定した位置にいるキャラクターを取得
   */
  getCharacterAt(col: number, row: number): Phaser.GameObjects.Image | null {
    for (const [character, position] of this.characterState.positions) {
      if (position.col === col && position.row === row) {
        return character;
      }
    }
    return null;
  }

  /**
   * IDからキャラクターを検索
   */
  findCharacterById(characterId: string): Phaser.GameObjects.Image | null {
    for (const [character, id] of this.characterState.ids) {
      if (id === characterId) {
        return character;
      }
    }
    return null;
  }

  /**
   * IDから敵キャラクターを検索
   */
  findEnemyCharacterById(characterId: string): Phaser.GameObjects.Image | null {
    for (const character of this.enemyCharacters) {
      const id = this.characterState.ids.get(character);
      if (id === characterId) {
        return character;
      }
    }
    return null;
  }

  /**
   * キャラクターを指定位置に移動
   */
  moveCharacter(character: Phaser.GameObjects.Image, targetCol: number, targetRow: number): void {
    const targetPosition = this.hexUtils.getHexPosition(targetCol, targetRow);
    character.x = targetPosition.x;
    character.y = targetPosition.y;
    this.characterState.positions.set(character, { col: targetCol, row: targetRow });
  }

  /**
   * 行動完了テキストを表示
   */
  showActionCompletedText(character: Phaser.GameObjects.Image): void {
    const position = this.characterState.positions.get(character);
    if (!position) return;

    const pixelPos = this.hexUtils.getHexPosition(position.col, position.row);
    const text = this.scene.add.text(
      pixelPos.x,
      pixelPos.y - this.config.hexRadius * 2,
      "行動完了",
      {
        fontSize: "12px",
        color: "#ff0000",
        backgroundColor: "#ffffff",
        padding: { x: 4, y: 2 },
      }
    );
    text.setOrigin(0.5);
    text.setDepth(5);

    this.characterState.actionCompletedTexts.set(character, text);

    // 3秒後にテキストを削除
    this.scene.time.delayedCall(3000, () => {
      text.destroy();
      this.characterState.actionCompletedTexts.delete(character);
    });
  }

  /**
   * プレイヤーキャラクターを取得
   */
  getPlayerCharacters(): Phaser.GameObjects.Image[] {
    return this.playerCharacters;
  }

  /**
   * 敵キャラクターを取得
   */
  getEnemyCharacters(): Phaser.GameObjects.Image[] {
    return this.enemyCharacters;
  }

  /**
   * プレイヤーキャラクターかどうかを判定
   */
  isPlayerCharacter(character: Phaser.GameObjects.Image): boolean {
    return this.playerCharacters.includes(character);
  }
}
