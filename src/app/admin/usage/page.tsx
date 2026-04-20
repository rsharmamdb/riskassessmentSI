"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui";

interface EventDoc {
  _id?: string;
  event: string;
  account?: string;
  salesforceId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  ts: string;
}

interface Stat { label: string; value: string | number }

function StatCard({ label, value }: Stat) {
  return (
    <div className="border border-ink-800 bg-ink-900 px-5 py-4" style={{ borderRadius: '3px' }}>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-ink-400 mt-1">{label}</div>
    </div>
  );
}

const EVENT_LABELS: Record<string, string> = {
  account_opened: "Account opened",
  artifacts_gathered: "Artifacts gathered",
  report_generated: "Report generated (LLM)",
  report_viewed_cached: "Report viewed (cache)",
  pdf_exported: "PDF exported",
  report_page_viewed: "Report page viewed",
  lgtm_approved: "LGTM approved",
};

export default function UsagePage() {
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/track?limit=2000")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setEvents(j.events ?? []);
        else setError(j.error ?? "Failed to load");
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  // Aggregate stats
  const total = events.length;
  const llmCalls = events.filter((e) => e.event === "report_generated").length;
  const cacheHits = events.filter((e) => e.event === "report_viewed_cached").length;
  const cacheRate = total ? `${Math.round((cacheHits / (llmCalls + cacheHits || 1)) * 100)}%` : "—";
  const uniqueAccounts = new Set(events.map((e) => e.account).filter(Boolean)).size;
  const uniqueUsers = new Set(events.map((e) => e.userId).filter(Boolean)).size;
  const pdfs = events.filter((e) => e.event === "pdf_exported").length;

  // Accounts with no LLM report in > 30 days
  const lastReportByAccount: Record<string, number> = {};
  for (const e of events) {
    if (e.event === "report_generated" && e.account) {
      const t = new Date(e.ts).getTime();
      if (!lastReportByAccount[e.account] || t > lastReportByAccount[e.account]) {
        lastReportByAccount[e.account] = t;
      }
    }
  }
  const staleCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const staleAccounts = Object.entries(lastReportByAccount)
    .filter(([, t]) => t < staleCutoff)
    .map(([a]) => a);

  // Event breakdown
  const byEvent = Object.entries(
    events.reduce<Record<string, number>>((acc, e) => {
      acc[e.event] = (acc[e.event] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  // Top accounts by activity
  const byAccount = Object.entries(
    events.reduce<Record<string, number>>((acc, e) => {
      if (e.account) acc[e.account] = (acc[e.account] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Recent events
  const recent = events.slice(0, 50);

  if (loading) {
    return <div className="text-ink-400 text-sm py-16 text-center">Loading usage data…</div>;
  }
  if (error) {
    return (
      <div className="border border-[#be6464] px-4 py-3 text-sm text-[#be6464] bg-[#fdf5f5]" style={{ borderRadius: '3px' }}>
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usage Dashboard</h1>
        <p className="text-sm text-ink-400 mt-1">All-time activity across accounts and users.</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total events" value={total} />
        <StatCard label="LLM calls" value={llmCalls} />
        <StatCard label="Cache hit rate" value={cacheRate} />
        <StatCard label="Unique accounts" value={uniqueAccounts} />
        <StatCard label="Unique users" value={uniqueUsers} />
        <StatCard label="PDFs exported" value={pdfs} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Event breakdown */}
        <Card>
          <CardHeader title="Events by type" />
          <CardBody>
            <div className="space-y-2">
              {byEvent.map(([evt, count]) => {
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={evt}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-ink-200">{EVENT_LABELS[evt] ?? evt}</span>
                      <span className="text-ink-400 tabular-nums">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-ink-800 rounded-full h-1">
                      <div className="bg-accent-500 h-1 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* Top accounts */}
        <Card>
          <CardHeader title="Most active accounts" />
          <CardBody>
            <div className="space-y-2">
              {byAccount.map(([account, count]) => (
                <div key={account} className="flex justify-between items-center text-sm">
                  <span className="text-ink-200 truncate max-w-[180px]">{account}</span>
                  <span className="text-ink-400 tabular-nums text-xs">{count} events</span>
                </div>
              ))}
              {byAccount.length === 0 && <div className="text-ink-500 text-xs">No data</div>}
            </div>
          </CardBody>
        </Card>

        {/* Stale accounts */}
        <Card>
          <CardHeader title="No report in 30+ days" />
          <CardBody>
            {staleAccounts.length === 0 ? (
              <div className="text-[#8dc572] text-sm">All accounts reported recently ✓</div>
            ) : (
              <div className="space-y-1">
                {staleAccounts.map((a) => (
                  <div key={a} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-[#f0ad4e] flex-shrink-0" />
                    <span className="text-ink-200">{a}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Recent events table */}
      <Card>
        <CardHeader title="Recent events" subtitle="Last 50 events, newest first" />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-ink-800 text-ink-400">
                  <th className="text-left pb-2 pr-4">Time</th>
                  <th className="text-left pb-2 pr-4">Event</th>
                  <th className="text-left pb-2 pr-4">Account</th>
                  <th className="text-left pb-2 pr-4">User</th>
                  <th className="text-left pb-2">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((e, i) => (
                  <tr key={i} className="border-b border-ink-800/50 hover:bg-ink-800/20">
                    <td className="py-2 pr-4 text-ink-400 whitespace-nowrap">
                      {new Date(e.ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-2 pr-4 text-ink-200 whitespace-nowrap">
                      {EVENT_LABELS[e.event] ?? e.event}
                    </td>
                    <td className="py-2 pr-4 text-ink-300 truncate max-w-[140px]">
                      {e.account ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-ink-500 font-mono">
                      {e.userId ? e.userId.slice(0, 12) : "—"}
                    </td>
                    <td className="py-2 text-ink-500 truncate max-w-[200px]">
                      {e.metadata ? JSON.stringify(e.metadata).slice(0, 80) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
