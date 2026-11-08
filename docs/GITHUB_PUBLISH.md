# 发布到 GitHub

仓库：<https://github.com/cyp9757/weekflow>

GitHub 不支持用账号密码直接推送代码。请使用 Fine-grained Personal Access Token：

1. 打开 GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens。
2. 新建 token：
   - Resource owner：`cyp9757`
   - Repository access：Only select repositories → `weekflow`
   - Permissions → Repository permissions → **Contents: Read and write**
   - 有效期建议 7 天
3. 不要把这个 token 写进文件或发到公开聊天；在一台可信机器上设置环境变量后运行：

```powershell
$env:GITHUB_TOKEN = '<你的 token>'
pnpm publish:github
```

脚本会上传：

- `src/`、`test/`、`scripts/`、`docs/`、`assets/`
- `package.json`、`package-lock.json`、README、LICENSE

不会上传：

- `data/`（个人任务、积分、兑换记录）
- `dist/`（构建产物）
- `node_modules/`
- `scripts/import-bili-plan.mjs`
- `scripts/import-stock-basics.mjs`
- `scripts/import-vibe-plan.mjs`

## 版本与更新日志

发布前先：

1. 修改 `package.json` 的 `version`；
2. 在 `CHANGELOG.md` 增加同版本号的一节；
3. 运行 `pnpm publish:github`。

脚本会：

- 用 `release: vX.Y.Z` 作为提交信息；
- 创建 `vX.Y.Z` Git tag；
- 用 `CHANGELOG.md` 对应章节作为 GitHub Release 说明。

`scripts/publish-github-api.mjs` 只上传源码/文档，不上传个人数据。以后更新代码后，重复运行 `pnpm publish:github` 即可。
