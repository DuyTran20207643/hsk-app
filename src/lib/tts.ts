// Đọc to chữ Hán bằng giọng tiếng Trung phổ thông (zh-CN) có sẵn trên máy, qua Web Speech API
// của trình duyệt (không tốn tiền, không gửi dữ liệu đi đâu). Dùng chung cho Sổ từ, Thẻ từ, Ôn tập…
//
// Cách dùng trong Client Component:
//   const tts = useChineseSpeech();
//   <button disabled={!tts.available} onClick={() => tts.speak("机场")}>…</button>
//   {!tts.available && <p>{TTS_UNAVAILABLE_MESSAGE}</p>}
//
// File này không import đường dẫn "@/…" để bài test (node --test) chạy trực tiếp được.
import { useCallback, useSyncExternalStore } from "react";

export const TTS_LANG = "zh-CN";
export const TTS_UNAVAILABLE_MESSAGE =
  "Máy của bạn chưa có giọng đọc tiếng Trung nên chưa nghe được phát âm. Bạn có thể cài thêm giọng tiếng Trung trong phần cài đặt ngôn ngữ của máy.";

type VoiceLike = { lang: string; voiceURI: string; localService?: boolean };

// Mức phù hợp của một giọng (số lớn hơn là tốt hơn, 0 là không dùng được).
// Chỉ nhận tiếng Trung phổ thông giản thể; bỏ qua tiếng Quảng Đông (zh-HK, yue) và phồn thể Đài Loan.
function voiceScore(voice: VoiceLike): number {
  const lang = voice.lang.replace(/_/g, "-").toLowerCase();
  if (lang === "zh-cn") return 4;
  if (lang === "cmn-hans-cn" || lang === "cmn-cn" || lang === "zh-hans-cn") return 3;
  if (lang === "zh-hans" || lang === "cmn-hans" || lang === "cmn" || lang === "zh") return 2;
  return 0;
}

// Chọn giọng tiếng Trung tốt nhất trong danh sách giọng của máy, hoặc null nếu không có.
// Cùng mức thì ưu tiên giọng cài sẵn trên máy (đọc được cả khi mất mạng).
export function pickChineseVoice<V extends VoiceLike>(voices: readonly V[]): V | null {
  let best: V | null = null;
  let bestScore = 0;
  for (const voice of voices) {
    const score = voiceScore(voice) + (voice.localService ? 0.5 : 0);
    if (voiceScore(voice) > 0 && score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

function findVoice(): SpeechSynthesisVoice | null {
  const speech = synth();
  return speech ? pickChineseVoice(speech.getVoices()) : null;
}

// Danh sách giọng có thể tải chậm (Chrome báo qua sự kiện "voiceschanged"), nên theo dõi thay đổi
function subscribe(onChange: () => void) {
  const speech = synth();
  if (!speech) return () => {};
  speech.addEventListener("voiceschanged", onChange);
  return () => speech.removeEventListener("voiceschanged", onChange);
}

// Giá trị so sánh được giữa các lần đọc: mã của giọng (chuỗi), hoặc null nếu chưa có
const getSnapshot = () => findVoice()?.voiceURI ?? null;
const getServerSnapshot = () => null;

// Đọc to một đoạn chữ Hán. Trả về false nếu máy không có giọng tiếng Trung.
export function speakChinese(text: string, options: { rate?: number } = {}): boolean {
  const speech = synth();
  const voice = findVoice();
  if (!speech || !voice || !text.trim()) return false;
  speech.cancel(); // bấm liên tục thì dừng câu cũ, đọc câu mới
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang || TTS_LANG;
  utterance.rate = options.rate ?? 0.85; // hơi chậm một chút cho người mới học
  speech.speak(utterance);
  return true;
}

// Hook cho Client Component: available = máy có giọng tiếng Trung; speak(text) để đọc.
export function useChineseSpeech() {
  const voiceURI = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const speak = useCallback((text: string, options?: { rate?: number }) => speakChinese(text, options), []);
  return { available: voiceURI !== null, speak };
}
