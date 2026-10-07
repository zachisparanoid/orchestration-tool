/**
 * SSE stream of orchestration events for a single run.
 *
 * Strategy: tail the events table at a short interval. The DB is the source
 * of truth, so cold reconnects pick up exactly where they left off via the
 * `sinceId` cursor — no in-memory state to lose. Closes once the run reaches
 * a terminal state and no further events are pending.
 */
import { runs, events } from "@/lib/db/repos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!runs.get(id)) {
    return new Response("not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let sinceId = 0;
      let closed = false;

      const abort = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
      };
      req.signal.addEventListener("abort", abort);

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // Initial snapshot so the client has the current run + executions immediately.
      send("snapshot", {
        run: runs.get(id),
      });

      // Tail loop.
      while (!closed) {
        const batch = events.listByRun(id, sinceId);
        for (const ev of batch) {
          send(ev.type, ev);
          sinceId = ev.id;
        }
        const r = runs.get(id);
        if (r && TERMINAL.has(r.status)) {
          // Drain any final events that landed during the last poll.
          const tail = events.listByRun(id, sinceId);
          for (const ev of tail) {
            send(ev.type, ev);
            sinceId = ev.id;
          }
          send("end", { status: r.status });
          abort();
          break;
        }
        await sleep(200);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
