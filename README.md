# Sleep Anchor

一个本地优先的 CBT-I 睡眠日记与睡眠窗口训练工具。它解决三个刚需动作：

- 每天快速记录上床、起床、清醒、小睡和习惯因素
- 自动计算 TIB、TST、睡眠效率，并按 7 条记录生成下周睡眠窗口建议
- 首次使用提供 7 天基线挑战、适用性安全确认和日历提醒
- 支持 JSON/CSV/周报告导出，方便备份或给医生、咨询师复盘

## 产品边界

- 数据默认只保存在浏览器 `localStorage`
- 不需要账号，不上传睡眠数据
- 自助工具不替代医疗诊断；高风险人群需要先咨询专业人员

## 本地运行

```bash
npm install
npm run dev
```

## 验证

```bash
npm run test
npm run lint
npm run build
```

## 部署

这是一个纯静态 Vite 应用，可部署到 Cloudflare Pages：

- Build command: `npm run build`
- Output directory: `dist`

## 参考方向

- ACP: Cognitive behavioral therapy as initial treatment for chronic insomnia
- AASM Sleep Education: Cognitive Behavioral Therapy
- VA CBT-i Coach
