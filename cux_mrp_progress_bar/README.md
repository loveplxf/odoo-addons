# MRP Progress Bar / 制造进度

![MRP Progress Bar](static/description/icon.png)

在 Odoo 20 中展示制造订单与工序工单的进度：订单表单一条进度条、工单上的进度百分比、制造订单列表里每个工序一个进度环。

Progress of manufacturing orders and work orders in Odoo 20: a bar on the order form, a percentage on every work order, and one ring per operation in the order list.

- 版本 / Version: 20.0.1.0.0
- 依赖 / Depends: `mrp`
- 许可 / License: LGPL-3

---

## 中文

### 功能

| 位置 | 展示内容 |
|---|---|
| 制造订单 · 表单 | 进度条，值为 `已完成数量 / 工单总数量`（如 `8 / 12`），位于表单头部信息下方 |
| 工单 · 列表 | `进度` 列，位于 `应生产数量`（qty_to_produce）之后 |
| 工单 · 表单 | 进度行，位于“已生产 / 应生产”数量行下方 |
| 制造订单 · 列表 | 环形进度组件，位于 `数量`（product_qty）之后，每个工序工单一个环 |

环形组件的三种状态：

- **0%**：灰色圆环，环内灰色 `0%`
- **1–99%**：浅灰轨道 + 蓝色圆弧，环内蓝色百分比
- **100%**：实心绿色圆 + 白色对勾

环下方显示工序名称（过长省略），鼠标悬停显示“工序名 + 百分比”。

### 计算规则

```text
工单进度 mrp_workorder_progress = 已完成数量 qty_produced / 工单总数量 qty_to_produce × 100
```

- `qty_produced` 与 `qty_to_produce` 都是工单（mrp.workorder）自带的字段，进度为实时计算，不落库。
- 结果封顶 100%，超产不会画出超过一圈的弧线。
- 订单表单的进度条使用标准 `progressbar` 组件，并通过 `options="{'max_value': 'product_qty'}"` 显示为“已完成 / 总数”。
- 订单列表的环形组件由 `cux_workorder_progress`（Json 计算字段）提供数据，一次读取即可拿到该订单下全部工单的进度，列表不会为每一行额外发请求。

### 安装

1. 将模块放入 addons 路径。
2. 更新应用列表，安装 **MRP Progress Bar**。
3. 刷新浏览器。
4. 制造 → 操作 → 制造订单。

修改组件样式（SCSS/JS）后，assets 有缓存，需要重启服务或升级模块：

```bash
odoo-bin -d <数据库> -u cux_mrp_progress_bar
```

### 实现

| 内容 | 文件 |
|---|---|
| 工单进度字段 `mrp_workorder_progress` | `models/mrp_workorder.py` |
| 订单进度数据 `cux_workorder_progress` | `models/mrp_production.py` |
| 订单表单进度条 / 订单列表环形列 | `views/mrp_production_views.xml` |
| 工单列表与表单的进度 | `views/mrp_workorder_views.xml` |
| 环形组件（OWL 字段组件 `workorder_progress_rings`） | `static/src/js/workorder_progress_rings.js`<br/>`static/src/xml/workorder_progress_rings.xml`<br/>`static/src/scss/workorder_progress_rings.scss` |
| 中文翻译 | `i18n/zh_CN.po` |

### 目录结构

```text
cux_mrp_progress_bar/
├── __init__.py
├── __manifest__.py
├── i18n/
│   └── zh_CN.po
├── models/
│   ├── __init__.py
│   ├── mrp_production.py
│   └── mrp_workorder.py
├── static/
│   ├── description/
│   │   ├── icon.png
│   │   └── index.html
│   └── src/
│       ├── js/workorder_progress_rings.js
│       ├── scss/workorder_progress_rings.scss
│       └── xml/workorder_progress_rings.xml
└── views/
    ├── mrp_production_views.xml
    └── mrp_workorder_views.xml
```

### 注意事项

- 列表列会略微增加行高；可在列选择器中隐藏该列。
- 没有工序（无 BOM 工艺路线 / 工作中心）的订单，环形单元格为空。
- 进度为计算字段，只读，无法手工填写。

---

## English

### What it does

| Where | What you see |
|---|---|
| Manufacturing order · form | A progress bar showing `produced / quantity to produce` (e.g. `8 / 12`), under the header fields |
| Work order · list | A `Progress` column, right after `To Produce` (`qty_to_produce`) |
| Work order · form | A progress row, below the produced / to produce quantities |
| Manufacturing order · list | A ring widget, right after `product_qty`: one ring per work order |

Ring states:

- **0%**: grey ring with a grey `0%` inside
- **1–99%**: light grey track with a blue arc and the blue percentage inside
- **100%**: solid green disc with a white check

The operation name is printed under each ring (truncated when too long); hovering a ring shows the operation name and its exact percentage.

### How it is computed

```text
work order progress mrp_workorder_progress = qty_produced / qty_to_produce × 100
```

- `qty_produced` and `qty_to_produce` are standard work order fields: the progress is computed on the fly, never stored.
- The value is capped at 100%, so over-production never draws past a full ring.
- The order form uses the standard `progressbar` widget with `options="{'max_value': 'product_qty'}"`, which is why both quantities are displayed.
- The ring column is fed by `cux_workorder_progress`, a computed Json field: one read gives the progress of every work order, so the list does not issue one request per row.

### Installation

1. Copy the module into your addons path.
2. Update the apps list and install **MRP Progress Bar**.
3. Reload the browser.
4. Manufacturing › Operations › Manufacturing Orders.

Asset bundles are cached: after editing the JS/SCSS, restart the server or upgrade the module.

```bash
odoo-bin -d <database> -u cux_mrp_progress_bar
```

### Implementation

| Item | File |
|---|---|
| `mrp_workorder_progress` field | `models/mrp_workorder.py` |
| `cux_workorder_progress` data | `models/mrp_production.py` |
| Order form bar / order list rings | `views/mrp_production_views.xml` |
| Work order list and form | `views/mrp_workorder_views.xml` |
| Ring widget (OWL field `workorder_progress_rings`) | `static/src/js/workorder_progress_rings.js`<br/>`static/src/xml/workorder_progress_rings.xml`<br/>`static/src/scss/workorder_progress_rings.scss` |
| Simplified Chinese | `i18n/zh_CN.po` |

### Notes

- The ring column makes list rows slightly taller; it can be removed from the column selector.
- An order without operations simply shows an empty ring cell.
- Both progress values are computed and read-only.
