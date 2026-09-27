#!/usr/bin/env bash
# 在部署机上安装语音合成的附加引擎：
#   Piper + 亚美尼亚语模型（hy_AM-gor-medium）
#   Coqui VITS + 旁遮普语模型（multilingual-tts/VITS-OpenBible-Punjabi，CC-BY-SA 4.0）
#
# edge-tts 与 ffmpeg 已是部署机的既有依赖；这两个引擎补上 edge-tts 没有音色的语种
# （选型评测见 src/server/tts/engines.ts）。装在独立 venv 里，不碰系统 Python，
# 也不影响同机其他服务。可重复执行：已装好的部分会跳过。
#
# 用法（在部署机上）：bash scripts/setup-tts-engines.sh
# 装完后在应用的环境变量里设（脚本末尾会打印）：
#   PIPER_BIN / PIPER_MODEL_DIR / VITS_PYTHON / VITS_MODEL_DIR
set -euo pipefail

ROOT="${TTS_ROOT:-/opt/chemaiforge-tts}"
VOICES="$ROOT/voices"
MODELS="$ROOT/models"
HF="https://huggingface.co"

command -v ffmpeg >/dev/null || { echo "缺 ffmpeg，先 apt-get install -y ffmpeg"; exit 1; }
command -v python3.12 >/dev/null || { echo "缺 python3.12"; exit 1; }
mkdir -p "$ROOT" "$VOICES" "$MODELS"

# ---------- Python 环境 ----------
if [ ! -x "$ROOT/.venv/bin/python" ]; then
  python3.12 -m venv "$ROOT/.venv"
  "$ROOT/.venv/bin/pip" install --quiet --upgrade pip
fi
PIP="$ROOT/.venv/bin/pip"

if [ ! -x "$ROOT/.venv/bin/piper" ]; then
  echo "== 安装 Piper"
  # 钉版本：piper-tts 1.2.0 依赖一个预发布版的 phonemize，在 pip 下解析失败
  "$PIP" install --quiet "piper-tts==1.3.0"
fi

if ! "$ROOT/.venv/bin/python" -c "import TTS" 2>/dev/null; then
  echo "== 安装 Coqui TTS（CPU 版 torch，部署机无 GPU）"
  # torch 与 torchaudio 必须同版本：解析器曾把 torchaudio 拉到 2.11，与 torch 2.5.1
  # ABI 不符，导入时报 Symbol not found: _aoti_torch_abi_version
  "$PIP" install --quiet --index-url https://download.pytorch.org/whl/cpu \
    "torch==2.5.1" "torchaudio==2.5.1"
  "$PIP" install --quiet "coqui-tts==0.24.3" "transformers==4.46.1" click
fi

# ---------- 模型 ----------
PIPER_REL="hy/hy_AM/gor/medium"
mkdir -p "$VOICES/$PIPER_REL"
for ext in onnx onnx.json; do
  f="$VOICES/$PIPER_REL/hy_AM-gor-medium.$ext"
  if [ ! -s "$f" ]; then
    echo "== 下载 Piper 亚美尼亚语 .$ext"
    curl -fsSL --retry 3 -o "$f" "$HF/rhasspy/piper-voices/resolve/main/$PIPER_REL/hy_AM-gor-medium.$ext"
  fi
done

PA="$MODELS/pa-vits"
mkdir -p "$PA"
for f in config.json model_last.pth; do
  if [ ! -s "$PA/$f" ]; then
    echo "== 下载 VITS 旁遮普语 $f"
    curl -fsSL --retry 3 -o "$PA/$f" "$HF/multilingual-tts/VITS-OpenBible-Punjabi/resolve/main/$f"
  fi
done

# ---------- 自检 ----------
echo "== 自检"
ok=1
echo "Լավ խառնեք ռեագենտները" \
  | "$ROOT/.venv/bin/piper" -m "$VOICES/$PIPER_REL/hy_AM-gor-medium.onnx" -f /tmp/piper-selftest.wav >/dev/null 2>&1 || true
s=$(stat -c%s /tmp/piper-selftest.wav 2>/dev/null || echo 0); rm -f /tmp/piper-selftest.wav
if [ "$s" -gt 1000 ]; then echo "✓ Piper 亚美尼亚语（$s 字节）"; else echo "✗ Piper 自检失败"; ok=0; fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "ਰੀਏਜੈਂਟਾਂ ਨੂੰ ਮਿਲਾਓ" \
  | "$ROOT/.venv/bin/python" "$SCRIPT_DIR/tts-vits.py" "$PA" /tmp/vits-selftest.wav >/dev/null 2>&1 || true
s=$(stat -c%s /tmp/vits-selftest.wav 2>/dev/null || echo 0); rm -f /tmp/vits-selftest.wav
if [ "$s" -gt 1000 ]; then echo "✓ VITS 旁遮普语（$s 字节）"; else echo "✗ VITS 自检失败"; ok=0; fi

[ "$ok" = 1 ] || exit 1
echo
echo "请在应用环境变量中设置："
echo "  PIPER_BIN=$ROOT/.venv/bin/piper"
echo "  PIPER_MODEL_DIR=$VOICES"
echo "  VITS_PYTHON=$ROOT/.venv/bin/python"
echo "  VITS_MODEL_DIR=$MODELS"
