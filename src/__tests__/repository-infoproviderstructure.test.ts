/**
 * getInfoproviderStructure 解析回归（2026-09-21 真机验证形态）。
 * fixture 取自真机响应结构（名称替换为合成值）：
 * atom:feed > atom:entry > atom:content > bwModel:object(@objectName/@objectType/
 * @objectSubtype/@objectStatus) + atom:id + atom:title。
 */
import { parseInfoproviderStructure } from "../api/repository"
import { describeLive, testLive } from "./helpers/liveSystem"

const FEED = `<?xml version="1.0" encoding="utf-8"?>
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:bwModel="http://www.sap.com/bw/modeling">
  <atom:title>Node Structure</atom:title>
  <atom:entry>
    <atom:content type="application/xml">
      <bwModel:object objectName="ZTESTCHA1" objectType="IOBJ" objectSubtype="CHA" objectStatus="active"/>
    </atom:content>
    <atom:id>/sap/bw/modeling/iobj/ztestcha1/m</atom:id>
    <atom:title>测试特征</atom:title>
  </atom:entry>
  <atom:entry>
    <atom:content type="application/xml">
      <bwModel:object objectName="ZTESTCHA2" objectType="IOBJ" objectSubtype="CHA"/>
    </atom:content>
    <atom:id>/sap/bw/modeling/iobj/ztestcha2/m</atom:id>
  </atom:entry>
</atom:feed>`

describeLive("parseInfoproviderStructure", () => {
  test("映射 object 属性 + id/title", () => {
    const entries = parseInfoproviderStructure(FEED)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      objectName: "ZTESTCHA1",
      objectType: "IOBJ",
      objectSubtype: "CHA",
      objectStatus: "active",
      uri: "/sap/bw/modeling/iobj/ztestcha1/m",
      title: "测试特征"
    })
    expect(entries[1].objectSubtype).toBe("CHA")
    expect(entries[1].title).toBeUndefined()
  })

  test("空 feed（无 entry）返回空数组", () => {
    const empty = `<?xml version="1.0"?>
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:title>Node Structure</atom:title></atom:feed>`
    expect(parseInfoproviderStructure(empty)).toEqual([])
  })
})
