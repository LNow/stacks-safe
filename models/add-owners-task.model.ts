import { Account, Model, types } from "../deps.ts";

enum Err {
  ERR_EMPTY_LIST = 61001,
}

export class AddOwnersTaskModel extends Model {
  name = "add-owners-task";

  static Err = Err;

  getArgs(taskId: number | bigint) {
    return this.callReadOnly("get-args", [types.uint(taskId)]).result;
  }

  create(owners: string[] | Account[], txSender: string | Account) {
    let ownersList = this.convertToOwnersList(owners);

    return this.callPublic("create", [types.list(ownersList)], txSender);
  }

  execute(taskId: number | bigint, txSender: string | Account) {
    return this.callPublic("execute", [types.uint(taskId)]);
  }

  private convertToOwnersList(owners: Account[] | string[]) {
    let ownersList = [];
    for (let owner of owners) {
      ownersList.push(
        typeof owner === "string"
          ? types.principal(owner)
          : types.principal(owner.address)
      );
    }
    return ownersList;
  }
}
