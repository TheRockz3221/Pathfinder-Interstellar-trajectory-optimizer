"use client";

import { Download, FileJson, Table } from "lucide-react";
import { exportMissionJson, exportSimulationCsv, downloadTextFile } from "@/lib/export/report";
import { saveMissionSnapshot } from "@/lib/supabase/missions";
import type { MissionConfig, TrajectoryResult } from "@/lib/types";
import { useState } from "react";

export function ExportPanel({ mission, result }: { mission: MissionConfig; result: TrajectoryResult }) {
  const slug = mission.missionName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const [message, setMessage] = useState("");

  const save = async () => {
    setMessage("Saving...");
    try {
      const id = await saveMissionSnapshot(mission, result);
      setMessage(`Saved mission ${id.slice(0, 8)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save mission.");
    }
  };

  return (
    <section className="glass rounded-lg p-4">
      <div className="mb-3 flex items-center gap-2">
        <Download size={17} className="text-cyan-signal" />
        <h2 className="text-base font-semibold text-white">Mission Exports</h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <button
          onClick={() => downloadTextFile(`${slug}.json`, exportMissionJson(mission, result), "application/json")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-signal/25 bg-cyan-signal/10 px-3 text-sm text-cyan-soft transition hover:bg-cyan-signal/15"
        >
          <FileJson size={16} />
          JSON report
        </button>
        <button
          onClick={() => downloadTextFile(`${slug}-simulation.csv`, exportSimulationCsv(result), "text/csv")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-gold-mission/25 bg-gold-mission/10 px-3 text-sm text-gold-mission transition hover:bg-gold-mission/15"
        >
          <Table size={16} />
          CSV telemetry
        </button>
        <button
          onClick={save}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-emerald/25 bg-emerald/10 px-3 text-sm text-emerald transition hover:bg-emerald/15"
        >
          <Download size={16} />
          Save
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-slate-300">{message}</p>}
    </section>
  );
}
