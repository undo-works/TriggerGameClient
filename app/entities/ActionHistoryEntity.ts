// 行動履歴のインターフェース
export interface ActionHistory {
  id: string;
  characterId: string;
  position: { x: number; y: number };
  mainTriggerAngle: number | null;
  subTriggerAngle: number | null;
  timestamp: number;
}
