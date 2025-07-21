import type { 
  CharacterState, 
  TriggerState, 
  GridConfig, 
  Position,
  CombatStats,
  TriggerStats,
  CombatResult,
  TriggerArea
} from './types';
import type { HexUtils } from './hexUtils';
import { CHARACTER_STATUS, TRIGGER_STATUS } from '../../constants/status';

/**
 * 戦闘システム管理クラス
 */
export class CombatSystem {
  private activeTriggerAreas: TriggerArea[] = [];

  constructor(
    private scene: Phaser.Scene,
    private config: GridConfig,
    private hexUtils: HexUtils,
    private characterState: CharacterState,
    private triggerState: TriggerState,
    private playerCharacters: Phaser.GameObjects.Image[]
  ) {}

  /**
   * キャラクターの戦闘ステータスを初期化する
   */
  initializeCombatStats(character: Phaser.GameObjects.Image): void {
    const characterId = this.characterState.ids.get(character);
    if (!characterId) return;

    const characterKey = `character${characterId}` as keyof typeof CHARACTER_STATUS;
    const characterStatus = CHARACTER_STATUS[characterKey];
    
    if (characterStatus) {
      const combatStats: CombatStats = {
        hp: characterStatus.trion * characterStatus.defense,
        maxHp: characterStatus.trion * characterStatus.defense,
        attack: characterStatus.attack,
        defense: characterStatus.defense,
        avoid: characterStatus.avoid,
        trion: characterStatus.trion,
        isStunned: false,
        stunEndTime: 0
      };

      this.characterState.combatStats.set(character, combatStats);

      // キャラクターのメイン・サブトリガーを取得
      const mainTriggerKey = characterStatus.main as keyof typeof TRIGGER_STATUS;
      const subTriggerKey = characterStatus.sub as keyof typeof TRIGGER_STATUS;

      const mainTriggerStats: TriggerStats = {
        trionEffect: TRIGGER_STATUS[mainTriggerKey].trionEffect,
        defense: TRIGGER_STATUS[mainTriggerKey].defense,
        avoid: TRIGGER_STATUS[mainTriggerKey].avoid
      };

      const subTriggerStats: TriggerStats = {
        trionEffect: TRIGGER_STATUS[subTriggerKey].trionEffect,
        defense: TRIGGER_STATUS[subTriggerKey].defense,
        avoid: TRIGGER_STATUS[subTriggerKey].avoid
      };

      this.characterState.triggerStats.set(character, {
        main: mainTriggerStats,
        sub: subTriggerStats
      });
    }
  }

  /**
   * アクションごとにHPを回復する
   */
  healCharacterOnAction(character: Phaser.GameObjects.Image): void {
    const combatStats = this.characterState.combatStats.get(character);
    if (combatStats) {
      // アクションごとに最大HPの10%回復
      const healAmount = Math.floor(combatStats.maxHp * 0.1);
      combatStats.hp = Math.min(combatStats.maxHp, combatStats.hp + healAmount);
      this.characterState.combatStats.set(character, combatStats);
    }
  }

  /**
   * 全キャラクターの戦闘チェックを実行する
   */
  checkCombatTriggers(): CombatResult[] {
    const results: CombatResult[] = [];
    this.updateActiveTriggerAreas();

    for (const triggerArea of this.activeTriggerAreas) {
      const enemies = this.getEnemiesInTriggerArea(triggerArea);
      
      for (const enemy of enemies) {
        const combatResult = this.executeCombat(triggerArea.character, enemy, triggerArea.triggerType);
        if (combatResult) {
          results.push(combatResult);
        }
      }
    }

    return results;
  }

  /**
   * アクティブなトリガーエリアを更新する
   */
  private updateActiveTriggerAreas(): void {
    this.activeTriggerAreas = [];

    console.log("=== トリガーエリア更新開始 ===");
    for (const [character, position] of this.characterState.positions) {
      const directions = this.characterState.directions.get(character);
      if (!directions) {
        console.log("キャラクターの方向が見つかりません:", character);
        continue;
      }

      const characterId = this.characterState.ids.get(character) || "不明";
      const characterKey = `character${characterId}` as keyof typeof CHARACTER_STATUS;
      const characterStatus = CHARACTER_STATUS[characterKey];

      if (!characterStatus) {
        console.log(`キャラクター ${characterId} のステータスが見つかりません`);
        continue;
      }

      // メイントリガーの情報を取得
      const mainTriggerKey = characterStatus.main as keyof typeof TRIGGER_STATUS;
      const mainTriggerStatus = TRIGGER_STATUS[mainTriggerKey];

      // サブトリガーの情報を取得
      const subTriggerKey = characterStatus.sub as keyof typeof TRIGGER_STATUS;
      const subTriggerStatus = TRIGGER_STATUS[subTriggerKey];

      console.log(`キャラクター ${characterId}: 位置(${position.col}, ${position.row})`);
      console.log(`  メイン ${mainTriggerKey}: 方向${directions.main}°(補正後${(directions.main - 90 + 360) % 360}°), 射程${mainTriggerStatus.range}ヘックス, 角度${mainTriggerStatus.angle}°`);
      console.log(`  サブ ${subTriggerKey}: 方向${directions.sub}°(補正後${(directions.sub - 90 + 360) % 360}°), 射程${subTriggerStatus.range}ヘックス, 角度${subTriggerStatus.angle}°`);

      // メイントリガーエリア（正しい射程と角度を使用、表示と同じ2倍の半径）
      this.activeTriggerAreas.push({
        character,
        triggerType: "main",
        centerPosition: position,
        direction: directions.main,
        radius: this.config.hexRadius * mainTriggerStatus.range * 2,
        angle: mainTriggerStatus.angle
      });

      // サブトリガーエリア（正しい射程と角度を使用、表示と同じ2倍の半径）
      this.activeTriggerAreas.push({
        character,
        triggerType: "sub",
        centerPosition: position,
        direction: directions.sub,
        radius: this.config.hexRadius * subTriggerStatus.range * 2,
        angle: subTriggerStatus.angle
      });
    }
    console.log(`アクティブトリガーエリア数: ${this.activeTriggerAreas.length}`);
    console.log("=== トリガーエリア更新完了 ===");
  }

  /**
   * トリガーエリア内の敵キャラクターを取得する
   */
  private getEnemiesInTriggerArea(triggerArea: TriggerArea): Phaser.GameObjects.Image[] {
    const enemies: Phaser.GameObjects.Image[] = [];
    const isPlayerCharacter = this.isPlayerCharacter(triggerArea.character);
    const attackerCharacterId = this.characterState.ids.get(triggerArea.character) || "不明";

    console.log(`--- ${attackerCharacterId}の${triggerArea.triggerType}トリガーチェック ---`);
    console.log(`トリガー位置: (${triggerArea.centerPosition.col}, ${triggerArea.centerPosition.row})`);
    console.log(`方向: ${triggerArea.direction}°, 半径: ${triggerArea.radius}px, 角度: ${triggerArea.angle}°`);

    for (const [character, position] of this.characterState.positions) {
      const characterId = this.characterState.ids.get(character) || "不明";

      // 同じ陣営のキャラクターはスキップ
      if (this.isPlayerCharacter(character) === isPlayerCharacter) {
        console.log(`  ${characterId}: 同じ陣営なのでスキップ`);
        continue;
      }

      console.log(`  ${characterId}: 位置(${position.col}, ${position.row}) をチェック中...`);

      if (this.isCharacterInTriggerArea(character, position, triggerArea)) {
        console.log(`  ${characterId}: トリガーエリア内に発見！戦闘対象に追加`);
        enemies.push(character);
      } else {
        console.log(`  ${characterId}: トリガーエリア外`);
      }
    }

    console.log(`戦闘対象数: ${enemies.length}`);
    return enemies;
  }

  /**
   * キャラクターがトリガーエリア内にいるかチェック
   */
  private isCharacterInTriggerArea(
    character: Phaser.GameObjects.Image,
    characterPosition: Position,
    triggerArea: TriggerArea
  ): boolean {
    const centerPixel = this.hexUtils.getHexPosition(triggerArea.centerPosition.col, triggerArea.centerPosition.row);
    const characterPixel = this.hexUtils.getHexPosition(characterPosition.col, characterPosition.row);

    // 距離チェック
    const distance = Math.sqrt(
      Math.pow(characterPixel.x - centerPixel.x, 2) + 
      Math.pow(characterPixel.y - centerPixel.y, 2)
    );

    console.log(`    距離チェック: ${distance.toFixed(1)}px <= ${triggerArea.radius}px ? ${distance <= triggerArea.radius}`);

    if (distance > triggerArea.radius) return false;

    // 角度チェック
    const angleToCharacter = Math.atan2(
      characterPixel.y - centerPixel.y,
      characterPixel.x - centerPixel.x
    ) * (180 / Math.PI);

    const normalizedAngle = ((angleToCharacter % 360) + 360) % 360;
    // 表示と同じように-90度補正を適用
    const triggerDirection = ((triggerArea.direction - 90) % 360 + 360) % 360;

    const halfAngle = triggerArea.angle / 2;
    const startAngle = ((triggerDirection - halfAngle) + 360) % 360;
    const endAngle = ((triggerDirection + halfAngle) + 360) % 360;

    console.log(`    角度チェック: キャラクターへの角度${normalizedAngle.toFixed(1)}°`);
    console.log(`    トリガー方向: ${triggerArea.direction.toFixed(1)}°(補正後${triggerDirection.toFixed(1)}°) (±${halfAngle}°)`);
    console.log(`    範囲: ${startAngle.toFixed(1)}° - ${endAngle.toFixed(1)}°`);

    let inRange = false;
    if (startAngle <= endAngle) {
      inRange = normalizedAngle >= startAngle && normalizedAngle <= endAngle;
    } else {
      inRange = normalizedAngle >= startAngle || normalizedAngle <= endAngle;
    }

    console.log(`    角度範囲内: ${inRange}`);

    return inRange;
  }

  /**
   * 戦闘を実行する
   */
  private executeCombat(
    attacker: Phaser.GameObjects.Image,
    defender: Phaser.GameObjects.Image,
    triggerType: "main" | "sub"
  ): CombatResult | null {
    const attackerStats = this.characterState.combatStats.get(attacker);
    const defenderStats = this.characterState.combatStats.get(defender);
    const attackerTriggerStats = this.characterState.triggerStats.get(attacker)?.[triggerType];

    if (!attackerStats || !defenderStats || !attackerTriggerStats) {
      return null;
    }

    // 防御側のトリガーが攻撃者を向いているかチェック
    const defenderPosition = this.characterState.positions.get(defender);
    const attackerPosition = this.characterState.positions.get(attacker);
    const defenderDirections = this.characterState.directions.get(defender);

    if (!defenderPosition || !attackerPosition || !defenderDirections) {
      return null;
    }

    const isDefenderFacingAttacker = this.isCharacterFacingTarget(
      defender, defenderPosition, attackerPosition
    );

    let isAvoid = false;
    let damage = 0;

    if (isDefenderFacingAttacker) {
      // 回避判定
      const defenderTriggerStats = this.getDefenderTriggerStats(defender, attackerPosition);
      if (defenderTriggerStats) {
        const avoidChance = (defenderStats.avoid * defenderTriggerStats.avoid) / 100;
        isAvoid = Math.random() < avoidChance;
      }

      if (!isAvoid) {
        // ダメージ計算（防御あり）
        const defenderHp = this.calculateDefenderHp(defender, attackerPosition);
        damage = attackerStats.attack * attackerStats.trion * attackerTriggerStats.trionEffect;
        
        // 防御による軽減
        damage = Math.max(1, damage - defenderHp);
      }
    } else {
      // 防御・回避なし、即座に撃破
      damage = defenderStats.hp;
    }

    const isHit = !isAvoid && damage > 0;
    const isDefeat = damage >= defenderStats.hp;

    if (isHit) {
      defenderStats.hp = Math.max(0, defenderStats.hp - damage);
      this.characterState.combatStats.set(defender, defenderStats);

      // スタン効果を適用（攻撃・防御時）
      this.applyStunEffect(attacker, 1000); // 1秒間スタン
      if (isDefenderFacingAttacker && !isAvoid) {
        this.applyStunEffect(defender, 1000); // 1秒間スタン
      }

      // 撃破時の処理
      if (isDefeat) {
        this.handleCharacterDefeat(defender);
      }
    }

    return {
      attacker,
      defender,
      damage,
      isHit,
      isAvoid,
      isDefeat
    };
  }

  /**
   * キャラクターがターゲットの方向を向いているかチェック
   */
  private isCharacterFacingTarget(
    character: Phaser.GameObjects.Image,
    characterPosition: Position,
    targetPosition: Position
  ): boolean {
    const characterPixel = this.hexUtils.getHexPosition(characterPosition.col, characterPosition.row);
    const targetPixel = this.hexUtils.getHexPosition(targetPosition.col, targetPosition.row);

    const angleToTarget = Math.atan2(
      targetPixel.y - characterPixel.y,
      targetPixel.x - characterPixel.x
    ) * (180 / Math.PI);

    const directions = this.characterState.directions.get(character);
    if (!directions) return false;

    // メインとサブの両方向をチェック
    const checkDirection = (direction: number): boolean => {
      const normalizedAngle = ((angleToTarget % 360) + 360) % 360;
      // 表示と同じように-90度補正を適用
      const triggerDirection = ((direction - 90) % 360 + 360) % 360;

      const halfAngle = 30; // 60度扇形の半分
      const startAngle = ((triggerDirection - halfAngle) + 360) % 360;
      const endAngle = ((triggerDirection + halfAngle) + 360) % 360;

      if (startAngle <= endAngle) {
        return normalizedAngle >= startAngle && normalizedAngle <= endAngle;
      } else {
        return normalizedAngle >= startAngle || normalizedAngle <= endAngle;
      }
    };

    return checkDirection(directions.main) || checkDirection(directions.sub);
  }

  /**
   * 防御側のトリガーステータスを取得
   */
  private getDefenderTriggerStats(
    defender: Phaser.GameObjects.Image,
    attackerPosition: Position
  ): TriggerStats | null {
    const defenderPosition = this.characterState.positions.get(defender);
    const defenderDirections = this.characterState.directions.get(defender);
    const defenderTriggerStats = this.characterState.triggerStats.get(defender);

    if (!defenderPosition || !defenderDirections || !defenderTriggerStats) {
      return null;
    }

    const defenderPixel = this.hexUtils.getHexPosition(defenderPosition.col, defenderPosition.row);
    const attackerPixel = this.hexUtils.getHexPosition(attackerPosition.col, attackerPosition.row);

    const angleToAttacker = Math.atan2(
      attackerPixel.y - defenderPixel.y,
      attackerPixel.x - defenderPixel.x
    ) * (180 / Math.PI);

    // メイントリガーが向いているかチェック
    const checkDirection = (direction: number): boolean => {
      const normalizedAngle = ((angleToAttacker % 360) + 360) % 360;
      // 表示と同じように-90度補正を適用
      const triggerDirection = ((direction - 90) % 360 + 360) % 360;

      const halfAngle = 30; // 60度扇形の半分
      const startAngle = ((triggerDirection - halfAngle) + 360) % 360;
      const endAngle = ((triggerDirection + halfAngle) + 360) % 360;

      if (startAngle <= endAngle) {
        return normalizedAngle >= startAngle && normalizedAngle <= endAngle;
      } else {
        return normalizedAngle >= startAngle || normalizedAngle <= endAngle;
      }
    };

    if (checkDirection(defenderDirections.main)) {
      return defenderTriggerStats.main;
    } else if (checkDirection(defenderDirections.sub)) {
      return defenderTriggerStats.sub;
    }

    return null;
  }

  /**
   * 防御側のHPを計算
   */
  private calculateDefenderHp(
    defender: Phaser.GameObjects.Image,
    attackerPosition: Position
  ): number {
    const defenderStats = this.characterState.combatStats.get(defender);
    const defenderTriggerStats = this.getDefenderTriggerStats(defender, attackerPosition);

    if (!defenderStats || !defenderTriggerStats) {
      return 0;
    }

    return defenderStats.trion * defenderStats.defense * defenderTriggerStats.defense;
  }

  /**
   * スタン効果を適用
   */
  private applyStunEffect(character: Phaser.GameObjects.Image, duration: number): void {
    const combatStats = this.characterState.combatStats.get(character);
    if (combatStats) {
      combatStats.isStunned = true;
      combatStats.stunEndTime = Date.now() + duration;
      this.characterState.combatStats.set(character, combatStats);

      // 視覚的なスタン効果
      character.setTint(0x888888); // グレーアウト

      // スタン解除のタイマー
      this.scene.time.delayedCall(duration, () => {
        this.removeStunEffect(character);
      });
    }
  }

  /**
   * スタン効果を解除
   */
  private removeStunEffect(character: Phaser.GameObjects.Image): void {
    const combatStats = this.characterState.combatStats.get(character);
    if (combatStats) {
      combatStats.isStunned = false;
      combatStats.stunEndTime = 0;
      this.characterState.combatStats.set(character, combatStats);

      // 元の色に戻す
      if (this.isPlayerCharacter(character)) {
        character.clearTint();
      } else {
        character.setTint(0xffb6c1); // 敵キャラクターの色
      }
    }
  }

  /**
   * キャラクター撃破時の処理
   */
  private handleCharacterDefeat(character: Phaser.GameObjects.Image): void {
    // キャラクターを非表示にする
    character.setVisible(false);
    character.setActive(false);

    // 関連するデータをクリア
    this.characterState.positions.delete(character);
    this.characterState.combatStats.delete(character);
    this.characterState.triggerStats.delete(character);

    console.log("キャラクターが撃破されました");
  }

  /**
   * プレイヤーキャラクターかどうかを判定
   */
  private isPlayerCharacter(character: Phaser.GameObjects.Image): boolean {
    return this.playerCharacters.includes(character);
  }

  /**
   * キャラクターがスタン中かチェック
   */
  isCharacterStunned(character: Phaser.GameObjects.Image): boolean {
    const combatStats = this.characterState.combatStats.get(character);
    return combatStats?.isStunned && Date.now() < combatStats.stunEndTime || false;
  }

  /**
   * キャラクターの位置を更新する
   */
  updateCharacterPosition(character: Phaser.GameObjects.Image, position: Position): void {
    this.characterState.positions.set(character, position);
  }

  /**
   * キャラクターの方向を更新する
   */
  updateCharacterDirections(character: Phaser.GameObjects.Image, directions: { main: number; sub: number }): void {
    this.characterState.directions.set(character, directions);
  }

  /**
   * HPバーを更新表示
   */
  updateHpDisplay(character: Phaser.GameObjects.Image): void {
    const combatStats = this.characterState.combatStats.get(character);
    const position = this.characterState.positions.get(character);
    
    if (!combatStats || !position) return;

    const pixelPos = this.hexUtils.getHexPosition(position.col, position.row);
    
    // HPバーを描画（既存のHPバーがあれば削除）
    const existingHpBar = character.getData('hpBar');
    if (existingHpBar) {
      existingHpBar.destroy();
    }

    const hpBar = this.scene.add.graphics();
    hpBar.setDepth(3);
    
    const barWidth = this.config.hexRadius * 1.5;
    const barHeight = 4;
    const barX = pixelPos.x - barWidth / 2;
    const barY = pixelPos.y - this.config.hexRadius * 0.8;

    // 背景
    hpBar.fillStyle(0x000000);
    hpBar.fillRect(barX, barY, barWidth, barHeight);

    // HP
    const hpRatio = combatStats.hp / combatStats.maxHp;
    const hpColor = hpRatio > 0.5 ? 0x00ff00 : hpRatio > 0.25 ? 0xffff00 : 0xff0000;
    hpBar.fillStyle(hpColor);
    hpBar.fillRect(barX, barY, barWidth * hpRatio, barHeight);

    character.setData('hpBar', hpBar);
  }
}
