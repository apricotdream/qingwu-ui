/** 统一 toast 出口（options/popup/sidepanel 共用）；content script 注入第三方页，用隔离 DOM toast */
import { toast } from "@qingwu-ui/toast";
import "@qingwu-ui/toast/style.css";

// 与原内置 toast 一致：右下角堆叠
toast.configure({ position: "bottom-right" });
