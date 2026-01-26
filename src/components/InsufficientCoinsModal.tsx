'use client';

type Props = {
  open: boolean;
  needCoins: number;
  onClose: () => void;
};

export function InsufficientCoinsModal({ open, needCoins, onClose }: Props) {
  if (!open) return null;

  const handleGetCoins = () => {
    window.dispatchEvent(new CustomEvent('open-get-coins'));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#FBF9F4] border border-stone-200 rounded-2xl shadow-xl max-w-sm w-full p-6 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-stone-800 text-center mb-6">
          铜币不足，本次需要 {needCoins} 铜币。请先充值后再试。
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-stone-300 text-stone-600 text-sm hover:bg-stone-50"
          >
            我知道了
          </button>
          <button
            type="button"
            onClick={handleGetCoins}
            className="flex-1 py-2.5 rounded-lg bg-stone-800 text-white text-sm hover:bg-stone-700"
          >
            获取铜币
          </button>
        </div>
      </div>
    </div>
  );
}
