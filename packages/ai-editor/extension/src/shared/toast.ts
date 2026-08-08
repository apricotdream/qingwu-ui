/**
 * 统一 toast 出口（options / popup / sidepanel 共用）。
 *
 * 导入本模块即完成：样式注入（style.css 随入口打包）+ 扩展默认配置。
 * 业务代码直接从 "@qingwu/toast" 导入 toast 单例调用即可，
 * 定位等默认值由这里一次性设定。
 *
 * content script 不走这里——它注入第三方页面，用自己的隔离 DOM toast。
 */
import { toast } from "@qingwu/toast";
import "@qingwu/toast/style.css";

// 与原内置 toast 一致：右下角堆叠
toast.configure({ position: "bottom-right" });
