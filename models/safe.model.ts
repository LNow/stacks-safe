import { Account, Model, types } from "../deps.ts";

enum Err {
  ERR_NOT_AUTHORIZED = 5001,
  ERR_EMPTY_LIST = 5002,
  ERR_INCORRECT_THRESHOLD = 5003,
  ERR_DUPLICATE_OWNER = 5004,
  ERR_ALREADY_SETUP = 5005
}

export class SafeModel extends Model {
  name = "safe";

  static Err = Err;

  getOwnersCount() {
    return this.callReadOnly("get-owners-count").result;
  }

  setup(
    owners: string | Account[],
    threshold: number | bigint,
    txSender: string | Account
  ) {
    let ownersList = [];
    for (let owner of owners) {
      ownersList.push(
        typeof owner === "string"
          ? types.principal(owner)
          : types.principal(owner.address)
      );
    }

    return this.callPublic(
      "setup",
      [types.list(ownersList), types.uint(threshold)],
      txSender
    );
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
