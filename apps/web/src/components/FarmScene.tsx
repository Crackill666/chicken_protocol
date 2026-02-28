import { useMemo } from "react";

export type FarmSlot = {
  index: number;
  assetType: number;
  tokenId: number;
  unlocked: boolean;
};

export type DragAsset = {
  assetType: 1 | 2 | 3;
  tokenId: number;
};

export type IncubatorSlotStatus = {
  badge: string;
  tone: "incubating" | "cooking" | "ready";
  countdown?: string;
};

type AssetImages = {
  genesis: string;
  offspring: string;
  incubator: string;
  farmBase: string;
};

type Props = {
  slots: FarmSlot[];
  onSlotClick: (slotIndex: number) => void;
  onSlotDrop: (slotIndex: number, asset: DragAsset) => void;
  onSlotRemove: (slotIndex: number) => void;
  onCollectFromSlot: () => void;
  onSettleFromSlot: (incubatorId: number) => void;
  selectedSlot?: number;
  canCollectEggs: boolean;
  assetTurnCountdown?: string;
  assetImages: AssetImages;
  incubatorStatusByTokenId: ReadonlyMap<number, IncubatorSlotStatus>;
  labels: {
    slot: string;
    locked: string;
    dropHere: string;
    fire: string;
    collect: string;
    remove: string;
    finalize: string;
  };
};

function AssetIcon({ assetType, assetImages }: { assetType: number; assetImages: AssetImages }) {
  const src = assetType === 1 ? assetImages.genesis : assetType === 2 ? assetImages.offspring : assetType === 3 ? assetImages.incubator : "";
  if (!src) return null;
  const assetClass = `pixel-slot-asset${assetType === 2 ? " is-offspring" : ""}${assetType === 3 ? " is-incubator" : ""}`;
  return (
    <img
      src={src}
      alt="asset"
      className={assetClass}
      loading="lazy"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

export default function FarmScene({
  slots,
  onSlotClick,
  onSlotDrop,
  onSlotRemove,
  onCollectFromSlot,
  onSettleFromSlot,
  selectedSlot,
  canCollectEggs,
  assetTurnCountdown,
  assetImages,
  incubatorStatusByTokenId,
  labels,
}: Props) {
  const rows = useMemo(() => Math.ceil(slots.length / 4), [slots.length]);
  const sceneHeight = 450 + Math.max(0, rows - 3) * 112;

  return (
    <div className="pixel-scene-frame">
      <div className="pixel-scene" style={{ minHeight: sceneHeight }}>
        <img src={assetImages.farmBase} alt="farm" className="pixel-scene-bg" />
        <div className="pixel-scene-overlay" />
        <div className="pixel-scene-lines" />

        <div
          className="pixel-scene-grid"
          style={{
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          }}
        >
          {slots.map((slot) => {
            const isEmpty = slot.assetType === 0;
            const incubatorStatus = slot.assetType === 3 ? incubatorStatusByTokenId.get(slot.tokenId) : undefined;
            const badgeClass = incubatorStatus?.tone === "ready" ? "is-ready" : incubatorStatus?.tone === "incubating" ? "is-incubating" : "is-cooking";
            const slotCountdown = slot.assetType === 3 ? incubatorStatus?.countdown : slot.assetType === 1 || slot.assetType === 2 ? assetTurnCountdown : undefined;
            const canFinalizeIncubator = slot.assetType === 3 && incubatorStatus?.tone === "ready";
            const removeDisabled = slot.assetType === 3 && (incubatorStatus?.tone === "incubating" || incubatorStatus?.tone === "cooking");
            const canCollectFromThisSlot = (slot.assetType === 1 || slot.assetType === 2) && canCollectEggs;

            return (
              <div
                key={slot.index}
                role="button"
                tabIndex={slot.unlocked ? 0 : -1}
                onClick={() => {
                  if (!slot.unlocked) return;
                  onSlotClick(slot.index);
                }}
                onKeyDown={(event) => {
                  if (!slot.unlocked) return;
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  onSlotClick(slot.index);
                }}
                onDragOver={(event) => {
                  if (!slot.unlocked || !isEmpty) return;
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  if (!slot.unlocked || !isEmpty) return;
                  event.preventDefault();
                  const data = event.dataTransfer.getData("application/x-chicken-asset");
                  if (!data) return;

                  try {
                    const parsed = JSON.parse(data) as DragAsset;
                    if (
                      (parsed.assetType === 1 || parsed.assetType === 2 || parsed.assetType === 3) &&
                      Number.isInteger(parsed.tokenId) &&
                      parsed.tokenId > 0
                    ) {
                      onSlotDrop(slot.index, parsed);
                    }
                  } catch {
                    // Ignore malformed payloads.
                  }
                }}
                className={`pixel-slot ${slot.unlocked ? "is-unlocked" : "is-locked"} ${selectedSlot === slot.index ? "is-selected" : ""}`}
              >
                {!slot.unlocked ? (
                  <div className="pixel-slot-inner pixel-slot-lock">
                    {labels.locked}
                  </div>
                ) : isEmpty ? (
                  <div className="pixel-slot-inner pixel-slot-empty">
                    <span>
                      {labels.slot} {slot.index + 1}
                    </span>
                    <span className="mt-1 text-[10px] opacity-90">{labels.dropHere}</span>
                  </div>
                ) : (
                  <div className="pixel-slot-inner pixel-slot-filled">
                    <AssetIcon assetType={slot.assetType} assetImages={assetImages} />
                    <span className="pixel-slot-id">#{slot.tokenId}</span>
                    {slotCountdown && <span className="pixel-slot-countdown">{slotCountdown}</span>}
                    <div className="pixel-slot-actions">
                      {(slot.assetType === 1 || slot.assetType === 2) && (
                        <button
                          type="button"
                          className="pixel-slot-action-btn is-collect"
                          disabled={!canCollectFromThisSlot}
                          onClick={(event) => {
                            event.stopPropagation();
                            onCollectFromSlot();
                          }}
                        >
                          {labels.collect}
                        </button>
                      )}

                      {canFinalizeIncubator && (
                        <button
                          type="button"
                          className="pixel-slot-action-btn is-finalize"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSettleFromSlot(slot.tokenId);
                          }}
                        >
                          {labels.finalize}
                        </button>
                      )}

                      <button
                        type="button"
                        className="pixel-slot-action-btn is-remove"
                        disabled={removeDisabled}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSlotRemove(slot.index);
                        }}
                      >
                        {labels.remove}
                      </button>
                    </div>
                  </div>
                )}

                {incubatorStatus && (
                  <span className={`pixel-incubator-badge ${badgeClass} ${incubatorStatus.tone === "cooking" ? "is-flashing" : ""}`}>
                    {incubatorStatus.badge}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
