import {
  describe,
  it,
  run,
  Context,
  beforeEach,
  types,
  Chain,
  Accounts,
  Account,
} from "../deps.ts";
import { SafeModel } from "../models/safe.model.ts";

let ctx: Context;
let safe: SafeModel;
let chain: Chain;
let accounts: Accounts;

beforeEach(() => {
  ctx = new Context();
  safe = ctx.models.get(SafeModel);
  chain = ctx.chain;
  accounts = ctx.accounts;

  chain.mineEmptyBlock(200);
});

describe("[SAFE]", () => {
  describe("get-owners-count()", () => {
    it("returns 0 right after contract deployment", () => {
      const result = safe.getOwnersCount();
      result.expectUint(0);
    });
  });

  describe("get-threshold()", () => {
    it("returns 0 right after contract deployment", () => {
      const result = safe.getThreshold();
      result.expectUint(0);
    });
  });

  describe("is-owner()", () => {
    it("returns false for wallet that is not designated as safe owner", () => {
      const who = accounts.get("wallet_1")!;

      // act
      const result = safe.isOwner(who);

      // assert
      result.expectBool(false);
    });
  });

  describe("setup()", () => {
    it("fails when called by address different than contract deployer", () => {
      const owners: Account[] = [];
      const threshold = 0;
      const txSender = accounts.get("wallet_4")!;
      const setupTx = safe.setup(owners, threshold, txSender);

      // act
      const receipt = chain.mineBlock([setupTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_NOT_AUTHORIZED);
    });

    it("fails when owners list is empty", () => {
      const owners: Account[] = [];
      const threshold = 0;
      const txSender = ctx.deployer;
      const setupTx = safe.setup(owners, threshold, txSender);

      // act
      const receipt = chain.mineBlock([setupTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_EMPTY_LIST);
    });

    it("fails when threshold is set to 0", () => {
      const owners: Account[] = [accounts.get("wallet_1")!];
      const threshold = 0;
      const txSender = ctx.deployer;
      const setupTx = safe.setup(owners, threshold, txSender);

      // act
      const receipt = chain.mineBlock([setupTx]).receipts[0];

      // assert
      receipt.result
        .expectErr()
        .expectUint(SafeModel.Err.ERR_INCORRECT_THRESHOLD);
    });

    it("fails when threshold is greater than number of owners", () => {
      const owners: Account[] = [accounts.get("wallet_1")!];
      const threshold = 2;
      const txSender = ctx.deployer;
      const setupTx = safe.setup(owners, threshold, txSender);

      // act
      const receipt = chain.mineBlock([setupTx]).receipts[0];

      // assert
      receipt.result
        .expectErr()
        .expectUint(SafeModel.Err.ERR_INCORRECT_THRESHOLD);
    });

    it("fails when owners list contains duplicate addresses", () => {
      const owners: Account[] = [
        accounts.get("wallet_1")!,
        accounts.get("wallet_2")!,
        accounts.get("wallet_5")!,
        accounts.get("wallet_7")!,
        accounts.get("wallet_8")!,
        accounts.get("wallet_2")!, //duplicate
        accounts.get("wallet_3")!,
      ];
      const threshold = 2;
      const txSender = ctx.deployer;
      const setupTx = safe.setup(owners, threshold, txSender);

      // act
      const receipt = chain.mineBlock([setupTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_DUPLICATE_OWNER);
      for (let owner of owners) {
        const result = safe.isOwner(owner);
        result.expectBool(false);
      }
    });

    it("succeeds and register specified addresses as safe owners, increases owners count and saves threshold", () => {
      const owners: Account[] = [
        accounts.get("wallet_1")!,
        accounts.get("wallet_2")!,
        accounts.get("wallet_5")!,
      ];
      const threshold = 2;
      const txSender = ctx.deployer;
      const setupTx = safe.setup(owners, threshold, txSender);

      // act
      const receipt = chain.mineBlock([setupTx]).receipts[0];

      // assert
      receipt.result.expectOk().expectBool(true);

      for (let owner of owners) {
        const result = safe.isOwner(owner);
        result.expectBool(true);
      }

      const ownersCount = safe.getOwnersCount();
      ownersCount.expectUint(owners.length);

      const safeThreshold = safe.getThreshold();
      safeThreshold.expectUint(threshold);
    });

    it("fails when called 2nd time", () => {
      const owners: Account[] = [
        accounts.get("wallet_1")!,
        accounts.get("wallet_2")!,
        accounts.get("wallet_5")!,
      ];
      const threshold = 2;
      const txSender = ctx.deployer;
      const setupTx = safe.setup(owners, threshold, txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([setupTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_ALREADY_SETUP);
    });
  });
});

run();
