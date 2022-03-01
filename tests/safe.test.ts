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
  beforeAll,
} from "../deps.ts";
import { SafeModel, Task } from "../models/safe.model.ts";

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

    it("succeeds and register specified addresses as safe owners, increases owners count and saves threshold when threshold < no. owners", () => {
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

    it("succeeds and register specified addresses as safe owners, increases owners count and saves threshold when threshold = no. owners", () => {
      const owners: Account[] = [
        accounts.get("wallet_1")!,
        accounts.get("wallet_2")!,
        accounts.get("wallet_5")!,
        accounts.get("wallet_4")!,
        accounts.get("wallet_3")!,
      ];
      const threshold = owners.length;
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

  describe("add-owners()", () => {
    it("fails when safe has not been set up", () => {
      const owners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_1")!,
      ];
      const txSender = accounts.get("wallet_4")!;
      const addOwnersTx = safe.addOwners(owners, txSender);

      // act
      const receipt = chain.mineBlock([addOwnersTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_NOT_SETUP);
    });

    it("fails when owners list is empty", () => {
      const initialOwners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_1")!,
      ];
      const owners: Account[] = [];
      const threshold = 2;
      const txSender = ctx.deployer;
      const setupTx = safe.setup(initialOwners, threshold, txSender);
      const addOwnersTx = safe.addOwners(owners, txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([addOwnersTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_EMPTY_LIST);
    });

    it("fails when owners list contains duplicates", () => {
      const initialOwners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_1")!,
      ];
      const owners: Account[] = [
        accounts.get("wallet_3")!,
        accounts.get("wallet_3")!,
      ];
      const threshold = 2;
      const txSender = ctx.deployer;
      const setupTx = safe.setup(initialOwners, threshold, txSender);
      const addOwnersTx = safe.addOwners(owners, txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([addOwnersTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_DUPLICATE_OWNER);
    });

    it("fails when owners list contains addresses which are already safe owners", () => {
      const initialOwners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_1")!,
      ];
      const owners: Account[] = [
        accounts.get("wallet_3")!,
        accounts.get("wallet_1")!,
        accounts.get("wallet_4")!,
      ];
      const threshold = 2;
      const txSender = ctx.deployer;
      const setupTx = safe.setup(initialOwners, threshold, txSender);
      const addOwnersTx = safe.addOwners(owners, txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([addOwnersTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_DUPLICATE_OWNER);
    });

    it("succeeds and adds new addresses as safe owners and increase owners count", () => {
      const initialOwners: Account[] = [
        accounts.get("wallet_7")!,
        accounts.get("wallet_5")!,
      ];
      const owners: Account[] = [
        accounts.get("wallet_3")!,
        accounts.get("wallet_4")!,
        accounts.get("wallet_9")!,
      ];
      const threshold = 2;
      const txSender = ctx.deployer;
      const setupTx = safe.setup(initialOwners, threshold, txSender);
      const addOwnersTx = safe.addOwners(owners, txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([addOwnersTx]).receipts[0];

      // assert
      receipt.result.expectOk().expectBool(true);

      for (let owner of owners) {
        const result = safe.isOwner(owner);
        result.expectBool(true);
      }

      const ownersCount = safe.getOwnersCount();
      ownersCount.expectUint(initialOwners.length + owners.length);
    });
  });

  describe("remove-owners()", () => {
    it("fails when safe has not been setup", () => {
      const owners: Account[] = [accounts.get("wallet_1")!];
      const txSender = ctx.deployer;
      const removeOwnersTx = safe.removeOwners(owners, txSender);

      // act
      const receipt = chain.mineBlock([removeOwnersTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_NOT_SETUP);
    });

    it("fails when owners list is empty", () => {
      const initialOwners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_3")!,
      ];
      const threshold = 1;
      const owners: Account[] = [];
      const txSender = ctx.deployer;
      const setupTx = safe.setup(initialOwners, threshold, txSender);
      const removeOwnersTx = safe.removeOwners(owners, txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([removeOwnersTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_EMPTY_LIST);
    });

    it("fails when owners list contains address that is not safe owner", () => {
      const initialOwners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_3")!,
      ];
      const threshold = 1;
      const owners: Account[] = [accounts.get("wallet_1")!];
      const txSender = ctx.deployer;
      const setupTx = safe.setup(initialOwners, threshold, txSender);
      const removeOwnersTx = safe.removeOwners(owners, txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([removeOwnersTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_NOT_FOUND);
    });

    it("fails when owners list contains duplicates (trying to remove same address more than once)", () => {
      const initialOwners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_3")!,
        accounts.get("wallet_5")!,
      ];
      const threshold = 1;
      const owners: Account[] = [
        accounts.get("wallet_3")!,
        accounts.get("wallet_3")!,
      ];
      const txSender = ctx.deployer;
      const setupTx = safe.setup(initialOwners, threshold, txSender);
      const removeOwnersTx = safe.removeOwners(owners, txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([removeOwnersTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_NOT_FOUND);
    });

    it("fails when length of owners list is equal owners count (aka. abandoning safe)", () => {
      const initialOwners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_3")!,
      ];
      const threshold = 1;
      const owners: Account[] = [
        accounts.get("wallet_3")!,
        accounts.get("wallet_2")!,
      ];
      const txSender = ctx.deployer;
      const setupTx = safe.setup(initialOwners, threshold, txSender);
      const removeOwnersTx = safe.removeOwners(owners, txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([removeOwnersTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_CANT_ABANDON);
    });

    it("succeeds and removes owners, reduce owners count", () => {
      const initialOwners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_3")!,
        accounts.get("wallet_5")!,
      ];
      const threshold = 1;
      const owners: Account[] = [
        accounts.get("wallet_3")!,
        accounts.get("wallet_2")!,
      ];
      const txSender = ctx.deployer;
      const setupTx = safe.setup(initialOwners, threshold, txSender);
      const removeOwnersTx = safe.removeOwners(owners, txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([removeOwnersTx]).receipts[0];

      // assert
      receipt.result.expectOk().expectBool(true);

      for (let owner of owners) {
        const result = safe.isOwner(owner);
        result.expectBool(false);
      }

      const ownersCount = safe.getOwnersCount();
      ownersCount.expectUint(initialOwners.length - owners.length);
    });

    it("succeeds and removes owners, reduce owners count, reduce threshold if owners count dropped below current ones", () => {
      const initialOwners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_3")!,
        accounts.get("wallet_5")!,
      ];
      const threshold = initialOwners.length;
      const owners: Account[] = [
        accounts.get("wallet_3")!,
        accounts.get("wallet_2")!,
      ];
      const txSender = ctx.deployer;
      const setupTx = safe.setup(initialOwners, threshold, txSender);
      const removeOwnersTx = safe.removeOwners(owners, txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([removeOwnersTx]).receipts[0];

      // assert
      receipt.result.expectOk().expectBool(true);

      for (let owner of owners) {
        const result = safe.isOwner(owner);
        result.expectBool(false);
      }

      const ownersCount = safe.getOwnersCount();
      ownersCount.expectUint(initialOwners.length - owners.length);

      const newThreshold = safe.getThreshold();
      newThreshold.expectUint(threshold - owners.length);
    });
  });

  describe("change-threshold()", () => {
    it("fails when safe has not been setup", () => {
      const txSender = accounts.get("wallet-5")!;
      const threshold = 2;
      const changeThresholdTx = safe.changeThreshold(threshold, txSender);

      // act
      const receipt = chain.mineBlock([changeThresholdTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_NOT_SETUP);
    });

    it("fails when threshold is equal 0", () => {
      const initialOwners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_3")!,
        accounts.get("wallet_5")!,
      ];
      const initialThreshold = initialOwners.length;
      const threshold = 0;
      const txSender = ctx.deployer;
      const setupTx = safe.setup(initialOwners, initialThreshold, txSender);
      const changeThresholdTx = safe.changeThreshold(threshold, txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([changeThresholdTx]).receipts[0];

      // assert
      receipt.result
        .expectErr()
        .expectUint(SafeModel.Err.ERR_INCORRECT_THRESHOLD);
    });

    it("fails when threshold is greater than owners count", () => {
      const initialOwners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_3")!,
        accounts.get("wallet_5")!,
      ];
      const initialThreshold = initialOwners.length;
      const threshold = 15;
      const txSender = ctx.deployer;
      const setupTx = safe.setup(initialOwners, initialThreshold, txSender);
      const changeThresholdTx = safe.changeThreshold(threshold, txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([changeThresholdTx]).receipts[0];

      // assert
      receipt.result
        .expectErr()
        .expectUint(SafeModel.Err.ERR_INCORRECT_THRESHOLD);
    });

    it("succeeds and changes threshold to lower value than previous one", () => {
      const initialOwners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_3")!,
        accounts.get("wallet_5")!,
      ];
      const initialThreshold = initialOwners.length;
      const threshold = 1;
      const txSender = ctx.deployer;
      const setupTx = safe.setup(initialOwners, initialThreshold, txSender);
      const changeThresholdTx = safe.changeThreshold(threshold, txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([changeThresholdTx]).receipts[0];

      // assert
      receipt.result.expectOk().expectBool(true);

      safe.getThreshold().expectUint(threshold);
    });

    it("succeeds and changes threshold to higher value than previous one", () => {
      const initialOwners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_5")!,
        accounts.get("wallet_4")!,
        accounts.get("wallet_7")!,
        accounts.get("wallet_3")!,
      ];
      const initialThreshold = 1;
      const threshold = 3;
      const txSender = ctx.deployer;
      const setupTx = safe.setup(initialOwners, initialThreshold, txSender);
      const changeThresholdTx = safe.changeThreshold(threshold, txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([changeThresholdTx]).receipts[0];

      // assert
      receipt.result.expectOk().expectBool(true);

      safe.getThreshold().expectUint(threshold);
    });
  });

  describe("create-task()", () => {
    it("fails when safe has not been setup", () => {
      const txSender = accounts.get("wallet_5")!;
      const createTaskTx = safe.createTask(txSender);

      // act
      const receipt = chain.mineBlock([createTaskTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_NOT_SETUP);
    });

    it("fails when called by walled by wallet that is not one of the safe owners", () => {
      const owners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_3")!,
      ];
      const threshold = 1;
      const setupTxSender = ctx.deployer;
      const txSender = accounts.get("wallet_5")!;
      const setupTx = safe.setup(owners, threshold, setupTxSender);
      const createTaskTx = safe.createTask(txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([createTaskTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_NOT_AUTHORIZED);
    });

    it("succeeds, creates new task with current threshold, 0 approvals and returns its id", () => {
      const owners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_3")!,
      ];
      const threshold = 2;
      const setupTxSender = ctx.deployer;
      const txSender = owners[0];
      const setupTx = safe.setup(owners, threshold, setupTxSender);
      const createTaskTx = safe.createTask(txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([createTaskTx]).receipts[0];

      // assert
      const expectedTaskId = 1;
      receipt.result.expectOk().expectUint(expectedTaskId);

      safe.getLastTaskId().expectUint(expectedTaskId);

      const task = safe
        .getTask(expectedTaskId)
        .expectSome()
        .expectTuple() as Task;
      task.threshold.expectUint(threshold);
      task.approvals.expectUint(0);
    });

    it("succeeds, creates new task with current threshold, 0 approvals and returns its id when threshold has been modified", () => {
      const owners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_3")!,
      ];
      const threshold = 2;
      const newThreshold = 1;
      const setupTxSender = ctx.deployer;
      const txSender = owners[0];
      const setupTx = safe.setup(owners, threshold, setupTxSender);
      const changeThresholdTx = safe.changeThreshold(newThreshold, txSender);
      const createTaskTx = safe.createTask(txSender);
      chain.mineBlock([setupTx, changeThresholdTx]);

      // act
      const receipt = chain.mineBlock([createTaskTx]).receipts[0];

      // assert
      const expectedTaskId = 1;
      receipt.result.expectOk().expectUint(expectedTaskId);

      safe.getLastTaskId().expectUint(expectedTaskId);

      const task = safe
        .getTask(expectedTaskId)
        .expectSome()
        .expectTuple() as Task;
      task.threshold.expectUint(newThreshold);
      task.approvals.expectUint(0);
    });
  });

  describe("approve-task()", () => {
    beforeEach(() => {
      // setup safe and create task before each test
      const owners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_3")!,
        accounts.get("wallet_4")!,
        accounts.get("wallet_5")!,
        accounts.get("wallet_6")!,
        accounts.get("wallet_7")!,
      ];
      const threshold = 3;
      const setupTxSender = ctx.deployer;
      const txSender = owners[0];
      const setupTx = safe.setup(owners, threshold, setupTxSender);
      const createTaskTx = safe.createTask(txSender);
      chain.mineBlock([setupTx, createTaskTx]);
    });

    it("fails while trying to approve unknown task", () => {
      const txSender = accounts.get("wallet_4")!;
      const taskId = 2;
      const approveTaskTx = safe.approveTask(taskId, txSender);

      // act
      const receipt = chain.mineBlock([approveTaskTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_UNKNOWN_TASK);
    });

    it("fails when called by wallet that is not one of the safe owners", () => {
      const txSender = accounts.get("wallet_1")!;
      const taskId = 1;
      const approveTaskTx = safe.approveTask(taskId, txSender);

      // act
      const receipt = chain.mineBlock([approveTaskTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_NOT_AUTHORIZED);
    });

    it("succeeds when called by wallet that is one of the safe owners and increase task approvals count", () => {
      const txSender = accounts.get("wallet_2")!;
      const taskId = 1;
      const approveTaskTx = safe.approveTask(taskId, txSender);

      // act
      const receipt = chain.mineBlock([approveTaskTx]).receipts[0];

      // assert
      receipt.result.expectOk().expectBool(true);

      const task = safe.getTask(taskId).expectSome().expectTuple() as Task;
      task.approvals.expectUint(1);
    });

    it("succeeds when called by multiple wallets each the safe owners and increase task approvals count", () => {
      const taskId = 1;
      const txSender1 = accounts.get("wallet_2")!;
      const txSender2 = accounts.get("wallet_3")!;
      const approveTaskTx1 = safe.approveTask(taskId, txSender1);
      const approveTaskTx2 = safe.approveTask(taskId, txSender2);

      // act
      const receipt = chain.mineBlock([approveTaskTx1, approveTaskTx2]).receipts[0];

      // assert
      receipt.result.expectOk().expectBool(true);

      const task = safe.getTask(taskId).expectSome().expectTuple() as Task;
      task.approvals.expectUint(2);
    });

    it("fails to approve sam task more than once", () => {
      const txSender = accounts.get("wallet_2")!;
      const taskId = 1;
      const approveTaskTx = safe.approveTask(taskId, txSender);
      chain.mineBlock([approveTaskTx])

      // act
      const receipt = chain.mineBlock([approveTaskTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_ALREADY_APPROVED);

      const task = safe.getTask(taskId).expectSome().expectTuple() as Task;
      task.approvals.expectUint(1);
    });
  });
});

run();
