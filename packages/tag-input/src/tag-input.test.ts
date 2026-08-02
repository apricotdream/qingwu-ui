import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { TagInput } from "./tag-input";

function makeContainer(): HTMLElement {
  const div = document.createElement("div");
  document.body.append(div);
  return div;
}

function queryInsert(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>(".qti-tag-insert"));
}

function queryRemove(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>(".qti-tag-remove"));
}

function inputEl(root: HTMLElement): HTMLInputElement {
  return root.querySelector<HTMLInputElement>(".qti-input")!;
}

describe("TagInput", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = makeContainer();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("构造后渲染输入框与标签按钮", () => {
    const ti = new TagInput(root, { defaultTags: ["React", "Vue"] });
    expect(inputEl(root)).toBeTruthy();
    const btns = queryInsert(root);
    expect(btns.length).toBe(2);
    expect(btns[0]!.textContent).toBe("React");
    expect(btns[1]!.textContent).toBe("Vue");
    ti.destroy();
  });

  test("点击标签自动填入输入框，默认逗号分隔", () => {
    const ti = new TagInput(root, { defaultTags: ["React", "Vue"] });
    queryInsert(root)[0]!.click();
    expect(ti.value).toBe("React");
    queryInsert(root)[0]!.click();
    expect(ti.value).toBe("React, Vue");
    ti.destroy();
  });

  test("已插入的标签从快捷栏消失，输入框删除后重现", () => {
    const ti = new TagInput(root, { defaultTags: ["React", "Vue"] });
    queryInsert(root)[0]!.click();
    expect(ti.value).toBe("React");
    expect(queryInsert(root).length).toBe(1);
    expect(queryInsert(root)[0]!.textContent).toBe("Vue");

    /* 从输入框删除 "React" → 按钮重现 */
    inputEl(root).value = "TypeScript, ";
    inputEl(root).dispatchEvent(new Event("input"));
    expect(queryInsert(root).length).toBe(2);
    expect(queryInsert(root)[0]!.textContent).toBe("React");
    ti.destroy();
  });

  test("手动输入已有标签同样触发显隐同步", () => {
    const ti = new TagInput(root, { defaultTags: ["React", "Vue"] });
    inputEl(root).value = "React, ";
    inputEl(root).dispatchEvent(new Event("input"));
    expect(queryInsert(root).length).toBe(1);
    expect(queryInsert(root)[0]!.textContent).toBe("Vue");
    ti.destroy();
  });

  test("受控模式点击标签仅回调不改内部值，update 同步", () => {
    let v = "";
    const ti = new TagInput(root, {
      value: "",
      tags: ["React"],
      onChange: (nv) => (v = nv),
    });
    queryInsert(root)[0]!.click();
    expect(v).toBe("React");
    expect(ti.value).toBe("");

    /* 外部同步后标签消失 */
    ti.update({ value: "React" });
    expect(queryInsert(root).length).toBe(0);
    ti.destroy();
  });

  test("× 移除按钮删除快捷标签并回调 onTagsChange", () => {
    let tags: string[] = [];
    const ti = new TagInput(root, {
      defaultTags: ["A", "B"],
      onTagsChange: (t) => (tags = t),
    });
    expect(queryRemove(root).length).toBe(2);
    queryRemove(root)[0]!.click();
    expect(tags).toEqual(["B"]);
    expect(queryInsert(root).length).toBe(1);
    expect(queryInsert(root)[0]!.textContent).toBe("B");
    ti.destroy();
  });

  test("removable: false 不渲染 × 按钮", () => {
    const ti = new TagInput(root, { defaultTags: ["A"], removable: false });
    expect(queryRemove(root).length).toBe(0);
    ti.destroy();
  });

  test("maxRows 折叠：超出显示 +N 更多，点击展开全部", () => {
    const many = Array.from({ length: 20 }, (_, i) => `Tag${i}`);
    const ti = new TagInput(root, { defaultTags: many, maxRows: 1 });
    const more = root.querySelector<HTMLButtonElement>(".qti-more");
    expect(more).toBeTruthy();
    expect(more!.textContent).toMatch(/\+/);

    more!.click();
    expect(queryInsert(root).length).toBe(20);
    ti.destroy();
  });

  test("maxRows: 0 不折叠", () => {
    const many = Array.from({ length: 20 }, (_, i) => `Tag${i}`);
    const ti = new TagInput(root, { defaultTags: many, maxRows: 0 });
    expect(root.querySelector(".qti-more")).toBeNull();
    expect(queryInsert(root).length).toBe(20);
    ti.destroy();
  });

  test("formatInsert / parseTags 自定义格式", () => {
    const ti = new TagInput(root, {
      defaultTags: ["React"],
      formatInsert: (t) => `#${t}`,
      parseTags: (v) => v.split(",").map((s) => s.trim().replace(/^#/, "")),
    });
    queryInsert(root)[0]!.click();
    expect(ti.value).toBe("#React");

    /* 输入 #React → 按钮消失 */
    inputEl(root).value = "#React";
    inputEl(root).dispatchEvent(new Event("input"));
    expect(queryInsert(root).length).toBe(0);
    ti.destroy();
  });

  test("allowEnterCreate: 回车将输入文本创建为新标签并清空输入", () => {
    const ti = new TagInput(root, { defaultTags: ["React"], allowEnterCreate: true });
    const input = inputEl(root);
    input.value = "Vue";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(ti.tags).toEqual(["React", "Vue"]);
    expect(ti.value).toBe("");
    expect(queryInsert(root).length).toBe(2);
    ti.destroy();
  });

  test("allowEnterCreate: 真实输入流（input 事件同步后）回车创建", () => {
    const ti = new TagInput(root, { defaultTags: ["React"], allowEnterCreate: true });
    const input = inputEl(root);
    input.value = "Vue";
    input.dispatchEvent(new Event("input")); // 同步 valueState（真实打字路径）
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(ti.tags).toEqual(["React", "Vue"]);
    expect(ti.value).toBe("");
    ti.destroy();
  });

  test("allowEnterCreate: 已存在的标签回车后忽略创建", () => {
    const ti = new TagInput(root, { defaultTags: ["React"], allowEnterCreate: true });
    const input = inputEl(root);
    input.value = "React";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(ti.tags).toEqual(["React"]);
    expect(ti.value).toBe("");
    ti.destroy();
  });

  test("allowEnterCreate: false 时回车不创建", () => {
    const ti = new TagInput(root, { defaultTags: ["React"] });
    const input = inputEl(root);
    input.value = "Vue";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(ti.tags).toEqual(["React"]);
    ti.destroy();
  });

  test("createTag 程序化创建标签", () => {
    const ti = new TagInput(root, { defaultTags: ["React"] });
    ti.createTag("Vue");
    expect(ti.tags).toEqual(["React", "Vue"]);
    ti.createTag("  React  "); // 已存在 → 忽略
    expect(ti.tags).toEqual(["React", "Vue"]);
    ti.destroy();
  });

  test("inline 模式：已选标签以 chip 渲染在输入框内，× 删除从输入值移除", () => {
    const ti = new TagInput(root, {
      defaultTags: ["React", "Vue"],
      defaultValue: "React, Vue",
      inline: true,
    });
    /* 输入框内渲染 2 个已选 chip */
    const wrap = root.querySelector<HTMLDivElement>(".qti-input-wrap")!;
    expect(wrap.querySelectorAll(".qti-tag").length).toBe(2);
    /* 点击 × 删除 "React" */
    const remove = wrap.querySelector<HTMLButtonElement>(".qti-tag-remove")!;
    remove.click();
    expect(ti.value).toBe("Vue");
    expect(wrap.querySelectorAll(".qti-tag").length).toBe(1);
    ti.destroy();
  });

  test("inline 模式：Enter 将输入文本加入已选标签（无需 allowEnterCreate，重复忽略）", () => {
    const ti = new TagInput(root, { defaultTags: ["React"], inline: true });
    const input = inputEl(root);
    input.value = "Vue";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(ti.value).toBe("Vue");
    /* 再按 Enter：输入已清空 → 无操作 */
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(ti.value).toBe("Vue");
    /* 重复标签被忽略 */
    input.value = "Vue";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(ti.value).toBe("Vue");
    ti.destroy();
  });

  test("maxTags: 达到上限后点击插入被忽略", () => {
    const ti = new TagInput(root, {
      defaultTags: ["A", "B", "C"],
      defaultValue: "A, B",
      maxTags: 2,
    });
    queryInsert(root)[0]!.click();
    expect(ti.value).toBe("A, B");
    ti.destroy();
  });

  test("maxTags: inline 模式 Enter 达到上限后不添加，输入文本保留", () => {
    const ti = new TagInput(root, {
      defaultTags: ["A", "B", "C"],
      defaultValue: "A, B",
      maxTags: 2,
      inline: true,
    });
    const input = inputEl(root);
    input.value = "C";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    /* 标签数未增加，输入文本未被清空（未提交） */
    expect(ti.value).toBe("C");
    expect(ti.tags).toEqual(["A", "B", "C"]);
    ti.destroy();
  });

  test("insertTag 程序化插入，重复插入被忽略", () => {
    const ti = new TagInput(root, { defaultTags: ["A"] });
    ti.insertTag("A");
    expect(ti.value).toBe("A");
    ti.insertTag("A");
    expect(ti.value).toBe("A");
    ti.insertTag("B"); // 不在可用列表也可插入
    expect(ti.value).toBe("A, B");
    ti.destroy();
  });

  test("removeTag 程序化移除", () => {
    const ti = new TagInput(root, { defaultTags: ["A", "B"] });
    ti.removeTag("A");
    expect(ti.tags).toEqual(["B"]);
    expect(queryInsert(root).length).toBe(1);
    ti.destroy();
  });

  test("disabled / readOnly 禁用交互", () => {
    const ti = new TagInput(root, { defaultTags: ["A"], disabled: true });
    expect(inputEl(root).disabled).toBe(true);
    expect(queryInsert(root)[0]!.disabled).toBe(true);
    expect(queryRemove(root).length).toBe(0); // disabled 时无 × 按钮

    ti.setDisabled(false);
    ti.setReadOnly(true);
    expect(inputEl(root).readOnly).toBe(true);
    expect(queryInsert(root)[0]!.disabled).toBe(true);
    expect(queryRemove(root)[0]!.disabled).toBe(true);
    ti.destroy();
  });

  test("destroy 清空宿主容器", () => {
    const ti = new TagInput(root, { defaultTags: ["A"] });
    ti.destroy();
    expect(root.textContent).toBe("");
  });
});
