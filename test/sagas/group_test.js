import { expect } from "chai";
import { put, call } from "redux-saga/effects";

import { notifyError } from "../../scripts/actions/notifications";
import * as actions from "../../scripts/actions/group";
import * as saga from "../../scripts/sagas/group";
import { setClient } from "../../scripts/client";


describe("group sagas", () => {
  describe("listHistory()", () => {
    describe("Success", () => {
      let client, listHistory;

      before(() => {
        client = {listHistory() {}};
        setClient({bucket(){ return client; }});
        const action = actions.listGroupHistory("bucket", "group");
        listHistory = saga.listHistory(() => {}, action);
      });

      it("should fetch history on group", () => {
        expect(listHistory.next().value)
          .eql(call([client, client.listHistory], {
            filters: {
              group_id: "group",
            }
          }));
      });

      it("should dispatch the listGroupHistorySuccess action", () => {
        const history = [];
        const result = {data: history};
        expect(listHistory.next(result).value)
          .eql(put(actions.listGroupHistorySuccess(history)));
      });

    });

    describe("Failure", () => {
      let listHistory;

      before(() => {
        const action = actions.listGroupHistory("bucket", "group");
        listHistory = saga.listHistory(() => {}, action);
        listHistory.next();
      });

      it("should dispatch an error notification action", () => {
        expect(listHistory.throw("error").value)
          .eql(put(notifyError("error", {clear: true})));
      });
    });
  });
});
