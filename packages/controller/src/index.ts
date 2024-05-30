export * from "./types";
export { defaultPresets } from "./presets";

import {
  AccountInterface,
  addAddressPadding,
  constants,
  RpcProvider,
} from "starknet";
import {
  AsyncMethodReturns,
  Connection,
  connectToChild,
} from "@cartridge/penpal";

import DeviceAccount from "./device";
import {
  Session,
  Keychain,
  Policy,
  ResponseCodes,
  ConnectReply,
  ProbeReply,
  Modal,
  ControllerOptions,
  ControllerThemePresets,
  ColorMode,
} from "./types";
import { createModal } from "./modal";
import { defaultPresets } from "./presets";
import { NotReadyToConnect } from "./errors";

// @dev override url to local sequencer for local dev
// http://localhost:8000/x/starknet/mainnet
export const providers: { [key: string]: RpcProvider } = {
  [constants.StarknetChainId.SN_MAIN]: new RpcProvider({
    nodeUrl: "https://api.cartridge.gg/x/starknet/mainnet",
  }),
  [constants.StarknetChainId.SN_SEPOLIA]: new RpcProvider({
    nodeUrl: "https://api.cartridge.gg/x/starknet/sepolia",
  }),
};

class Controller {
  private connection?: Connection<Keychain>;
  public keychain?: AsyncMethodReturns<Keychain>;
  private policies: Policy[] = [];
  private url: string = "https://x.cartridge.gg";
  public chainId: constants.StarknetChainId =
    constants.StarknetChainId.SN_SEPOLIA;
  public accounts?: { [key: string]: AccountInterface };
  private modal?: Modal;
  // private starterPackId?: string;

  constructor(policies?: Policy[], options?: ControllerOptions) {
    if (policies) {
      this.policies = policies.map((policy) => {
        return {
          ...policy,
          target: addAddressPadding(policy.target),
        };
      });
    }

    if (options?.chainId) {
      this.chainId = options.chainId;
    }

    if (options?.url) {
      this.url = options.url;
    }

    this.setTheme(options?.theme, options?.config?.presets);
    if (options?.colorMode) {
      this.setColorMode(options.colorMode);
    }

    if (typeof document === "undefined") {
      return;
    }

    this.modal = createModal(this.url, () => {
      this.keychain?.reset();
    });

    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      document.body.appendChild(this.modal.element);
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        document.body.appendChild(this.modal!.element);
      });
    }

    this.connection = connectToChild<Keychain>({
      iframe: this.modal.element.children[0] as HTMLIFrameElement,
    });

    this.connection.promise
      .then((keychain) => (this.keychain = keychain))
      .then(() => this.probe());
  }

  get account() {
    if (!this.accounts) {
      return;
    }

    return this.accounts[this.chainId];
  }

  private setTheme(
    id: string = "cartridge",
    presets: ControllerThemePresets = defaultPresets,
  ) {
    const theme = presets[id] ?? defaultPresets.cartridge;

    const url = new URL(this.url);
    url.searchParams.set("theme", encodeURIComponent(JSON.stringify(theme)));
    this.url = url.toString();
  }

  private setColorMode(colorMode: ColorMode) {
    const url = new URL(this.url);
    url.searchParams.set("colorMode", colorMode);
    this.url = url.toString();
  }

  ready() {
    return (
      this.connection?.promise
        .then(() => this.probe())
        .then(
          (res) => !!res,
          () => false,
        ) ?? Promise.resolve(false)
    );
  }

  async probe() {
    if (!this.keychain || !this.modal) {
      console.error(new NotReadyToConnect().message);
      return null;
    }

    try {
      const res = await this.keychain.probe();
      if (res.code !== ResponseCodes.SUCCESS) {
        return;
      }

      const { address } = res as ProbeReply;
      this.accounts = {
        [constants.StarknetChainId.SN_MAIN]: new DeviceAccount(
          providers[constants.StarknetChainId.SN_MAIN],
          address,
          this.keychain,
          this.modal,
        ) as AccountInterface, // Note: workaround for execute type mismatch error
        [constants.StarknetChainId.SN_SEPOLIA]: new DeviceAccount(
          providers[constants.StarknetChainId.SN_SEPOLIA],
          address,
          this.keychain,
          this.modal,
        ) as AccountInterface,
      };
    } catch (e) {
      console.error(e);
      return;
    }

    return !!this.accounts?.[this.chainId];
  }

  async switchChain(chainId: constants.StarknetChainId) {
    if (this.chainId === chainId) {
      return;
    }

    this.chainId = chainId;
  }

  async login(
    address: string,
    credentialId: string,
    options: {
      rpId?: string;
      challengeExt?: Buffer;
    },
  ) {
    if (!this.keychain) {
      console.error(new NotReadyToConnect().message);
      return null;
    }

    return this.keychain.login(address, credentialId, options);
  }

  async issueStarterPack(id: string) {
    if (!this.keychain || !this.modal) {
      const err = new NotReadyToConnect();
      console.error(err.message);
      return Promise.reject(err.message);
    }

    this.modal.open();

    try {
      if (!this.account) {
        let response = await this.keychain.connect(
          this.policies,
          undefined,
          this.chainId,
        );
        if (response.code !== ResponseCodes.SUCCESS) {
          throw new Error(response.message);
        }
      }

      return await this.keychain.issueStarterPack(id);
    } catch (e) {
      console.log(e);
      return Promise.reject(e);
    } finally {
      this.modal.close();
    }
  }

  async showQuests(gameId: string) {
    if (!this.keychain || !this.modal) {
      console.error(new NotReadyToConnect().message);
      return;
    }

    this.modal.open();

    try {
      return await this.keychain.showQuests(gameId);
    } catch (e) {
      console.error(e);
    } finally {
      this.modal.close();
    }
  }

  async connect() {
    if (this.accounts) {
      return this.accounts[this.chainId];
    }

    if (!this.keychain || !this.modal) {
      console.error(new NotReadyToConnect().message);
      return;
    }

    if (!!document.hasStorageAccess) {
      const ok = await document.hasStorageAccess();
      if (!ok) {
        await document.requestStorageAccess();
      }
    }

    this.modal.open();

    try {
      let response = await this.keychain.connect(
        this.policies,
        undefined,
        this.chainId,
      );
      if (response.code !== ResponseCodes.SUCCESS) {
        throw new Error(response.message);
      }

      response = response as ConnectReply;
      this.accounts = {
        [constants.StarknetChainId.SN_MAIN]: new DeviceAccount(
          providers[constants.StarknetChainId.SN_MAIN],
          response.address,
          this.keychain,
          this.modal,
        ) as AccountInterface,
        [constants.StarknetChainId.SN_SEPOLIA]: new DeviceAccount(
          providers[constants.StarknetChainId.SN_SEPOLIA],
          response.address,
          this.keychain,
          this.modal,
        ) as AccountInterface,
      };

      return this.accounts[this.chainId];
    } catch (e) {
      console.log(e);
    } finally {
      this.modal.close();
    }
  }

  async disconnect() {
    if (!this.keychain) {
      console.error(new NotReadyToConnect().message);
      return;
    }

    if (!!document.hasStorageAccess) {
      const ok = await document.hasStorageAccess();
      if (!ok) {
        await document.requestStorageAccess();
      }
    }

    this.accounts = undefined;
    return this.keychain.disconnect();
  }

  revoke(origin: string, _policy: Policy[]) {
    if (!this.keychain) {
      console.error(new NotReadyToConnect().message);
      return null;
    }

    return this.keychain.revoke(origin);
  }

  async approvals(origin: string): Promise<Session | undefined> {
    if (!this.keychain) {
      console.error(new NotReadyToConnect().message);
      return;
    }

    return this.keychain.approvals(origin);
  }

  username() {
    if (!this.keychain) {
      console.error(new NotReadyToConnect().message);
      return;
    }

    return this.keychain.username();
  }
}

export * from "./types";
export * from "./errors";
export { computeAddress, split, verifyMessageHash } from "./utils";
export { injectController } from "./inject";
export default Controller;
