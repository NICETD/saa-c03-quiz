# SAA-C03 刷题助手

AWS SAA-C03 认证考试刷题工具。纯静态，无后端，运行在 GitHub Pages 上。

## 功能

- **顶部 Dashboard**：总题数 / 已作答 / 答对 / 答错 / 正确率
- **普通练习**：每 50 题一个 Section 卡片（显示完成度 + 正确率），或自定义题号范围；顺序 / 随机模式
- **模拟考试**：65 题 / 130 分钟 / 720 分通过线，考试历史记录
- **题目回顾**：按 全部 / 答错 / 答对 / 收藏 筛选；点击进入对应题目子集刷题
- **学习统计**：今日/本周作答、连续天数、已掌握/收藏/错题数、近 60 天活动热力图、各 Section 正确率、模拟考试历史
- **三态语言切换**：纯中文 / 纯英文 / 中英对照（顶部右上角）
- **localStorage 持久化**：进度、错题、收藏、考试历史

## 题库

- **英文**：1019 题（含 846 道详细解析）— 主数据源
- **中文**：1019 题（无解析）— 内容相似度匹配，941 题可双语对照（92%）

数据已预先解析为 `data/questions.json`（约 2 MB），随站点静态加载。

## 本地预览

```bash
cd test-assistant
python3 -m http.server 8000
# 打开 http://localhost:8000
```

## 部署到 GitHub Pages

```bash
git init
git add .
git commit -m "initial"
git branch -M main
git remote add origin git@github.com:<you>/<repo>.git
git push -u origin main
```

然后在仓库 Settings → Pages：
- Source: `Deploy from a branch`
- Branch: `main` / `(root)` → Save

几分钟后访问 `https://<you>.github.io/<repo>/` 即可。

## 重新生成题库（仅在 PDF 更新时）

```bash
cd tools
npm install                # 装 pdfjs-dist
node extract-text.mjs en   # 提取英文 PDF → raw-en.txt
node extract-text.mjs zh   # 提取中文 PDF → raw-zh.txt
node parse-en.mjs          # → data/questions.en.json
node parse-zh.mjs          # → data/questions.zh.json
node align.mjs             # 内容匹配 → alignment.json
node merge.mjs             # 合并 → data/questions.json
node verify.mjs            # 抽样比对报告 → REPORT.md
```

## 目录结构

```
.
├── data/questions.json    # 运行时数据（合并好的）
├── data/questions.en.json # EN 中间结果
├── data/questions.zh.json # ZH 中间结果
├── index.html
├── app.js                 # 路由入口
├── style.css
├── src/
│   ├── data.js            # 题库加载
│   ├── store.js           # localStorage 封装
│   ├── i18n.js            # UI 文案 (zh/en)
│   ├── router.js          # hash 路由
│   ├── dom.js             # h() / mount() 辅助
│   └── views/
│       ├── chrome.js      # dashboard + nav + 语言切换
│       ├── home.js
│       ├── practice.js
│       ├── exam.js
│       ├── review.js
│       ├── stats.js
│       └── quiz.js
├── tools/                 # PDF → JSON 离线脚本（不部署）
│   ├── extract-text.mjs
│   ├── parse-en.mjs
│   ├── parse-zh.mjs
│   ├── align.mjs
│   ├── merge.mjs
│   └── verify.mjs
└── questions/             # 原始 PDF（不部署）
```

## .gitignore

`tools/node_modules/`、`tools/raw-*.txt`、`tools/REPORT.md`、`questions/` 都不应进仓库。
