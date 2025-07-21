import type { Position, PixelPosition, GridConfig } from './types';

/**
 * 六角形グリッド関連のユーティリティ関数
 */
export class HexUtils {
  constructor(private config: GridConfig) {}

  /**
   * 余白を初期化する（画面サイズの半分程度）
   */
  initializeMargins(camera: Phaser.Cameras.Scene2D.Camera): void {
    // ゲームのキャンバスサイズを取得
    const gameWidth = camera.width;
    const gameHeight = camera.height;
    
    // 画面の横幅/縦幅の半分程度の余白を設定
    this.config.marginLeft = gameWidth * 0.5;
    this.config.marginTop = gameHeight * 0.5;
  }

  /**
   * 敵のアクション用に座標を逆転させる
   */
  invertPosition(position: Position): Position {
    // グリッドの最大サイズを取得
    const maxCol = this.config.gridWidth - 1;
    const maxRow = this.config.gridHeight - 1;
    
    return {
      col: maxCol - position.col,
      row: maxRow - position.row
    };
  }

  /**
   * 六角形グリッドの座標を計算する
   */
  getHexPosition(col: number, row: number): PixelPosition {
    const x = col * this.config.hexWidth * 0.75 + this.config.hexRadius + this.config.marginLeft;
    const y =
      row * this.config.hexHeight +
      (col % 2 === 1 ? this.config.hexHeight / 2 : 0) +
      this.config.hexRadius +
      this.config.marginTop;
    return { x, y };
  }

  /**
   * ピクセル座標を六角形グリッド座標に変換
   */
  pixelToHex(x: number, y: number, camera: Phaser.Cameras.Scene2D.Camera): Position {
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
   * 六角形の頂点座標を計算する
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
   * 六角形グリッドでの隣接セルを取得
   */
  getHexNeighbors(col: number, row: number): Position[] {
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
   * 指定位置から隣接する六角形を取得
   */
  getAdjacentHexes(col: number, row: number): Position[] {
    return this.getHexNeighbors(col, row);
  }

  /**
   * マウス座標から角度を計算
   */
  calculateMouseAngle(
    centerX: number,
    centerY: number,
    mouseX: number,
    mouseY: number,
    camera: Phaser.Cameras.Scene2D.Camera
  ): number {
    const worldMouseX = (mouseX + camera.scrollX) / camera.zoom;
    const worldMouseY = (mouseY + camera.scrollY) / camera.zoom;

    const dx = worldMouseX - centerX;
    const dy = worldMouseY - centerY;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    return angle;
  }

  /**
   * 行動履歴から移動経路を計算する（六角形グリッド用）
   */
  calculateMovementPath(startPosition: Position, endPosition: Position): Position[] {
    const path: Position[] = [];
    let currentCol = startPosition.col;
    let currentRow = startPosition.row;

    // 六角形グリッドの最短経路計算
    while (currentCol !== endPosition.col || currentRow !== endPosition.row) {
      const neighbors = this.getHexNeighbors(currentCol, currentRow);
      
      // 目標に最も近い隣接セルを選択
      let bestNeighbor = neighbors[0];
      let bestDistance = Infinity;
      
      for (const neighbor of neighbors) {
        // マンハッタン距離で近似
        const distance = Math.abs(neighbor.col - endPosition.col) + Math.abs(neighbor.row - endPosition.row);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestNeighbor = neighbor;
        }
      }
      
      if (!bestNeighbor) {
        console.warn("移動可能な隣接セルが見つかりません");
        break;
      }
      
      currentCol = bestNeighbor.col;
      currentRow = bestNeighbor.row;
      path.push({ col: currentCol, row: currentRow });

      // 無限ループ防止（最大移動数制限）
      if (path.length > 50) {
        console.warn("移動経路計算で無限ループが検出されました");
        break;
      }
    }

    return path;
  }
}
