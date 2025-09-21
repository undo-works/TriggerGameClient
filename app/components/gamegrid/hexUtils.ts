import type { Position, GridConfig } from './types';

/**
 * 六角形グリッド関連のユーティリティ関数
 */
export class HexUtils {
  constructor(private config: GridConfig) { }

  /**
   * 敵のアクション用に座標を逆転させる
   * @param position 元の座標
   * @returns 逆転された座標
   */
  invertPosition(position: { col: number; row: number }): {
    col: number;
    row: number;
  } {
    // グリッドの最大サイズを取得
    const maxCol = this.config.gridWidth - 1;
    const maxRow = this.config.gridHeight - 1;

    return {
      col: maxCol - position.col,
      row: maxRow - position.row,
    };
  }

  /**
   * 六角形グリッドの座標を計算する
   * @param col 列
   * @param row 行
   * @return ピクセル座標
   */
  getHexPosition(col: number, row: number): { x: number; y: number } {
    const x = col * this.config.hexWidth * 0.75 + this.config.hexRadius + this.config.marginLeft;
    const y =
      row * this.config.hexHeight +
      (col % 2 === 1 ? this.config.hexHeight / 2 : 0) +
      this.config.hexRadius +
      this.config.marginTop;
    return { x, y };
  }

  /**
   * 六角形の頂点座標を計算する
   * @param centerX 中心X座標
   * @param centerY 中心Y座標
   * @returns 頂点座標の配列
   */
  getHexVertices(centerX: number, centerY: number): number[] {
    const vertices: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const x = centerX + this.config.hexRadius * Math.cos(angle);
      const y = centerY + this.config.hexRadius * Math.sin(angle);
      vertices.push(x, y);
    }
    return vertices;
  }


  /**
   * ピクセル座標から六角形グリッド座標に変換する（カメラのズーム・スクロール対応）
   * @param x ピクセルX座標
   * @param y ピクセルY座標
   * @param camera Phaserのカメラオブジェクト
   * @returns {col, row} グリッド座標
   */
  pixelToHex(x: number, y: number, camera: Phaser.Cameras.Scene2D.Camera): { col: number; row: number } {
    // カメラのズームとスクロールを考慮した座標変換
    const worldX = (x + camera.scrollX) / camera.zoom;
    const worldY = (y + camera.scrollY) / camera.zoom;

    const adjustedX = worldX - this.config.marginLeft - this.config.hexRadius;
    const adjustedY = worldY - this.config.marginTop - this.config.hexRadius;

    const col = Math.round(adjustedX / (this.config.hexWidth * 0.75));
    const offsetYForCol = col % 2 === 1 ? this.config.hexHeight / 2 : 0;
    const row = Math.round((adjustedY - offsetYForCol) / this.config.hexHeight);
    return { col, row };
  }

  /**
   * 六角形グリッドでの隣接セルを取得
   * @param col 中心の列
   * @param row 中心の行
   * @returns 隣接するセルの座標配列
   */
  private getHexNeighbors(col: number, row: number): Position[] {
    const neighbors: Position[] = [];

    // 偶数列と奇数列で隣接パターンが異なる
    if (col % 2 === 0) {
      // 偶数列の場合
      neighbors.push(
        { col: col - 1, row: row - 1 }, // 左上
        { col: col - 1, row: row },     // 左
        { col: col, row: row - 1 },     // 上
        { col: col, row: row + 1 },     // 下
        { col: col + 1, row: row - 1 }, // 右上
        { col: col + 1, row: row }      // 右
      );
    } else {
      // 奇数列の場合
      neighbors.push(
        { col: col - 1, row: row },     // 左
        { col: col - 1, row: row + 1 }, // 左下
        { col: col, row: row - 1 },     // 上
        { col: col, row: row + 1 },     // 下
        { col: col + 1, row: row },     // 右
        { col: col + 1, row: row + 1 }  // 右下
      );
    }

    // グリッド境界内のセルのみ返す
    return neighbors.filter(neighbor =>
      neighbor.col >= 0 && neighbor.col < this.config.gridWidth &&
      neighbor.row >= 0 && neighbor.row < this.config.gridHeight
    );
  }

  /**
   * 六角形グリッドの隣接する6マスの座標を取得する
   * @param col 中心の列
   * @param row 中心の行
   * @param activeCount キャラクターの残り行動力
   * @returns 移動可能なマスの座標と移動後の残り行動力の配列
   */
  getAdjacentHexes(
    col: number,
    row: number,
    activeCount: number
  ): { col: number; row: number; remainActiveCount: number }[] {
    if (activeCount <= 0) {
      return [];
    }

    const reachableHexes = new Map<string, number>(); // key: "col,row", value: remainingMoves
    const queue: Array<{
      position: { col: number; row: number };
      remainingMoves: number;
    }> = [];

    // 開始位置を追加（現在位置は移動可能なマスに含めない）
    queue.push({ position: { col, row }, remainingMoves: activeCount });
    reachableHexes.set(`${col},${row}`, activeCount);

    while (queue.length > 0) {
      const { position, remainingMoves } = queue.shift()!;

      if (remainingMoves > 0) {
        // 隣接するマスを取得
        const neighbors = this.getHexNeighbors(position.col, position.row);

        for (const neighbor of neighbors) {
          const key = `${neighbor.col},${neighbor.row}`;
          const newRemainingMoves = remainingMoves - 1;

          // まだ訪問していないマス、またはより多くの行動力で到達できる場合
          if (
            !reachableHexes.has(key) ||
            reachableHexes.get(key)! < newRemainingMoves
          ) {
            reachableHexes.set(key, newRemainingMoves);
            queue.push({
              position: neighbor,
              remainingMoves: newRemainingMoves,
            });
          }
        }
      }
    }

    // 開始位置を除いて結果を返す
    const result: { col: number; row: number; remainActiveCount: number }[] =
      [];
    for (const [key, remainingMoves] of reachableHexes.entries()) {
      const [c, r] = key.split(",").map(Number);
      // 開始位置は除外
      if (c !== col || r !== row) {
        result.push({ col: c, row: r, remainActiveCount: remainingMoves });
      }
    }
    return result;
  }
}
