/**
 * @local/three-kingdoms-strategy — host half（服务端入口）
 *
 * 硬约束：main 指向的文件会在服务端 boot profile 时被 import。
 * 任何顶层 window / document 引用都会让整个服务起不来。
 * 本文件必须保持服务端安全 —— 这里只是一个空壳。
 *
 * 全部游戏逻辑（地图、内政、战斗、AI、存档）都跑在浏览器侧 client.js，
 * 宿主不持有任何游戏状态，也不需要任何 RPC。
 */
export const name = "three-kingdoms-strategy";

export function apply() {
  /* 无宿主侧行为：纯客户端 UI 插件 */
}

export default { name, apply };
