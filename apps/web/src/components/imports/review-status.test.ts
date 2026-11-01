import { expect,it } from "vitest";
import type {ImportRow,Snapshot} from "@finance/shared";
import {reviewStatus} from "./review-status";
const data={accounts:[{id:"bank",openingDate:"2026-01-01"},{id:"savings",openingDate:"2026-02-01"}]} as Snapshot;
const row={rowNumber:1,date:"2026-10-01",include:true,error:null,kind:"expense",categoryId:"food"} as ImportRow;
it("distinguishes optional category review from excluded rows and accepted reconciliations",()=>{
  expect(reviewStatus(row,data,"bank")).toBe("ready");
  expect(reviewStatus({...row,categoryId:null},data,"bank")).toBe("attention");
  expect(reviewStatus({...row,include:false},data,"bank")).toBe("excluded");
  expect(reviewStatus({...row,include:false,error:"Missing year"},data,"bank")).toBe("attention");
  expect(reviewStatus({...row,reconcileExisting:{id:"x"}} as unknown as ImportRow,data,"bank")).toBe("reconciled");
});
it("keeps conflicts and incomplete transfer destinations in needs attention",()=>{
  expect(reviewStatus(row,data,"bank",[1])).toBe("attention");
  expect(reviewStatus({...row,kind:"transfer",categoryId:null,counterAccountId:null},data,"bank")).toBe("attention");
  expect(reviewStatus({...row,kind:"transfer",categoryId:null,counterAccountId:"savings"},data,"bank")).toBe("ready");
  expect(reviewStatus({...row,kind:"transfer",counterAccountId:"savings",date:"2026-01-01"},data,"bank")).toBe("attention");
});
