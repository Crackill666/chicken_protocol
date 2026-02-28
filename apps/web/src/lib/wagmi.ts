import { createConfig, http } from "wagmi";
import { polygonAmoy } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const walletConnectProjectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID && import.meta.env.VITE_WALLETCONNECT_PROJECT_ID !== "REPLACE_ME"
    ? import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
    : "demo";

export const supportedChainId = Number(import.meta.env.VITE_CHAIN_ID ?? polygonAmoy.id);

export const wagmiConfig = createConfig({
  chains: [polygonAmoy],
  connectors: [
    injected({ target: "metaMask" }),
    walletConnect({
      projectId: walletConnectProjectId,
      showQrModal: true,
      metadata: {
        name: "Chicken Protocol",
        description: "On-chain farm strategy game",
        url: "https://chicken-protocol.local",
        icons: ["https://avatars.githubusercontent.com/u/37784886"],
      },
    }),
  ],
  transports: {
    [polygonAmoy.id]: http(import.meta.env.VITE_AMOY_RPC_URL ?? "https://rpc-amoy.polygon.technology"),
  },
});
