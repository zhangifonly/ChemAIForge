"""VITS 语音合成（Coqui TTS），当前用于旁遮普语。

为什么是它：旁遮普语在 edge-tts、Piper 里都没有音色；Meta MMS-TTS 是 CC-BY-NC
不可商用；Indic-Parler-TTS 虽是 Apache-2.0 但需逐账号审批；espeak-ng 念出来识别不回原文。
multilingual-tts/VITS-OpenBible-Punjabi 许可 CC-BY-SA 4.0（可商用，须署名），不设审批。

评测（scripts/tts-eval.mjs 同法：合成 → whisper large-v3-turbo 转写）：三句口播全部可懂，
「ਸੋਡੀਅਮ ਹਾਈਡ੍ਰੋਕਸਾਈਡ ਇੱਕ ਤੇਜ਼ ਖਾਰ ਹੈ」转写为 सोडीम हाइडर उकसाइड एक तेज खार है，
读音与原文吻合；与 Google 参照音频的识别结果接近。

模型注意：仓库附带的 config.json 把 speakers_file 指向训练机器上的路径，且声明 2 个说话人，
但权重里并没有说话人嵌入层（emb_g）—— 它实际是单说话人模型。本脚本按单说话人加载。

用法：python tts-vits.py <模型目录> <输出.wav>   （文本从标准输入读，避免命令行转义问题）
"""
import json
import os
import sys
import tempfile


def main() -> None:
    model_dir, out = sys.argv[1], sys.argv[2]
    text = sys.stdin.read().strip()
    if not text:
        sys.exit("文本为空")

    # 改写一份本地可用的配置：去掉指向训练机器的 speakers_file，按单说话人加载
    with open(os.path.join(model_dir, "config.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    cfg["use_speaker_embedding"] = False
    cfg["speakers_file"] = None
    cfg.setdefault("model_args", {})
    cfg["model_args"].update(use_speaker_embedding=False, speakers_file=None, num_speakers=0)
    fd, cfg_path = tempfile.mkstemp(suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False)

    try:
        from TTS.api import TTS

        tts = TTS(
            model_path=os.path.join(model_dir, "model_last.pth"),
            config_path=cfg_path,
            progress_bar=False,
        )
        # 模型词表里没有古木基文句号「।」，会被丢弃并打印告警；换成空格让停顿自然
        tts.tts_to_file(text=text.replace("।", " "), file_path=out)
    finally:
        os.remove(cfg_path)


if __name__ == "__main__":
    main()
