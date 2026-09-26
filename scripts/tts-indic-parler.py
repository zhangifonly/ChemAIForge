"""旁遮普语合成：AI4Bharat Indic-Parler-TTS（Apache-2.0）。

为什么是它：旁遮普语在 edge-tts 与 Piper 里都没有音色；Meta MMS-TTS 是 CC-BY-NC
不可商用；espeak-ng 念出来识别模型转写不回原文。Indic-Parler 官方支持旁遮普语、
Apache-2.0 可商用、HF 下载量 30 万。

它是 gated 模型：需要 HF 账号在 https://huggingface.co/ai4bharat/indic-parler-tts
页面点"同意"，再在本机执行一次 `hf auth login`。之后本脚本即可离线运行。

用法：python tts-indic-parler.py "<旁遮普语文本>" <输出.wav> [female|male]
"""
import sys

import soundfile as sf
import torch
from parler_tts import ParlerTTSForConditionalGeneration
from transformers import AutoTokenizer

MODEL = "ai4bharat/indic-parler-tts"

# Indic-Parler 用一段英文描述指定说话人。这两位是模型卡里列出的旁遮普语推荐说话人
SPEAKERS = {
    "female": "Divjot speaks at a moderate pace with a clear, neutral tone in a close-sounding recording with no background noise.",
    "male": "Gurpreet speaks at a moderate pace with a clear, neutral tone in a close-sounding recording with no background noise.",
}


def main() -> None:
    text, out = sys.argv[1], sys.argv[2]
    gender = sys.argv[3] if len(sys.argv) > 3 else "female"
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = ParlerTTSForConditionalGeneration.from_pretrained(MODEL).to(device)
    tok = AutoTokenizer.from_pretrained(MODEL)
    desc_tok = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)
    desc = desc_tok(SPEAKERS[gender], return_tensors="pt").to(device)
    prompt = tok(text, return_tensors="pt").to(device)
    audio = model.generate(
        input_ids=desc.input_ids,
        attention_mask=desc.attention_mask,
        prompt_input_ids=prompt.input_ids,
        prompt_attention_mask=prompt.attention_mask,
    )
    sf.write(out, audio.cpu().numpy().squeeze(), model.config.sampling_rate)


if __name__ == "__main__":
    main()
