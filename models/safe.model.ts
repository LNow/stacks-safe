import { Account, Model, types } from "../deps.ts";

enum Err {
  ERR_NOT_AUTHORIZED = 5001,
  ERR_EMPTY_LIST = 5002,
  ERR_INCORRECT_THRESHOLD = 5003,
  ERR_DUPLICATE_OWNER = 5004,
  ERR_ALREADY_SETUP = 5005,
  ERR_NOT_SETUP = 5006,
  ERR_NOT_FOUND = 5007,
  ERR_CANT_ABANDON = 5008,
}

export class SafeModel extends Model {
  name = "safe";

  static Err = Err;

  getOwnersCount() {
    return this.callReadOnly("get-owners-count").result;
  }

  setup(
    owners: string[] | Account[],
    threshold: number | bigint,
    txSender: string | Account
  ) {
    let ownersList = this.convertToOwnersList(owners);

    return this.callPublic(
      "setup",
      [types.list(ownersList), types.uint(threshold)],
      txSender
    );
  }

  addOwners(owners: string[] | Account[], txSender: string | Account) {
    let ownersList = this.convertToOwnersList(owners);

    return this.callPublic("add-owners", [types.list(ownersList)], txSender);
  }

  removeOwners(owners: string[] | Account[], txSender: string | Account) {
    let ownersList = this.convertToOwnersList(owners);

    return this.callPublic("remove-owners", [types.list(ownersList)], txSender);
  }

  changeThreshold(threshold: number | bigint, txSender: string | Account) {
    return this.callPublic(
      "change-threshold",
      [types.uint(threshold)],
      txSender
    );
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

  isOwner(who: string | Account) {
    return this.callReadOnly("is-owner", [
      typeof who === "string"
        ? types.principal(who)
        : types.principal(who.address),
    ]).result;
  }

  getThreshold() {
    return this.callReadOnly("get-threshold").result;
  }
}
