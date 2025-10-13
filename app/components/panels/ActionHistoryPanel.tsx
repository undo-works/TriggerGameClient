import { ActionHistory } from "~/entities/ActionHistoryEntity";

interface ActionHistoryPanelProps {
  globalActionHistory?: ActionHistory[];
}

// 履歴表示コンポーネント
const ActionHistoryPanel = ({
  globalActionHistory,
}: ActionHistoryPanelProps) => {
  return (
    <div className="text-white p-2 text-sm z-50 max-w-sm w-full">
      {globalActionHistory?.map((history, index) => (
        <div
          key={index}
          className="mb-2 p-2 bg-gray-700 bg-opacity-50 rounded text-xs"
        >
          <div className="text-sky-300 font-bold">
            {history.characterId}
          </div>
          <div className="text-slate-300">
            位置: ({history.position.x}, {history.position.y})
          </div>
          {history.mainTriggerAngle !== null && (
            <div className="text-red-300">
              Main: {history.mainTriggerAngle.toFixed(2)}°
            </div>
          )}
          {history.subTriggerAngle !== null && (
            <div className="text-blue-300">
              Sub: {history.subTriggerAngle.toFixed(2)}°
            </div>
          )}
          <div className="text-gray-400 text-xs">
            {new Date(history.timestamp).toLocaleTimeString()}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActionHistoryPanel;
