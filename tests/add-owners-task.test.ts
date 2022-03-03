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
  assertEquals,
} from "../deps.ts";
import { SafeModel, Task } from "../models/safe.model.ts";
import { AddOwnersTaskModel } from "../models/add-owners-task.model.ts";

let ctx: Context;
let safe: SafeModel;
let addOwnersTask: AddOwnersTaskModel;
let chain: Chain;
let accounts: Accounts;

beforeEach(() => {
  ctx = new Context();
  safe = ctx.models.get(SafeModel);
  addOwnersTask = ctx.models.get(AddOwnersTaskModel);
  chain = ctx.chain;
  accounts = ctx.accounts;

  chain.mineEmptyBlock(200);
});

describe("[ADD OWNERS_TASK]", () => {
  describe("create()", () => {
    it("fails when owners list is empty", () => {
      const txSender = ctx.deployer;
      const initialOwners = [txSender];
      const threshold = 1;
      const owners: Account[] = [];
      const setupTx = safe.setup(initialOwners, threshold, txSender);
      const createAddOwnersTaskTx = addOwnersTask.create(owners, txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([createAddOwnersTaskTx]).receipts[0];

      // assert
      receipt.result
        .expectErr()
        .expectUint(AddOwnersTaskModel.Err.ERR_EMPTY_LIST);
    });

    it("succeeds, creates task and saves owners list", () => {
      const txSender = ctx.deployer;
      const initialOwners = [txSender];
      const threshold = 1;
      const owners: Account[] = [
        accounts.get("wallet_3")!,
        accounts.get("wallet_5")!,
      ];
      const setupTx = safe.setup(initialOwners, threshold, txSender);
      const createAddOwnersTaskTx = addOwnersTask.create(owners, txSender);
      chain.mineBlock([setupTx]);

      // act
      const receipt = chain.mineBlock([createAddOwnersTaskTx]).receipts[0];

      // assert
      receipt.result.expectOk().expectUint(1);
      const savedOwners = addOwnersTask.getArgs(1).expectSome().expectList();

      for (let owner of owners) {
        assertEquals(savedOwners.includes(owner.address), true);
      }

      safe.getLastTaskId().expectUint(1);
    });
  });

  describe("execute()", () => {
    it("fails when task is unknown", () => {
      const taskId = 10;
      const txSender = accounts.get("wallet_5")!;
      const executeAddOwnersTaskTx = addOwnersTask.execute(taskId, txSender);

      // act
      const receipt = chain.mineBlock([executeAddOwnersTaskTx]).receipts[0];

      // assert
      receipt.result.expectErr().expectUint(SafeModel.Err.ERR_UNKNOWN_TASK);
    });

    it("succeeds when task is approved and mark task as executed", () => {
      const txSender = ctx.deployer;
      const initialOwners = [txSender];
      const threshold = 1;
      const owners: Account[] = [
        accounts.get("wallet_3")!,
        accounts.get("wallet_5")!,
      ];
      const taskId = 1;
      const setupTx = safe.setup(initialOwners, threshold, txSender);
      const createAddOwnersTaskTx = addOwnersTask.create(owners, txSender);
      const approveTaskTx = safe.approveTask(taskId, txSender);
      const executeAddOwnersTaskTx = addOwnersTask.execute(taskId, txSender);
      chain.mineBlock([setupTx, createAddOwnersTaskTx, approveTaskTx]);

      // act
      const receipt = chain.mineBlock([executeAddOwnersTaskTx]).receipts[0];

      // assert
      receipt.result.expectOk().expectBool(true)

      for (let owner of owners) {
        const result = safe.isOwner(owner);
        result.expectBool(true);
      }

      const task = safe.getTask(taskId).expectSome().expectTuple() as Task;
      task.executed.expectBool(true);
    })
  });
});

run();
