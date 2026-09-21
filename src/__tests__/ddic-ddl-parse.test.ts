/**
 * V7 修复回归（2026-09-21）：parseDDICTableSource 数据元素形态 + 静默空护栏。
 * T000 fixture 取自真机 /sap/bc/adt/ddic/tables/T000/source/main 原文（截取）。
 * 内部函数经 getDDICTableInfo + 假 client 驱动。
 */
import { getDDICTableInfo, getDDICTableFields } from "../api/ddic"
import type { AdtHTTP } from "../AdtHTTP"

const T000_DDL = `@EndUserText.label : 'Clients'
@AbapCatalog.enhancementCategory : #NOT_EXTENSIBLE
@AbapCatalog.tableCategory : #TRANSPARENT
@AbapCatalog.deliveryClass : #C
@AbapCatalog.dataMaintenance : #ALLOWED
define table t000 {
  key mandt  : mandt not null;
  mtext      : mtext_d not null;
  ort01      : ort01 not null;
  @AbapCatalog.foreignKey.keyType : #KEY
  @AbapCatalog.foreignKey.screenCheck : true
  mwaer      : mwaer not null
    with foreign key [1..*,1] tcurc
      where mandt = t000.mandt
        and waers = t000.mwaer;
  adrnr      : char10 not null;
  cccategory : cccategory not null;
}`

const BIC_DDL = `@EndUserText.label : '客户表'
define table /bic/aztest01 {
  key recordmode : abap.char(1) not null;
  @EndUserText.label : '字段'
  zfld1 : abap.char(10) not null;
  zamt  : abap.dec(17,2);
}`

function fakeClient(ddl: string) {
  return {
    async request() {
      return { body: ddl, status: 200, statusText: "OK", headers: {} }
    }
  } as unknown as AdtHTTP
}

describe("parseDDICTableSource 数据元素形态（V7）", () => {
  test("T000：数据元素字段全部解析，key 标记正确，dataType 为元素名", async () => {
    const info = await getDDICTableInfo(fakeClient(T000_DDL), "T000")
    const names = info.fields!.map((f) => f.name)
    expect(names).toEqual(["MANDT", "MTEXT", "ORT01", "MWAER", "ADRNR", "CCCATEGORY"])
    expect(info.fields![0]).toMatchObject({ keyFlag: true, dataType: "mandt" })
    expect(info.fields![1]).toMatchObject({ keyFlag: false, dataType: "mtext_d" })
    // 外键 where 子句（t000.mandt / t000.mwaer）不得被当作字段
    expect(names).not.toContain("WHERE")
  })

  test("/BIC/ 原始类型形态不回归", async () => {
    const info = await getDDICTableInfo(fakeClient(BIC_DDL), "/BIC/AZTEST01")
    expect(info.fields).toHaveLength(3)
    expect(info.fields![0]).toMatchObject({ dataType: "abap.char", length: 1, keyFlag: true })
    expect(info.fields![1]).toMatchObject({ dataType: "abap.char", length: 10, shortText: "字段" })
    expect(info.fields![2]).toMatchObject({ dataType: "abap.dec", length: 17, decimals: 2 })
  })

  test("getDDICTableFields 同源复用", async () => {
    const f = await getDDICTableFields(fakeClient(T000_DDL), "T000")
    expect(f.length).toBeGreaterThanOrEqual(6)
  })

  test("护栏：define table 但 0 字段 → 显式报错（拒绝静默空）", async () => {
    const weird = "@EndUserText.label : 'X'\ndefine table zweird {\n  ??unrecognized??\n}"
    await expect(getDDICTableInfo(fakeClient(weird), "ZWEIRD")).rejects.toThrow(/parsed 0 fields/)
  })

  test("空 DDL 仍返回空字段（不误伤）", async () => {
    const info = await getDDICTableInfo(fakeClient(""), "ZEMPTY")
    expect(info.fields).toEqual([])
  })
})
