import json, uuid, asyncio, requests, streamlit as st
from pathlib import Path
from loguru import logger
import edge_tts

# FIXED IMPORTS FOR MOVIEPY v2
try:
    from moviepy import VideoFileClip, AudioFileClip, TextClip, CompositeVideoClip, concatenate_videoclips, ColorClip
except ImportError:
    from moviepy.editor import VideoFileClip, AudioFileClip, TextClip, CompositeVideoClip, concatenate_videoclips, ColorClip

ROOT_DIR = Path(__file__).parent.resolve()
STORAGE_DIR = ROOT_DIR / "storage"
TEMP_DIR = STORAGE_DIR / "temp"
OUTPUT_DIR = STORAGE_DIR / "output"
TEMP_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

st.set_page_config(page_title="TURBO AI - Automated Video Generator", page_icon="⚡", layout="wide")

# 10/10 THEME - Same as image
st.markdown("""
<style>
.stApp { background-color: #F8FAFC; }
section[data-testid="stSidebar"] { background-color: #0F172A!important; }
section[data-testid="stSidebar"] * { color: #F1F5F9!important; }
.stButton>button { background-color: #2563EB!important; color: white!important; border-radius: 8px!important; font-weight: 600!important; }
</style>
""", unsafe_allow_html=True)

def generate_script_llm(topic: str, provider: str, api_key: str) -> dict:
    if provider == "OpenAI" and api_key.strip():
        try:
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            prompt = f"Create short video script about '{topic}'. Return JSON with 'script' and 'keywords' (3 terms)."
            payload = {"model": "gpt-4o-mini", "messages": [{"role": "user", "content": prompt}], "response_format": {"type": "json_object"}}
            resp = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=20)
            if resp.status_code == 200:
                return json.loads(resp.json()["choices"][0]["message"]["content"])
        except Exception as e:
            logger.error(f"LLM Error: {e}")
    return {"script": f"Welcome to TURBO AI. Today we explore {topic}. Technology is advancing fast.", "keywords": [topic, "technology", "future"]}

async def generate_speech_edge(text: str, voice: str, output_path: str):
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)

def run_tts_safe(text, voice, path):
    # FIXED: Safe asyncio for Streamlit
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(generate_speech_edge(text, voice, path))
    finally:
        loop.close()

def fetch_pexels_videos(keywords: list, pexels_key: str, task_id: str, count: int = 2) -> list:
    files = []
    if not pexels_key.strip(): return files
    headers = {"Authorization": pexels_key}
    for idx, kw in enumerate(keywords[:3]):
        if len(files) >= count: break
        try:
            r = requests.get(f"https://api.pexels.com/videos/search?query={kw}&per_page=1&orientation=portrait", headers=headers, timeout=10)
            if r.status_code == 200 and r.json().get("videos"):
                link = r.json()["videos"][0]["video_files"][0]["link"]
                data = requests.get(link, timeout=20).content
                fp = TEMP_DIR / f"{task_id}_{idx}.mp4"
                fp.write_bytes(data)
                files.append(str(fp))
        except Exception as e:
            logger.error(e)
    return files

def render_video_pipeline(script_text, audio_path, video_clips, output_path, subtitle_pos):
    audio_clip = AudioFileClip(audio_path)
    total_duration = audio_clip.duration
    loaded = [VideoFileClip(p).without_audio() for p in video_clips if Path(p).exists()]

    if not loaded:
        base = ColorClip(size=(1080, 1920), color=(15, 23, 42), duration=total_duration)
    else:
        concat = concatenate_videoclips(loaded, method="compose")
        if concat.duration < total_duration:
            base = concatenate_videoclips([concat] * (int(total_duration // concat.duration) + 1)).subclip(0, total_duration)
        else:
            base = concat.subclip(0, total_duration)

    base = base.resized((1080, 1920)) if hasattr(base, 'resized') else base.resize((1080, 1920))

    txt = TextClip(text=script_text, font_size=48, color='white', method='caption', size=(900, None), duration=total_duration)
    txt = txt.with_position(('center', 1400 if subtitle_pos == "Bottom" else 200))

    final = CompositeVideoClip([base, txt]).with_audio(audio_clip)
    final.write_videofile(output_path, fps=24, codec='libx264', audio_codec='aac', preset='ultrafast')

    # FIXED: Memory leak closed
    audio_clip.close(); final.close(); base.close()
    for c in loaded: c.close()
    if 'concat' in locals(): concat.close()

# --- UI ---
st.title("⚡ TURBO AI")
with st.sidebar:
    st.header("⚙️ Core Configuration")
    llm_provider = st.selectbox("LLM Script Engine", ["OpenAI", "Built-In Template"])
    llm_key = st.text_input("OpenAI Key", type="password")
    tts_voice = st.selectbox("TTS Voice", ["en-US-JennyNeural", "en-US-GuyNeural", "en-GB-SoniaNeural"])
    pexels_key = st.text_input("Pexels API Key", type="password")

topic = st.text_input("Video Subject / Topic", placeholder="e.g., Space Exploration")
subtitle_pos = st.selectbox("Subtitle Position", ["Bottom", "Top"])
custom_script = st.text_area("Custom Script (Optional)")

if st.button("🚀 Start Video Render", use_container_width=True):
    if not topic and not custom_script: st.warning("Provide topic or script")
    else:
        task_id = str(uuid.uuid4())[:8]
        bar = st.progress(0, text="Generating script...")
        script_data = {"script": custom_script, "keywords": [topic]} if custom_script.strip() else generate_script_llm(topic, llm_provider, llm_key)
        st.info(script_data['script'])

        bar.progress(40, text="Synthesizing voice...")
        audio_file = str(TEMP_DIR / f"{task_id}.mp3")
        run_tts_safe(script_data['script'], tts_voice, audio_file)

        bar.progress(60, text="Fetching clips...")
        vids = fetch_pexels_videos(script_data.get('keywords', []), pexels_key, task_id)

        bar.progress(80, text="Rendering...")
        out = str(OUTPUT_DIR / f"TURBO_{task_id}.mp4")
        render_video_pipeline(script_data['script'], audio_file, vids, out, subtitle_pos)
        bar.progress(100, text="Done!")
        st.success("Video ready!"); st.video(out)
