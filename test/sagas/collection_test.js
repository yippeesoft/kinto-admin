import { expect } from "chai";
import { push as updatePath } from "react-router-redux";
import { put, call } from "redux-saga/effects";

import { notifyError, notifySuccess } from "../../scripts/actions/notifications";
import * as collectionActions from "../../scripts/actions/collection";
import * as recordActions from "../../scripts/actions/record";
import * as saga from "../../scripts/sagas/collection";
import { setClient } from "../../scripts/client";


const record = {id: 1, foo: "bar1"};
const record2 = {id: 2, foo: "bar2"};
const records = [
  record,
  record2,
];
const recordsWithAttachment = [
  {...record, __attachment__: "fake-attachment"},
  record2,
];

describe("collection sagas", () => {
  describe("listRecords()", () => {
    describe("Success", () => {
      let collection;

      before(() => {
        collection = {listRecords() {}};
        const bucket = {collection() {return collection;}};
        setClient({bucket() {return bucket;}});
      });

      describe("Default sort", () => {
        let listRecords;

        before(() => {
          const action = collectionActions.listRecords("bucket", "collection");
          const getState = () => ({collection: {sort: "title"}});
          listRecords = saga.listRecords(getState, action);
        });

        it("should list collection records", () => {
          expect(listRecords.next().value)
            .eql(call([collection, collection.listRecords], {sort: "title", limit: 200}));
        });

        it("should dispatch the listRecordsSuccess action", () => {
          expect(listRecords.next({data: records}).value)
            .eql(put(collectionActions.listRecordsSuccess(records)));
        });
      });

      describe("Custom sort", () => {
        let listRecords;

        before(() => {
          const action = collectionActions.listRecords("bucket", "collection", "title");
          const getState = () => ({collection: {sort: "nope"}});
          listRecords = saga.listRecords(getState, action);
        });

        it("should list collection records", () => {
          expect(listRecords.next().value)
            .eql(call([collection, collection.listRecords], {sort: "title", limit: 200}));
        });

        it("should dispatch the listRecordsSuccess action", () => {
          expect(listRecords.next({data: records}).value)
            .eql(put(collectionActions.listRecordsSuccess(records)));
        });
      });
    });

    describe("Failure", () => {
      let listRecords, collection;

      before(() => {
        collection = {listRecords() {}};
        const bucket = {collection() {return collection;}};
        setClient({bucket() {return bucket;}});
        const getState = () => ({collection: {}});
        const action = collectionActions.listRecords("bucket", "collection");
        listRecords = saga.listRecords(getState, action);
        listRecords.next();
      });

      it("should dispatch an error notification action", () => {
        expect(listRecords.throw("error").value)
          .eql(put(notifyError("error")));
      });
    });
  });

  describe("listNextRecords()", () => {
    describe("Success", () => {
      let listNextRecords, collection;

      before(() => {
        const action = collectionActions.listNextRecords();
        collection = {listNextRecords() {}};
        const getState = () => ({collection});
        listNextRecords = saga.listNextRecords(getState, action);
      });

      it("should list collection records", () => {
        expect(listNextRecords.next().value)
          .eql(call(collection.listNextRecords));
      });

      it("should dispatch the listNextRecordsSuccess action", () => {
        const fakeNext = () => {};
        const result = {data: records, hasNextPage: false, next: fakeNext};
        expect(listNextRecords.next(result).value)
          .eql(put(collectionActions.listRecordsSuccess(records, false, fakeNext)));
      });

      it("should scroll to page bottom", () => {
        window.document.body.scrollHeight = 42;
        expect(listNextRecords.next().value)
          .eql(call([window, window.scrollTo], 0, 42));
      });
    });

    describe("Failure", () => {
      let listNextRecords, collection;

      before(() => {
        const action = collectionActions.listNextRecords();
        collection = {listNextRecords() {}};
        const getState = () => ({collection});
        listNextRecords = saga.listNextRecords(getState, action);
        listNextRecords.next();
      });

      it("should dispatch an error notification action", () => {
        expect(listNextRecords.throw("error").value)
          .eql(put(notifyError("error")));
      });
    });
  });

  describe("createRecord()", () => {
    let collection;

    before(() => {
      collection = {
        createRecord() {},
        addAttachment() {},
      };
      const bucket = {collection() {return collection;}};
      setClient({bucket() {return bucket;}});
    });

    describe("Attachments disabled", () => {
      let createRecord;

      before(() => {
        const getState = () => ({
          session: {
            serverInfo: {
              capabilities: {}
            }
          }
        });
        const action = collectionActions.createRecord("bucket", "collection", record);
        createRecord = saga.createRecord(getState, action);
      });

      it("should mark the current collection as busy", () => {
        expect(createRecord.next().value)
          .eql(put(collectionActions.collectionBusy(true)));
      });

      it("should create the record", () => {
        expect(createRecord.next().value)
          .eql(call([collection, collection.createRecord], record));
      });

      it("should update the route path", () => {
        expect(createRecord.next().value)
          .eql(put(updatePath("/buckets/bucket/collections/collection")));
      });

      it("should dispatch a notification", () => {
        expect(createRecord.next().value)
          .eql(put(notifySuccess("Record added.")));
      });

      it("should unmark the current collection as busy", () => {
        expect(createRecord.next().value)
          .eql(put(collectionActions.collectionBusy(false)));
      });
    });

    describe("Attachments enabled", () => {
      let createRecord;

      const attachment = "data:test/fake";

      before(() => {
        const getState = () => ({
          session: {
            serverInfo: {
              capabilities: {attachments: {}}
            }
          }
        });
        const action = collectionActions.createRecord(
          "bucket", "collection", record, attachment);
        createRecord = saga.createRecord(getState, action);
      });

      it("should mark the current collection as busy", () => {
        expect(createRecord.next().value)
          .eql(put(collectionActions.collectionBusy(true)));
      });

      it("should post the attachment", () => {
        expect(createRecord.next().value)
          .eql(call([collection, collection.addAttachment], attachment, record));
      });

      it("should update the route path", () => {
        expect(createRecord.next().value)
          .eql(put(updatePath("/buckets/bucket/collections/collection")));
      });

      it("should dispatch a notification", () => {
        expect(createRecord.next().value)
          .eql(put(notifySuccess("Record added.")));
      });

      it("should unmark the current collection as busy", () => {
        expect(createRecord.next().value)
          .eql(put(collectionActions.collectionBusy(false)));
      });
    });

    describe("Failure", () => {
      let createRecord;

      before(() => {
        const getState = () => ({session: {serverInfo: {capabilities: {}}}});
        const action = collectionActions.createRecord("bucket", "collection", record);
        createRecord = saga.createRecord(getState, action);
        createRecord.next();
      });

      it("should dispatch an error notification action", () => {
        expect(createRecord.throw("error").value)
          .eql(put(notifyError("error")));
      });

      it("should unmark the current collection as busy", () => {
        expect(createRecord.next().value)
          .eql(put(collectionActions.collectionBusy(false)));
      });
    });
  });

  describe("updateRecord()", () => {
    describe("Attachment disabled", () => {
      // Expose no attachment capability in server info state
      const getState = () => {
        return {
          session: {
            serverInfo: {
              capabilities: {}
            }
          }
        };
      };

      const action = collectionActions.updateRecord("bucket", "collection", 1, record);

      describe("Success", () => {
        let collection, updateRecord;

        before(() => {
          collection = {updateRecord() {}};
          const bucket = {collection() {return collection;}};
          setClient({bucket() {return bucket;}});
          updateRecord = saga.updateRecord(getState, action);
        });

        it("should mark the current collection as busy", () => {
          expect(updateRecord.next().value)
            .eql(put(collectionActions.collectionBusy(true)));
        });

        it("should update the record", () => {
          expect(updateRecord.next().value)
            .eql(call([collection, collection.updateRecord], record, {patch: true}));
        });

        it("should dispatch the resetRecord action", () => {
          expect(updateRecord.next({data: record}).value)
            .eql(put(recordActions.resetRecord()));
        });

        it("should update the route path", () => {
          expect(updateRecord.next().value)
            .eql(put(updatePath("/buckets/bucket/collections/collection")));
        });

        it("should dispatch a notification", () => {
          expect(updateRecord.next().value)
            .eql(put(notifySuccess("Record updated.")));
        });

        it("should unmark the current collection as busy", () => {
          expect(updateRecord.next().value)
            .eql(put(collectionActions.collectionBusy(false)));
        });
      });

      describe("Failure", () => {
        let updateRecord;

        before(() => {
          updateRecord = saga.updateRecord(getState, action);
          updateRecord.next();
        });

        it("should dispatch an error notification action", () => {
          expect(updateRecord.throw("error").value)
            .eql(put(notifyError("error")));
        });

        it("should unmark the current collection as busy", () => {
          expect(updateRecord.next().value)
            .eql(put(collectionActions.collectionBusy(false)));
        });
      });
    });

    describe("Attachment enabled", () => {
      // Expose the attachment capability in server info state
      const getState = () => {
        return {
          session: {
            serverInfo: {
              capabilities: {
                attachments: {}
              }
            }
          }
        };
      };

      const attachment = "data:test/fake";

      const action = collectionActions.updateRecord(
        "bucket", "collection", 1, record, attachment);

      describe("Success", () => {
        let collection, updateRecord;

        before(() => {
          collection = {
            updateRecord() {},
            addAttachment() {},
          };
          const bucket = {collection() {return collection;}};
          setClient({bucket() {return bucket;}});
          updateRecord = saga.updateRecord(getState, action);
        });

        it("should mark the current collection as busy", () => {
          expect(updateRecord.next().value)
            .eql(put(collectionActions.collectionBusy(true)));
        });

        it("should update the record with its attachment", () => {
          expect(updateRecord.next().value)
            .eql(call([collection, collection.addAttachment], attachment, record));
        });

        it("should dispatch the resetRecord action", () => {
          expect(updateRecord.next({data: record}).value)
            .eql(put(recordActions.resetRecord()));
        });

        it("should update the route path", () => {
          expect(updateRecord.next().value)
            .eql(put(updatePath("/buckets/bucket/collections/collection")));
        });

        it("should dispatch a notification", () => {
          expect(updateRecord.next().value)
            .eql(put(notifySuccess("Record updated.")));
        });

        it("should unmark the current collection as busy", () => {
          expect(updateRecord.next().value)
            .eql(put(collectionActions.collectionBusy(false)));
        });
      });

      describe("Failure", () => {
        let updateRecord;

        before(() => {
          updateRecord = saga.updateRecord(getState, action);
          updateRecord.next();
        });

        it("should dispatch an error notification action", () => {
          expect(updateRecord.throw("error").value)
            .eql(put(notifyError("error")));
        });

        it("should unmark the current collection as busy", () => {
          expect(updateRecord.next().value)
            .eql(put(collectionActions.collectionBusy(false)));
        });
      });
    });
  });

  describe("deleteRecord()", () => {
    describe("Success", () => {
      let collection, deleteRecord;

      before(() => {
        collection = {deleteRecord() {}};
        const bucket = {collection() {return collection;}};
        setClient({bucket() {return bucket;}});
        const action = collectionActions.deleteRecord("bucket", "collection", 1);
        deleteRecord = saga.deleteRecord(() => {}, action);
      });

      it("should mark the current collection as busy", () => {
        expect(deleteRecord.next().value)
          .eql(put(collectionActions.collectionBusy(true)));
      });

      it("should create the record", () => {
        expect(deleteRecord.next().value)
          .eql(call([collection, collection.deleteRecord], 1));
      });

      it("should update the route path", () => {
        expect(deleteRecord.next().value)
          .eql(put(updatePath("/buckets/bucket/collections/collection")));
      });

      it("should dispatch a notification", () => {
        expect(deleteRecord.next().value)
          .eql(put(notifySuccess("Record deleted.")));
      });

      it("should unmark the current collection as busy", () => {
        expect(deleteRecord.next().value)
          .eql(put(collectionActions.collectionBusy(false)));
      });
    });

    describe("Failure", () => {
      let deleteRecord;

      before(() => {
        deleteRecord = saga.deleteRecord("bucket", "collection", 1);
        deleteRecord.next();
      });

      it("should dispatch an error notification action", () => {
        expect(deleteRecord.throw("error").value)
          .eql(put(notifyError("error")));
      });

      it("should unmark the current collection as busy", () => {
        expect(deleteRecord.next().value)
          .eql(put(collectionActions.collectionBusy(false)));
      });
    });
  });

  describe("deleteAttachment()", () => {
    let collection, deleteAttachment;

    before(() => {
      collection = {removeAttachment() {}};
      const bucket = {collection() {return collection;}};
      setClient({bucket() {return bucket;}});
      const action = collectionActions.deleteAttachment("bucket", "collection", "record");
      deleteAttachment = saga.deleteAttachment(() => {}, action);
    });

    it("should mark the current collection as busy", () => {
      expect(deleteAttachment.next().value)
        .eql(put(collectionActions.collectionBusy(true)));
    });

    it("should send a request for deleting the record attachment", () => {
      expect(deleteAttachment.next().value)
        .eql(call([collection, collection.removeAttachment], "record"));
    });

    it("should update the route path", () => {
      expect(deleteAttachment.next().value)
        .eql(put(updatePath("/buckets/bucket/collections/collection/edit/record")));
    });

    it("should dispatch a notification", () => {
      expect(deleteAttachment.next().value)
        .eql(put(notifySuccess("Attachment deleted.")));
    });
  });

  describe("bulkCreateRecords()", () => {
    let collection;

    before(() => {
      collection = {
        batch() {},
        addAttachment() {},
        createRecord() {},
      };
      const bucket = {collection() {return collection;}};
      setClient({bucket() {return bucket;}});
    });

    describe("Attachments disabled", () => {
      let bulkCreateRecords;

      before(() => {
        const getState = () => ({
          session: {
            serverInfo: {
              capabilities: {}
            }
          }
        });
        const action = collectionActions.bulkCreateRecords("bucket", "collection", records);
        bulkCreateRecords = saga.bulkCreateRecords(getState, action);
      });

      it("should mark the current collection as busy", () => {
        expect(bulkCreateRecords.next().value)
          .eql(put(collectionActions.collectionBusy(true)));
      });

      it("should batch create records", () => {
        const v = bulkCreateRecords.next().value;

        // We can't simply test for the passed batch function, so we're testing
        // the provided argument type here.
        expect(v.CALL.args[0]).to.be.a("function");
        expect(v.CALL.args[1]).eql({aggregate: true});
      });

      it("should update the route path", () => {
        expect(bulkCreateRecords.next({published: records, errors: []}).value)
          .eql(put(updatePath("/buckets/bucket/collections/collection")));
      });

      it("should dispatch a notification", () => {
        expect(bulkCreateRecords.next().value)
          .eql(put(notifySuccess("2 records created.")));
      });

      it("should unmark the current collection as busy", () => {
        expect(bulkCreateRecords.next().value)
          .eql(put(collectionActions.collectionBusy(false)));
      });
    });

    describe("Attachments enabled", () => {
      let bulkCreateRecords;

      before(() => {
        const getState = () => ({
          session: {
            serverInfo: {
              capabilities: {attachments: {}}
            }
          }
        });
        const action = collectionActions.bulkCreateRecords(
          "bucket", "collection", recordsWithAttachment);
        bulkCreateRecords = saga.bulkCreateRecords(getState, action);
      });

      it("should mark the current collection as busy", () => {
        expect(bulkCreateRecords.next().value)
          .eql(put(collectionActions.collectionBusy(true)));
      });

      it("should send the first attachment", () => {
        expect(bulkCreateRecords.next().value)
          .eql(call([collection, collection.addAttachment],
                    recordsWithAttachment[0].__attachment__,
                    record));
      });

      it("should send the second record with no attachment", () => {
        expect(bulkCreateRecords.next().value)
          .eql(call([collection, collection.createRecord],
                    record2));
      });

      it("should update the route path", () => {
        expect(bulkCreateRecords.next({
          published: recordsWithAttachment,
          errors: [],
        }).value)
          .eql(put(updatePath("/buckets/bucket/collections/collection")));
      });

      it("should dispatch a notification", () => {
        expect(bulkCreateRecords.next().value)
          .eql(put(notifySuccess("2 records created.")));
      });

      it("should unmark the current collection as busy", () => {
        expect(bulkCreateRecords.next().value)
          .eql(put(collectionActions.collectionBusy(false)));
      });
    });

    describe("Failure", () => {
      let bulkCreateRecords;

      before(() => {
        const getState = () => ({
          session: {
            serverInfo: {
              capabilities: {}
            }
          }
        });
        const action = collectionActions.bulkCreateRecords(
          "bucket", "collection", records);
        bulkCreateRecords = saga.bulkCreateRecords(getState, action);
        bulkCreateRecords.next();
      });

      it("should dispatch an error notification action", () => {
        expect(bulkCreateRecords.throw("error").value)
          .eql(put(notifyError("error")));
      });

      it("should unmark the current collection as busy", () => {
        expect(bulkCreateRecords.next().value)
          .eql(put(collectionActions.collectionBusy(false)));
      });
    });
  });
});
