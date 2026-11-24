"use client";

import { useActionState } from "react";
import { CircleX, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LookupOption } from "@/lib/lookups";
import { startDevSession, type DevStartState } from "../actions";

export function DevStartForm({ levels }: { levels: LookupOption[] }) {
  const [state, action, pending] = useActionState<DevStartState, FormData>(startDevSession, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-subheadline text-muted-foreground">Cấp</span>
          <select
            name="level"
            defaultValue=""
            className="min-h-11 rounded-xl bg-muted px-3 text-body outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Tất cả các cấp</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={pending}>
          <Play aria-hidden />
          {pending ? "Đang tạo phiên…" : "Tạo phiên 5 câu ngẫu nhiên"}
        </Button>
      </div>
      {state?.error && (
        <p role="alert" className="flex items-center gap-2 text-subheadline text-destructive">
          <CircleX className="size-5 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}
    </form>
  );
}
