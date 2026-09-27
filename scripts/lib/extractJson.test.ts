import { describe, expect, it } from "vitest";
import { extractJson, sliceFirstObject } from "./extractJson.mjs";

describe("从模型回复取 JSON", () => {
  it("纯 JSON 原样解析", () => {
    expect(extractJson('{"a":"1"}')).toEqual({ a: "1" });
  });

  it("JSON 后面追加说明：不能越界吃进说明里的括号", () => {
    // 这正是亚美尼亚语术语表连续两次失败的回复形状
    const text = '{"盐酸":"աղաթթու"}\n\nNote: I used the standard term (see {IUPAC}).';
    expect(extractJson(text)).toEqual({ 盐酸: "աղաթթու" });
  });

  it("跳过 ``` 代码围栏", () => {
    expect(extractJson('```json\n{"a":"1"}\n```')).toEqual({ a: "1" });
  });

  it("字符串里的括号不影响配对", () => {
    expect(extractJson('{"t":"a } b { c"} tail}')).toEqual({ t: "a } b { c" });
  });

  it("转义引号不会提前结束字符串", () => {
    expect(extractJson('{"t":"he said \\"}\\" ok"}')).toEqual({ t: 'he said "}" ok' });
  });

  it("嵌套对象完整取出", () => {
    expect(extractJson('{"a":{"b":{"c":1}}} x')).toEqual({ a: { b: { c: 1 } } });
  });

  it("容忍尾随逗号", () => {
    expect(extractJson('{"a":1,"b":[1,2,],}')).toEqual({ a: 1, b: [1, 2] });
  });

  it("没有 JSON 时明确报错，而不是返回空对象被当成译完了", () => {
    expect(() => sliceFirstObject("抱歉，我无法完成")).toThrow("没有 JSON");
  });

  it("回复被截断时明确报错", () => {
    expect(() => sliceFirstObject('{"a":"1","b":"2')).toThrow("不完整");
  });
});

describe("德语引号", () => {
  it("„…\" 的收尾直引号未转义时仍能正确取出（17 个欧洲语种曾因此同时失败）", () => {
    const text = '```json\n{"a":"Tippen Sie auf „entnehmen mL" zum Hinzufügen","b":"Seite {page}"}\n```';
    expect(extractJson(text)).toEqual({
      a: 'Tippen Sie auf „entnehmen mL" zum Hinzufügen',
      b: "Seite {page}",
    });
  });
});
