# biubiu IP 角色规格 — AI 图形生成用

> 适用平台：Midjourney / DALL·E 3 / Stable Diffusion / ComfyUI

---

## 中文描述（直接贴进生图工具）

```
一个泡泡玛特风格的可爱卡通角色，叫做biubiu。

整体：
- 梨形身材，大头娃娃比例（头占身体 60%），Q版可爱
- 暖黄色奶油色渐变身体（#FFF8E7 → #F0E6CC），圆润光滑像陶瓷
- 两条小短腿（椭圆形），两只小短手

头部（最关键）：
- 大头圆形，奶油色
- 额头正中央有一道金色闪电角（⚡），发光脉动
- 两只大圆眼，间距较宽，黑色瞳孔 + 白色高光点
- 粉红色腮红在脸颊两侧
- 小嘴巴（弧形微笑线）

身体装饰：
- 肚子上画一个白色足球图案（五边形拼接样式）
- 没有衣服，纯身体颜色

右手：
- 食指指向前方，指尖射出一道金色光束

风格：
- 3D 渲染，哑光材质，像泡泡玛特盲盒玩具
- 纯色渐变背景，无场景
- 正面视角，站立姿势
- 可爱、治愈、萌系
```

---

## English Prompt (Midjourney / DALL·E)

```
A cute Pop Mart style vinyl toy character named "biubiu", standing pose, front view.

Body:
- Pear-shaped chubby body, big head ratio (big head, small body), Q-figure proportions
- Warm cream yellow gradient (#FFF8E7 to #F0E6CC), smooth matte ceramic texture
- Two tiny stubby legs, two short stubby arms

Head:
- Large round cream-colored head
- A single golden lightning bolt (⚡) on the forehead, glowing and pulsing
- Two large round eyes, wide apart, black pupils with white highlight dots
- Pink blush circles on both cheeks
- Small curved smile mouth

Body detail:
- A white soccer ball pattern (pentagon panels) painted on the belly
- No clothes, just the plain body color

Right hand:
- Index finger pointing forward, shooting a golden energy beam from fingertip

Style:
- 3D rendered, matte finish, looks like a physical vinyl art toy / designer toy
- Solid dark background (#0a0e14)
- Adorable, kawaii, healing, cute character design
- Pop Mart blind box aesthetic, collectible toy photography

--ar 1:1 --style raw --v 6
```

---

## 五官参数速查

| 部位 | 规格 |
|------|------|
| 眼睛位置 | cx=82,118（左右），cy=62 |
| 眼睛大小 | r=14（正常）/ r=16（瞪大） |
| 瞳孔高光 | r=5 白色 + r=2 白色双点 |
| 腮红 | cx=60,140 cy=75 rx=14 ry=9 |
| 嘴位置 | cy≈85-87 |
| 闪电角 | 顶点 cy=8, 底部 cy=48, 宽约 14px |

## 颜色方案

| 名称 | HEX | 用途 |
|------|-----|------|
| 身体渐变色 | `#FFFEF8 → #FFF8E7 → #F0E6CC` | 主体 |
| 闪电角金色 | `#FFF9C4 → #FFD700` | 角 |
| 腮红 | `#FFC8C8 → #FFA8A8` | 脸颊 |
| 眼睛 | `#2A2A2A` | 瞳孔 |
| 高光 | `#FFFFFF` | 眼睛亮点 |
| 背景色 | `#0A0E14` | 深色背景 |

## 6种表情状态

| 表情 | 眼睛 | 嘴 | 角 | 特效 |
|------|------|-----|-----|------|
| 自信 | 正常圆眼 | 微笑弧线 | 发光脉动 | 右手指尖光束 |
| 悲伤 | 正常+泪滴 | 波浪线 | 灰色不发光 | — |
| 紧张 | 瞪大圆眼 | 椭圆张口 | 脉动不发光 | — |
| 兴奋 | 眯眯眼(^_^) | 大笑张口 | 发光 | 双手光束 |
| 眨眼 | 单眼闭+单眼睁 | 微笑 | 脉动 | — |
| 迷你 | 正常 | 微笑 | 正常 | 身体简化，无手臂腿 |

---

## 原始 SVG

已提取为独立文件：见 `docs/biubiu.svg` 和 `docs/biubiu-sprite-sheet.svg`
