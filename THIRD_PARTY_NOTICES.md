# 第三方语音模型与许可

讲解语音按语种由不同引擎合成（路由见 `src/server/tts/engines.ts`）。
以下模型不随本仓库分发，由 `scripts/setup-tts-engines.sh` 在部署机上下载。

| 语种 | 引擎 / 模型 | 许可 | 来源 |
|---|---|---|---|
| 58 种（含他加禄语） | Microsoft Edge 在线语音（经 edge-tts 调用） | Microsoft 服务条款 | https://github.com/rany2/edge-tts |
| 亚美尼亚语 | Piper `hy_AM-gor-medium` | GPL-2.0（训练数据） | https://huggingface.co/rhasspy/piper-voices · 数据集 https://huggingface.co/davit312/piper-TTS-Armenian |
| 旁遮普语 | VITS Open Bible — Punjabi | CC-BY-SA 4.0 | https://huggingface.co/multilingual-tts/VITS-OpenBible-Punjabi |

## 署名

旁遮普语语音由 **VITS Open Bible — Punjabi** 模型合成（multilingual-tts，
基于 Open Bible 语料训练，CC-BY-SA 4.0）。该模型未作修改，仅在推理时改写配置中
指向训练机器的 `speakers_file` 路径，见 `scripts/tts-vits-worker.py`。

## 为何不采用其他候选

- **Meta MMS-TTS**：CC-BY-NC 4.0，不可商用。
- **AI4Bharat Indic-Parler-TTS**：Apache-2.0，但需逐账号在 Hugging Face 审批方可下载。
- **espeak-ng**：可用，但经语音识别评测，亚美尼亚语与旁遮普语的合成结果无法被转写回原文。
