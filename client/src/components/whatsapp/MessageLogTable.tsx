/**
 * Recent WhatsApp traffic across every store.
 *
 * Transport-agnostic by design: it reads the message log, which both the Meta
 * and GOWA paths write to. "Did this merchant's message actually go out, and
 * what did WhatsApp say about it" is the first question in almost every support
 * conversation, and answering it should not begin with working out which
 * transport that store was on.
 *
 * Delivery status is the useful column: on GOWA it is populated purely by
 * `message.ack` webhooks, so a row stuck at `sent` is itself a signal that
 * acks are not coming back.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type WhatsAppMessageLogItem,
  listWhatsAppMessages,
} from "@/services/whatsappGowaApi";

type DirFilter = "all" | "outbound" | "inbound";

function StatusBadge({ status, error }: { status: string; error?: string | null }) {
  const s = (status || "").toLowerCase();
  if (s === "failed") {
    return (
      <Badge variant="destructive" title={error ?? undefined}>
        failed{error ? ` · ${error}` : ""}
      </Badge>
    );
  }
  if (s === "read") {
    return <Badge className="bg-green-600 hover:bg-green-700">read</Badge>;
  }
  if (s === "delivered") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-700">delivered</Badge>;
  }
  // `sent` with no later ack is worth noticing rather than styling as success.
  return <Badge variant="secondary">{s || "unknown"}</Badge>;
}

export function MessageLogTable({ storeId }: { storeId?: string }) {
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<DirFilter>("all");

  const query = useQuery({
    queryKey: ["wa-messages", storeId ?? "all", direction],
    queryFn: () =>
      listWhatsAppMessages({
        storeId,
        direction: direction === "all" ? undefined : direction,
        limit: 50,
      }),
    refetchInterval: 20000,
    retry: false,
  });

  const rows: WhatsAppMessageLogItem[] = query.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold">Message log</CardTitle>
        <div className="flex items-center gap-2">
          {(["all", "outbound", "inbound"] as DirFilter[]).map((d) => (
            <Button
              key={d}
              size="sm"
              variant={direction === d ? "default" : "outline"}
              onClick={() => setDirection(d)}
            >
              {d}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh messages"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["wa-messages"] })
            }
          >
            <RefreshCw
              className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {query.isError && (
          <p className="rounded bg-destructive/10 p-2 text-sm text-destructive">
            Could not load messages:{" "}
            {(query.error as Error)?.message ?? "request failed"}
          </p>
        )}

        {!query.isError && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {query.isLoading ? "Loading…" : "No messages yet."}
          </p>
        )}

        <div className="space-y-1.5">
          {rows.map((m, i) => (
            <div
              key={`${m.message_id ?? i}-${m.created_at}`}
              className="flex items-start justify-between gap-3 rounded-md border p-2.5"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                {m.direction === "inbound" ? (
                  <ArrowDownLeft className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                ) : (
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="font-medium">{m.phone}</span>
                    {m.store_name && (
                      <span className="text-muted-foreground">
                        · {m.store_name}
                      </span>
                    )}
                    {m.template_name && (
                      <code className="rounded bg-muted px-1 text-[11px]">
                        {m.template_name}
                      </code>
                    )}
                  </div>
                  {m.content && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {m.content}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusBadge status={m.status} error={m.error_code} />
                <span className="text-[11px] text-muted-foreground">
                  {m.created_at
                    ? new Date(m.created_at).toLocaleString()
                    : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default MessageLogTable;
