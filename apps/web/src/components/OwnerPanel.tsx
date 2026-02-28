import { formatPOL, shortAddress } from "@/lib/format";

type Labels = {
  ownerPanel: string;
  connectedOwner: string;
  pool: string;
  treasury: string;
  poolControls: string;
  treasuryControls: string;
  deposit: string;
  withdraw: string;
  copy: string;
  amountPlaceholder: string;
};

type Props = {
  visible: boolean;
  owner?: string;
  poolBalance?: bigint;
  treasuryBalance?: bigint;
  addresses: Record<string, string>;
  labels: Labels;
  depositPoolAmount: string;
  setDepositPoolAmount: (v: string) => void;
  withdrawPoolAmount: string;
  setWithdrawPoolAmount: (v: string) => void;
  depositTreasuryAmount: string;
  setDepositTreasuryAmount: (v: string) => void;
  withdrawTreasuryAmount: string;
  setWithdrawTreasuryAmount: (v: string) => void;
  onDepositPool: () => void;
  onWithdrawPool: () => void;
  onDepositTreasury: () => void;
  onWithdrawTreasury: () => void;
};

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      className="pixel-btn pixel-btn-blue !px-2 !py-1 !text-[0.48rem]"
      onClick={() => navigator.clipboard.writeText(value)}
      type="button"
    >
      {label}
    </button>
  );
}

export default function OwnerPanel(props: Props) {
  if (!props.visible) return null;

  return (
    <section className="pixel-shell w-full p-4 text-[#fef6ea]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-xl">{props.labels.ownerPanel}</h3>
        <p className="text-sm text-[#e8cfb1]">
          {props.labels.connectedOwner}: {shortAddress(props.owner)}
        </p>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <div className="pixel-stat text-sm">
          {props.labels.pool}: {formatPOL(props.poolBalance ?? 0n)} POL
        </div>
        <div className="pixel-stat text-sm">
          {props.labels.treasury}: {formatPOL(props.treasuryBalance ?? 0n)} POL
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="pixel-panel p-3">
          <h4 className="mb-2 font-semibold">{props.labels.poolControls}</h4>
          <div className="mb-2 flex gap-2">
            <input
              value={props.depositPoolAmount}
              onChange={(e) => props.setDepositPoolAmount(e.target.value)}
              placeholder={props.labels.amountPlaceholder}
              className="pixel-input"
            />
            <button onClick={props.onDepositPool} className="pixel-btn pixel-btn-gold">
              {props.labels.deposit}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={props.withdrawPoolAmount}
              onChange={(e) => props.setWithdrawPoolAmount(e.target.value)}
              placeholder={props.labels.amountPlaceholder}
              className="pixel-input"
            />
            <button onClick={props.onWithdrawPool} className="pixel-btn pixel-btn-rose">
              {props.labels.withdraw}
            </button>
          </div>
        </div>

        <div className="pixel-panel p-3">
          <h4 className="mb-2 font-semibold">{props.labels.treasuryControls}</h4>
          <div className="mb-2 flex gap-2">
            <input
              value={props.depositTreasuryAmount}
              onChange={(e) => props.setDepositTreasuryAmount(e.target.value)}
              placeholder={props.labels.amountPlaceholder}
              className="pixel-input"
            />
            <button onClick={props.onDepositTreasury} className="pixel-btn pixel-btn-gold">
              {props.labels.deposit}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={props.withdrawTreasuryAmount}
              onChange={(e) => props.setWithdrawTreasuryAmount(e.target.value)}
              placeholder={props.labels.amountPlaceholder}
              className="pixel-input"
            />
            <button onClick={props.onWithdrawTreasury} className="pixel-btn pixel-btn-rose">
              {props.labels.withdraw}
            </button>
          </div>
        </div>

        <div className="pixel-panel p-3">
          <h4 className="mb-2 font-semibold">Contracts</h4>
          <div className="space-y-1 text-xs">
            {Object.entries(props.addresses).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-2 rounded-md border border-[#b4885f]/25 bg-[#2c180f]/45 p-1">
                <span className="font-semibold uppercase">{key}</span>
                <span className="truncate text-[#e8cfb1]">{shortAddress(value)}</span>
                <CopyButton value={value} label={props.labels.copy} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
