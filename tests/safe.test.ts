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

    describe("after setup", () => {
      const initialThreshold = 2;
      const initialOwnersCount = 2;

      beforeEach(() => {
        const initialOwners: Account[] = [
          accounts.get("wallet_1")!,
          accounts.get("wallet_2")!,
        ];
        const setupTx = safe.setup(
          initialOwners,
          initialThreshold,
          ctx.deployer
        );
        chain.mineBlock([setupTx]);
        safe.getOwnersCount().expectUint(initialOwnersCount);
      });

      it("fails when owners list is empty", () => {
        const owners: Account[] = [];
        const txSender = ctx.deployer;
        const addOwnersTx = safe.addOwners(owners, txSender);

        // act
        const receipt = chain.mineBlock([addOwnersTx]).receipts[0];

        // assert
        receipt.result.expectErr().expectUint(SafeModel.Err.ERR_EMPTY_LIST);
      });

      it("fails when owners list contains duplicates", () => {
        const owners: Account[] = [
          accounts.get("wallet_3")!,
          accounts.get("wallet_3")!,
        ];
        const txSender = ctx.deployer;
        const addOwnersTx = safe.addOwners(owners, txSender);

        // act
        const receipt = chain.mineBlock([addOwnersTx]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(SafeModel.Err.ERR_DUPLICATE_OWNER);
      });

      it("fails when owners list contains addresses which are already safe owners", () => {
        const owners: Account[] = [
          accounts.get("wallet_3")!,
          accounts.get("wallet_1")!, // set up as initial safe owner
          accounts.get("wallet_4")!,
        ];
        const txSender = ctx.deployer;
        const addOwnersTx = safe.addOwners(owners, txSender);

        // act
        const receipt = chain.mineBlock([addOwnersTx]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(SafeModel.Err.ERR_DUPLICATE_OWNER);
      });

      it("succeeds and adds new addresses as safe owners and increase owners count", () => {
        const owners: Account[] = [
          accounts.get("wallet_3")!,
          accounts.get("wallet_4")!,
          accounts.get("wallet_9")!,
        ];
        const txSender = ctx.deployer;
        const addOwnersTx = safe.addOwners(owners, txSender);

        // act
        const receipt = chain.mineBlock([addOwnersTx]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        for (let owner of owners) {
          const result = safe.isOwner(owner);
          result.expectBool(true);
        }

        const ownersCount = safe.getOwnersCount();
        ownersCount.expectUint(initialOwnersCount + owners.length);
      });
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

    describe("after setup", () => {
      const initialThreshold = 2;
      const initialOwnersCount = 3;

      beforeEach(() => {
        const initialOwners: Account[] = [
          accounts.get("wallet_2")!,
          accounts.get("wallet_3")!,
          accounts.get("wallet_4")!,
        ];
        const setupTx = safe.setup(
          initialOwners,
          initialThreshold,
          ctx.deployer
        );
        chain.mineBlock([setupTx]);
      });

      it("fails when owners list is empty", () => {
        const owners: Account[] = [];
        const txSender = ctx.deployer;
        const removeOwnersTx = safe.removeOwners(owners, txSender);

        // act
        const receipt = chain.mineBlock([removeOwnersTx]).receipts[0];

        // assert
        receipt.result.expectErr().expectUint(SafeModel.Err.ERR_EMPTY_LIST);
      });

      it("fails when owners list contains address that is not safe owner", () => {
        const owners: Account[] = [accounts.get("wallet_1")!];
        const txSender = ctx.deployer;
        const removeOwnersTx = safe.removeOwners(owners, txSender);

        // act
        const receipt = chain.mineBlock([removeOwnersTx]).receipts[0];

        // assert
        receipt.result.expectErr().expectUint(SafeModel.Err.ERR_NOT_FOUND);
      });

      it("fails when owners list contains duplicates (trying to remove same address more than once)", () => {
        const owners: Account[] = [
          accounts.get("wallet_3")!,
          accounts.get("wallet_3")!,
        ];
        const txSender = ctx.deployer;
        const removeOwnersTx = safe.removeOwners(owners, txSender);

        // act
        const receipt = chain.mineBlock([removeOwnersTx]).receipts[0];

        // assert
        receipt.result.expectErr().expectUint(SafeModel.Err.ERR_NOT_FOUND);
      });

      it("fails when length of owners list is equal owners count (aka. abandoning safe)", () => {
        const owners: Account[] = [
          accounts.get("wallet_3")!,
          accounts.get("wallet_2")!,
          accounts.get("wallet_5")!,
        ];
        const txSender = ctx.deployer;
        const removeOwnersTx = safe.removeOwners(owners, txSender);

        // act
        const receipt = chain.mineBlock([removeOwnersTx]).receipts[0];

        // assert
        receipt.result.expectErr().expectUint(SafeModel.Err.ERR_CANT_ABANDON);
      });

      it("succeeds and removes owners, reduce owners count", () => {
        const owners: Account[] = [
          accounts.get("wallet_3")!,
          accounts.get("wallet_2")!,
        ];
        const txSender = ctx.deployer;
        const removeOwnersTx = safe.removeOwners(owners, txSender);

        // act
        const receipt = chain.mineBlock([removeOwnersTx]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        for (let owner of owners) {
          const result = safe.isOwner(owner);
          result.expectBool(false);
        }

        const ownersCount = safe.getOwnersCount();
        ownersCount.expectUint(initialOwnersCount - owners.length);
      });

      it("succeeds and removes owners, reduce owners count, reduce threshold if owners count dropped below current ones", () => {
        const owners: Account[] = [
          accounts.get("wallet_3")!,
          accounts.get("wallet_2")!,
        ];
        const txSender = ctx.deployer;
        const removeOwnersTx = safe.removeOwners(owners, txSender);

        // act
        const receipt = chain.mineBlock([removeOwnersTx]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        for (let owner of owners) {
          const result = safe.isOwner(owner);
          result.expectBool(false);
        }

        const ownersCount = safe.getOwnersCount();
        ownersCount.expectUint(initialOwnersCount - owners.length);

        const newThreshold = safe.getThreshold();
        newThreshold.expectUint(1);
      });
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

    describe("after setup", () => {
      const initialOwnersCount = 3;
      const initialThreshold = 2;

      beforeEach(() => {
        const initialOwners: Account[] = [
          accounts.get("wallet_2")!,
          accounts.get("wallet_3")!,
          accounts.get("wallet_5")!,
        ];
        const txSender = ctx.deployer;
        const setupTx = safe.setup(initialOwners, initialThreshold, txSender);
        chain.mineBlock([setupTx]);
      });

      it("fails when threshold is equal 0", () => {
        const threshold = 0;
        const txSender = ctx.deployer;
        const changeThresholdTx = safe.changeThreshold(threshold, txSender);

        // act
        const receipt = chain.mineBlock([changeThresholdTx]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(SafeModel.Err.ERR_INCORRECT_THRESHOLD);
      });

      it("fails when threshold is greater than owners count", () => {
        const threshold = initialOwnersCount + 1;
        const txSender = ctx.deployer;
        const changeThresholdTx = safe.changeThreshold(threshold, txSender);

        // act
        const receipt = chain.mineBlock([changeThresholdTx]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(SafeModel.Err.ERR_INCORRECT_THRESHOLD);
      });

      it("succeeds and changes threshold to lower value than previous one", () => {
        const threshold = initialThreshold - 1;
        const txSender = ctx.deployer;
        const changeThresholdTx = safe.changeThreshold(threshold, txSender);

        // act
        const receipt = chain.mineBlock([changeThresholdTx]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        safe.getThreshold().expectUint(threshold);
      });

      it("succeeds and changes threshold to higher value than previous one", () => {
        const threshold = initialThreshold + 1;
        const txSender = ctx.deployer;
        const changeThresholdTx = safe.changeThreshold(threshold, txSender);

        // act
        const receipt = chain.mineBlock([changeThresholdTx]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        safe.getThreshold().expectUint(threshold);
      });
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

    describe("after setup", () => {
      const initialThreshold = 1;

      beforeEach(() => {
        const owners: Account[] = [
          accounts.get("wallet_2")!,
          accounts.get("wallet_3")!,
        ];
        const setupTxSender = ctx.deployer;
        const setupTx = safe.setup(owners, initialThreshold, setupTxSender);
        chain.mineBlock([setupTx]);
      });

      it("fails when called by walled by wallet that is not one of the safe owners", () => {
        const txSender = accounts.get("wallet_5")!;
        const createTaskTx = safe.createTask(txSender);

        // act
        const receipt = chain.mineBlock([createTaskTx]).receipts[0];

        // assert
        receipt.result.expectErr().expectUint(SafeModel.Err.ERR_NOT_AUTHORIZED);
      });

      it("succeeds, creates new task with current threshold, 0 approvals and returns its id", () => {
        const txSender = accounts.get("wallet_2")!;
        const createTaskTx = safe.createTask(txSender);

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
        task.threshold.expectUint(initialThreshold);
        task.approvals.expectUint(0);
        task.executed.expectBool(false);
      });

      it("succeeds, creates new task with current threshold, 0 approvals and returns its id when threshold has been modified before task creation", () => {
        const newThreshold = 2;
        const txSender = accounts.get("wallet_3")!;
        const changeThresholdTx = safe.changeThreshold(newThreshold, txSender);
        const createTaskTx = safe.createTask(txSender);
        chain.mineBlock([changeThresholdTx]);

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
        task.executed.expectBool(false);
      });

      it("succeeds, creates new task and this task is not affected by threshold change", () => {
        const newThreshold = 2;
        const txSender = accounts.get("wallet_2")!;
        const createTaskTx = safe.createTask(txSender);
        const changeThresholdTx = safe.changeThreshold(newThreshold, txSender);

        // act
        const receipt = chain.mineBlock([createTaskTx, changeThresholdTx])
          .receipts[0];

        // assert
        const expectedTaskId = 1;
        receipt.result.expectOk().expectUint(expectedTaskId);

        safe.getLastTaskId().expectUint(expectedTaskId);

        const task = safe
          .getTask(expectedTaskId)
          .expectSome()
          .expectTuple() as Task;
        task.threshold.expectUint(initialThreshold);
        task.approvals.expectUint(0);
        task.executed.expectBool(false);
      });
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
      const receipt = chain.mineBlock([approveTaskTx1, approveTaskTx2])
        .receipts[0];

      // assert
      receipt.result.expectOk().expectBool(true);

      const task = safe.getTask(taskId).expectSome().expectTuple() as Task;
      task.approvals.expectUint(2);
    });

    it("fails to approve same task more than once", () => {
      const txSender = accounts.get("wallet_2")!;
      const taskId = 1;
      const approveTaskTx = safe.approveTask(taskId, txSender);
      chain.mineBlock([approveTaskTx]);

      // act
      const receipt = chain.mineBlock([approveTaskTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_ALREADY_APPROVED);

      const task = safe.getTask(taskId).expectSome().expectTuple() as Task;
      task.approvals.expectUint(1);
    });

    it("fails to approve task that has been already executed", () => {
      const taskId = 1;
      const txSender = accounts.get("wallet_2")!;
      const approveTaskTx1 = safe.approveTask(taskId, txSender);
      const approveTaskTx2 = safe.approveTask(
        taskId,
        accounts.get("wallet_3")!
      );
      const approveTaskTx3 = safe.approveTask(
        taskId,
        accounts.get("wallet_4")!
      );
      const approveTaskTx4 = safe.approveTask(
        taskId,
        accounts.get("wallet_5")!
      );
      const executeTaskTx = safe.executeTask(taskId, txSender);
      chain.mineBlock([
        approveTaskTx1,
        approveTaskTx2,
        approveTaskTx3,
        executeTaskTx,
      ]);

      // act
      const receipt = chain.mineBlock([approveTaskTx4]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_ALREADY_EXECUTED);
    });
  });

  describe("execute-task()", () => {
    beforeEach(() => {
      // setup safe and create task before each test
      const owners: Account[] = [
        accounts.get("wallet_2")!,
        accounts.get("wallet_3")!,
        accounts.get("wallet_4")!,
      ];
      const threshold = 1;
      const setupTxSender = ctx.deployer;
      const txSender = owners[0];
      const setupTx = safe.setup(owners, threshold, setupTxSender);
      const createTaskTx = safe.createTask(txSender);
      chain.mineBlock([setupTx, createTaskTx]);
    });

    it("fails while trying to execute unknown task", () => {
      const taskId = 2;
      const txSender = accounts.get("wallet_1")!;
      const executeTaskTx = safe.executeTask(taskId, txSender);

      // act
      const receipt = chain.mineBlock([executeTaskTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_UNKNOWN_TASK);
    });

    it("fails when called by wallet that is not safe owner", () => {
      const taskId = 1;
      const txSender = accounts.get("wallet_1")!;
      const executeTaskTx = safe.executeTask(taskId, txSender);

      // act
      const receipt = chain.mineBlock([executeTaskTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_NOT_AUTHORIZED);
    });

    it("fails when task has not been approved by enough owners", () => {
      const taskId = 1;
      const txSender = accounts.get("wallet_2")!;
      const executeTaskTx = safe.executeTask(taskId, txSender);

      // act
      const receipt = chain.mineBlock([executeTaskTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_NOT_APPROVED);
    });

    it("succeeds and marks task as executed", () => {
      const taskId = 1;
      const txSender = accounts.get("wallet_2")!;
      const approveTaskTx = safe.approveTask(taskId, txSender);
      const executeTaskTx = safe.executeTask(taskId, txSender);
      chain.mineBlock([approveTaskTx]);

      // act
      const receipt = chain.mineBlock([executeTaskTx]).receipts[0];

      // assert
      receipt.result.expectOk().expectBool(true);

      const task = safe.getTask(taskId).expectSome().expectTuple() as Task;
      task.executed.expectBool(true);
    });

    it("fails to execute task that has been already executed", () => {
      const taskId = 1;
      const txSender = accounts.get("wallet_2")!;
      const approveTaskTx = safe.approveTask(taskId, txSender);
      const executeTaskTx = safe.executeTask(taskId, txSender);
      chain.mineBlock([approveTaskTx, executeTaskTx]);

      // act
      const receipt = chain.mineBlock([executeTaskTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_ALREADY_EXECUTED);
    });
  });
});

run();
