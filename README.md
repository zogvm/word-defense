# 单词保卫战 · 闽教版小学英语

面向课堂的英语单词对战小游戏。以 Study-4Up5-English 的闽教版主题课程为骨架，并按 knowledge-map-main/english-map 的闽教版单元词表补充，覆盖三至六年级共 8 册 52 个单元、1309 个词条，一个单元一个游戏，老师上课直接打开对应单元即可开玩。

[在线体验「单词保卫战」](https://niannianweike.top/tools/word-defense/)

## 本地运行

用浏览器打开根目录的 `index.html`，按年级课本选择单元。也可以在项目目录启动静态服务器，再打开 `http://localhost:8000`。

```sh
python -m http.server 8000
```

无需安装依赖或构建。统一入口为 `unit.html?book=g3a&unit=1`（`book` 取 `g3a`～`g6b`，`unit` 为单元序号）；省略 `unit` 即进入该册全册大混战。总入口 `index.html` 会自动生成全部链接。

## 文件结构

| 文件 | 用途 |
|---|---|
| `index.html` / `desk.css` / `desk.js` | 总入口（课本选单 + 玩法讲解） |
| `index-books.js` | 按 `words.js` 动态生成总入口的八册单元菜单 |
| `unit.html` | 统一的单元/整册入口，通过 URL 参数选择教材册次和单元 |
| `game.css` / `game.js` | 所有单元页共用的游戏样式与核心引擎 |
| `phone-orientation.css` / `phone-orientation.js` | 手机竖屏自动暂停与横屏提示 |
| `words.js` | 闽教版八册单词表（52 单元、1309 词条；认读词标记为 `learnOnly`） |
| `word-icons.js` | 单词中文短标签（替代原 SVG/表情插图） |
| `audio/` | 离线单词配音及 `audio/manifest.js` |

改样式或游戏逻辑直接改 `game.css` / `game.js`，全部单元页同步生效；改单词或插图改 `words.js` / `word-icons.js`。

## 项目许可

在保留署名和许可说明的前提下，可为非商业目的使用、修改和分享项目的源码与原创课件。学校、培训机构及其他组织将课件用于收费培训、付费课程或其他收费服务，须事先取得书面许可。详见 [非商业使用许可](LICENSE.md)。

## 第三方素材

- 课程主题参考 Study-4Up5-English 的闽教版主题课程；单元词表参考 knowledge-map-main/english-map 的闽教版单元词表数据整理，为学习资料，不是出版社官方教材；教材内容著作权归原权利人所有。
- 补充的离线单词配音优先拷贝自 knowledge-map-main/english-map 的 `audio/en`；源项目缺失的 26 个词条使用 word-sprite-main 提供的 Kokoro 工具离线生成。其余旧配音与引导配音使用豆包语音合成。
