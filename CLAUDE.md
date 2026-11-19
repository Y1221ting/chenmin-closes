# CLAUDE.md - 个人衣柜

## 项目概述

Windows 本地个人衣柜与搭配桌面软件。用户导入自己衣服的
「正面 / 侧面 / 背面」三张透明背景 PNG，在画布上自由拼贴搭配，
再把整套搭配套到自己的全身照上预览。

技术栈：Python 3.11 + pywebview + 标准库 HTTP 服务 + SQLite + Pillow + 原生前端。

## 项目路径

`C:\Users\杨婷\Desktop\个人衣柜`

## 文档体系（docs/）

| 文件 | 内容 |
|------|------|
| [docs/01-需求文档.md](docs/01-需求文档.md) | 需求、核心概念、功能清单（P0/P1/P2）、界面原则 |
| [docs/02-技术方案.md](docs/02-技术方案.md) | 架构、目录结构、建表 SQL、图片管线、旋转与画布算法 |
| [docs/03-开发规范.md](docs/03-开发规范.md) | 代码风格、命名、错误处理、文件模板 |
| [docs/04-执行步骤.md](docs/04-执行步骤.md) | 阶段划分、每阶段任务与验收标准 |
| [docs/05-版本管理.md](docs/05-版本管理.md) | Git 工作流、提交规范、分支与标签 |
| [docs/06-当前进度.md](docs/06-当前进度.md) | 已完成功能、当前状态、下一步与待确认问题 |

## 开发日志

`开发日志/YYYY-MM-DD/日志.md` — 每日记录完成事项和待办事项

## 工作流程

### 每天开始
1. 读取 `开发日志/YYYY-MM-DD/待办事项.md` 查看今日计划
2. 读取对应阶段的文档确认技术细节

### 开发步骤
1. **一次只做一个功能点**，做完验证再继续下一个
2. 每个功能点完成后更新当日开发日志
3. 遵循 `docs/04-执行步骤.md` 中的阶段划分
4. **每个功能点完成后必须提交并推送到远程仓库**：
   `git add <相关文件>` → `git commit` → `git push`
   远程地址与提交规范见 `docs/05-版本管理.md`

### 代码规范
- 遵循 PEP 8，行宽 100
- 中文注释 + 中文 docstring
- 每个文件开头有模块说明注释
- 数据库操作必须 try/except 包裹，异常转成 `ServiceError` 中文提示

## 关键约定（不要违反）

1. **Python 固定用 3.11**（`py -3.11`）。机器默认的 `python` 是 3.8，太旧。
2. 前端**不用框架、不用构建工具**，经典 `<script>` + `window.App` 命名空间。
3. 所有颜色/圆角/间距写在 `web/css/variables.css`，换皮肤只改变量。
4. 画布坐标一律**归一化到 0~1**，不存像素。
5. 图片展示用 WebP，原始 PNG 保留在 `data/garments/<id>/original/`。
6. 程序不调用任何 AI 服务，不内置抠图——图片由用户自己处理好再导入。
7. 数据目录：开发时在项目根 `data/`，打包后在 exe 同级 `data/`。
8. 删除衣服走二次确认；删除时先删数据库记录再删图片目录。
9. 图片视觉风格固定为 **3D 皮克斯动画风**（衣物三视角 + 动漫模特形象），
   由用户在外部 AI 工具生成后导入；程序不做风格转换，也不判断画风。
10. 衣物图片统一由用户自备，程序不接入任何图像生成 API。
11. 配饰在首页独立收纳区展示，摆放方式由 `display_style` 控制：
    `hang` 挂杆 / `bag` 纸袋 / `flat` 平放；配饰不套白色卡片。

## 当前阶段

核心功能已完成，处于配饰收纳与衣柜交互打磨阶段（2026-11-19）
→ 详见 [docs/06-当前进度.md](docs/06-当前进度.md)

## 关键命令

```bash
# 激活虚拟环境（Git Bash）
source .venv/Scripts/activate

# 创建环境（首次）
py -3.11 -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt

# 运行程序
.venv/Scripts/python.exe main.py

# 打包程序
.venv/Scripts/pyinstaller.exe --noconfirm --onefile --windowed --name=个人衣柜 ^
  --icon=web/assets/icon.ico --add-data "web;web" ^
  --collect-all webview --collect-all pythonnet --collect-all clr_loader main.py
```

## 远程仓库

`https://github.com/Y1221ting/yt-closes.git`（main 分支）

## 用户偏好

- 用户是编程小白，不懂代码
- 需要最终产物是可双击运行的 .exe
- 开发过程中需要清晰反馈进展
- 界面风格：极简白（后期可能更换，靠 CSS 变量实现）
