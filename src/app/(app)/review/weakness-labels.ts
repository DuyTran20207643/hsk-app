// Tên hiển thị của một nhóm điểm yếu: dạng câu, chủ đề hoặc ngữ pháp. Chạy ở máy chủ.
import { getTopicOptions } from "@/lib/lookups";
import { QUESTION_TYPE_LABEL } from "@/lib/questions/types";
import type { createClient } from "@/lib/supabase/server";
import type { WeaknessTarget } from "@/lib/weakness";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type WeaknessLabel = { kind: string; name: string };

const KIND_LABEL = { type: "Dạng câu", topic: "Chủ đề", grammar: "Ngữ pháp" } as const;

/** Tên của các nhóm, theo khóa ("topic:3" → { kind: "Chủ đề", name: "Đi lại" }) */
export async function loadWeaknessLabels(
  supabase: ServerClient,
  targets: readonly WeaknessTarget[],
): Promise<Map<string, WeaknessLabel>> {
  const grammarIds = targets.flatMap((t) => (t.kind === "grammar" ? [t.value] : []));
  const [topics, grammar] = await Promise.all([
    targets.some((t) => t.kind === "topic") ? getTopicOptions() : Promise.resolve([]),
    grammarIds.length > 0
      ? supabase.from("grammar_points").select("id, title").in("id", grammarIds)
      : Promise.resolve({ data: [] as { id: number; title: string }[], error: null }),
  ]);
  if (grammar.error) console.error("[review] Không tải được tên ngữ pháp:", grammar.error);
  const topicName = new Map(topics.map((t) => [t.id, t.name]));
  const grammarName = new Map((grammar.data ?? []).map((g) => [g.id, g.title]));

  const out = new Map<string, WeaknessLabel>();
  for (const t of targets) {
    const name =
      t.kind === "type"
        ? QUESTION_TYPE_LABEL[t.value]
        : t.kind === "topic"
          ? (topicName.get(t.value) ?? "Một chủ đề")
          : (grammarName.get(t.value) ?? "Một điểm ngữ pháp");
    out.set(`${t.kind}:${t.value}`, { kind: KIND_LABEL[t.kind], name });
  }
  return out;
}
