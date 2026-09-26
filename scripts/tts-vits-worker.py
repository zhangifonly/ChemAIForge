"""常驻 VITS 合成进程：启动时加载一次模型，之后按行处理请求。

为什么常驻：每次起新进程要 import torch + 加载 951 MB 模型，实测单句约 6 秒，
其中合成本身只占零头。常驻后每句只剩合成时间。

协议（每行一个 JSON，UTF-8）：
  请求  {"text": "...", "out": "/abs/path.wav"}
  应答  {"ok": true}  或  {"ok": false, "error": "..."}
启动完成时先输出一行 {"ready": true}，调用方等到它再发请求。

用法：python tts-vits-worker.py <模型目录>
"""
import json
import os
import sys
import tempfile


def load(model_dir: str):
    # 与 tts-vits.py 相同的配置修正：speakers_file 指向训练机器、权重里没有说话人嵌入层
    with open(os.path.join(model_dir, "config.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    cfg["use_speaker_embedding"] = False
    cfg["speakers_file"] = None
    cfg.setdefault("model_args", {})
    cfg["model_args"].update(use_speaker_embedding=False, speakers_file=None, num_speakers=0)
    fd, path = tempfile.mkstemp(suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False)
    try:
        from TTS.api import TTS

        return TTS(
            model_path=os.path.join(model_dir, "model_last.pth"),
            config_path=path,
            progress_bar=False,
        )
    finally:
        os.remove(path)


def reply(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> None:
    # Coqui 会把合成日志打到 stdout，那会污染协议行；全部改道到 stderr
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    tts = load(sys.argv[1])
    sys.stdout = real_stdout
    reply({"ready": True})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            sys.stdout = sys.stderr
            try:
                # 模型词表没有古木基文句号「।」，换成空格保留停顿
                tts.tts_to_file(text=req["text"].replace("।", " "), file_path=req["out"])
            finally:
                sys.stdout = real_stdout
            reply({"ok": True})
        except Exception as e:  # noqa: BLE001 —— 单句失败不能拖垮常驻进程
            reply({"ok": False, "error": str(e)[:300]})


if __name__ == "__main__":
    main()
