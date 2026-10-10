# Burmese text-to-speech worker: Meta's open MMS-TTS Burmese model (facebook/mms-tts-mya), run locally on the CPU.
# Started by tts.js inside the venv `bin/burmese tts-install` makes. Reads JSON lines {"text", "out", "rate"} on stdin,
# writes an MP3 to "out" (via ffmpeg) and answers one JSON line {"ok": out} or {"error": msg} per request.
import json
import subprocess
import sys

import torch
from transformers import AutoTokenizer, VitsModel

MODEL = 'facebook/mms-tts-mya'
tok = AutoTokenizer.from_pretrained(MODEL)
model = VitsModel.from_pretrained(MODEL).eval()
torch.set_num_threads(4)
print(json.dumps({'ready': True}), flush=True)

for line in sys.stdin:
    try:
        job = json.loads(line)
        model.speaking_rate = float(job.get('rate') or 1.0)
        torch.manual_seed(0)  # the model samples durations; a fixed seed keeps a clip the same every time it's made
        with torch.no_grad():
            wav = model(**tok(job['text'], return_tensors='pt')).waveform[0].numpy()
        pcm = (wav.clip(-1, 1) * 32767).astype('<i2').tobytes()
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(model.config.sampling_rate), '-ac', '1',
                        '-i', '-', '-codec:a', 'libmp3lame', '-q:a', '5', job['out']], input=pcm, check=True)
        print(json.dumps({'ok': job['out']}), flush=True)
    except Exception as e:
        print(json.dumps({'error': str(e)}), flush=True)
