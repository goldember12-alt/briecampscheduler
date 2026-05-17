import { ArrowLeft, ClipboardList, Database, Download, Radio, Search, Trash2, UserPlus, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";

type UserRole = "counselor" | "admin";
type RuleType = "exclude" | "requires_review" | "preassigned_or_signed_up" | "note";
type Mode = "camper" | "staffing";
type Screen = "camperSchedule" | "assignment" | "live" | "staffingSchedule" | "staffing" | "export" | "data";

type Camper = { id: number; externalId?: string | null; name: string; active: boolean };
type Counselor = { id: number; externalId?: string | null; name: string; active: boolean };
type User = { id: number; externalId?: string | null; name: string; role: UserRole };
type ActivityRecord = {
  id: number;
  externalId?: string | null;
  name: string;
  capacity: number;
  defaultCamperCapacity: number;
  defaultCounselorCapacity: number;
  active: boolean;
  activityFamily: string;
};
type TimeSlot = {
  id: number;
  externalId?: string | null;
  date: string;
  label: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
  displayTitle?: string | null;
  description?: string | null;
};
type ScheduleBlock = TimeSlot & { offeringCount: number };
type Assignment = { id: number; camperId: number; camper: Camper };
type CounselorAssignment = { id: number; counselorId: number; counselor: Counselor };
type Offering = {
  id: number;
  externalId?: string | null;
  activityId: number;
  timeSlotId: number;
  camperCapacity: number;
  counselorCapacity: number;
  location?: string | null;
  notes?: string | null;
  activity: ActivityRecord;
  timeSlot: TimeSlot;
  assignments: Assignment[];
  counselorAssignments: CounselorAssignment[];
  camperCapacityUsed: number;
  camperCapacityRemaining: number;
  counselorCapacityUsed: number;
  counselorCapacityRemaining: number;
};
type CamperRule = {
  id: number;
  externalId?: string | null;
  activityNameRaw: string;
  activityFamily: string;
  ruleType: RuleType;
  rawValue: string;
  notes?: string | null;
  camper: Camper;
  activity?: ActivityRecord | null;
};
type DataSnapshot = {
  campers: Camper[];
  counselors: Counselor[];
  activities: ActivityRecord[];
  timeSlots: TimeSlot[];
  offerings: Offering[];
  rules: CamperRule[];
};

const csvTemplates = [
  "campers.csv",
  "counselors.csv",
  "users.csv",
  "activities.csv",
  "schedule_blocks.csv",
  "activity_offerings.csv",
  "camper_activity_rules.csv"
];

export function App({ socket }: { socket: Socket }) {
  const [screen, setScreen] = useState<Screen>("camperSchedule");
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ScheduleBlock | null>(null);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loadingOfferings, setLoadingOfferings] = useState(false);
  const [error, setError] = useState("");

  const currentUser = users.find((user) => user.id === currentUserId) ?? users[0];
  const adminUser = users.find((user) => user.role === "admin") ?? currentUser;

  useEffect(() => {
    api<User[]>("/api/users")
      .then((rows) => {
        setUsers(rows);
        setCurrentUserId((current) => current ?? rows[0]?.id ?? null);
      })
      .catch((apiError) => setError(readApiError(apiError)));
  }, []);

  async function loadOfferings(timeSlotId = selectedSlot?.id) {
    if (!timeSlotId) {
      return;
    }
    setLoadingOfferings(true);
    try {
      setOfferings(await api<Offering[]>(`/api/offerings?timeSlotId=${timeSlotId}`));
    } finally {
      setLoadingOfferings(false);
    }
  }

  useEffect(() => {
    if (selectedSlot && (screen === "assignment" || screen === "live" || screen === "staffing")) {
      loadOfferings(selectedSlot.id).catch((apiError) => setError(readApiError(apiError)));
    }
  }, [selectedSlot?.id, screen]);

  useEffect(() => {
    const handler = (payload: { timeSlotId: number }) => {
      if (payload.timeSlotId === selectedSlot?.id) {
        loadOfferings(payload.timeSlotId).catch((apiError) => setError(readApiError(apiError)));
      }
    };

    socket.on("assignments:changed", handler);
    return () => {
      socket.off("assignments:changed", handler);
    };
  }, [selectedSlot?.id, socket]);

  function openBlock(block: ScheduleBlock, mode: Mode) {
    setSelectedSlot(block);
    setOfferings([]);
    setScreen(mode === "camper" ? "assignment" : "staffing");
  }

  function backToSchedule(mode: Mode) {
    setScreen(mode === "camper" ? "camperSchedule" : "staffingSchedule");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Camp Activity Assignments</h1>
          <p>Canonical CSV setup, schedule-first assignment, real-time camper updates.</p>
        </div>
        <label className="user-picker">
          <span>Current user</span>
          <select value={currentUser?.id ?? ""} onChange={(event) => setCurrentUserId(Number(event.target.value))}>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.role})
              </option>
            ))}
          </select>
        </label>
      </header>

      <nav className="tabs" aria-label="Main screens">
        <button className={screen === "camperSchedule" || screen === "assignment" || screen === "live" ? "active" : ""} onClick={() => setScreen("camperSchedule")}>
          <ClipboardList size={18} />
          Camper Schedule
        </button>
        <button className={screen === "staffingSchedule" || screen === "staffing" ? "active" : ""} onClick={() => setScreen("staffingSchedule")}>
          <Users size={18} />
          Staffing Schedule
        </button>
        <button className={screen === "export" ? "active" : ""} onClick={() => setScreen("export")}>
          <Download size={18} />
          CSV Export
        </button>
        <button className={screen === "data" ? "active" : ""} onClick={() => setScreen("data")}>
          <Database size={18} />
          Data Import
        </button>
      </nav>

      {error ? (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      ) : null}

      {screen === "camperSchedule" ? <ScheduleScreen mode="camper" onOpenBlock={openBlock} /> : null}
      {screen === "staffingSchedule" ? <ScheduleScreen mode="staffing" onOpenBlock={openBlock} /> : null}
      {screen === "assignment" && selectedSlot ? (
        <CamperAssignmentScreen
          slot={selectedSlot}
          offerings={offerings}
          loading={loadingOfferings}
          userId={currentUser?.id}
          onBack={() => backToSchedule("camper")}
          onLive={() => setScreen("live")}
          onError={setError}
          onChanged={() => loadOfferings()}
        />
      ) : null}
      {screen === "live" && selectedSlot ? <LiveBoard slot={selectedSlot} offerings={offerings} loading={loadingOfferings} onBack={() => setScreen("assignment")} /> : null}
      {screen === "staffing" && selectedSlot ? (
        <StaffingScreen
          slot={selectedSlot}
          offerings={offerings}
          loading={loadingOfferings}
          userId={adminUser?.id}
          onBack={() => backToSchedule("staffing")}
          onError={setError}
          onChanged={() => loadOfferings()}
        />
      ) : null}
      {screen === "export" ? <ExportScreen /> : null}
      {screen === "data" ? <DataImportScreen /> : null}
    </main>
  );
}

function ScheduleScreen({ mode, onOpenBlock }: { mode: Mode; onOpenBlock: (block: ScheduleBlock, mode: Mode) => void }) {
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<string[]>("/api/schedule/dates")
      .then((rows) => {
        setDates(rows);
        setSelectedDate((current) => current || rows[0] || "");
      })
      .catch((apiError) => setError(readApiError(apiError)));
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      return;
    }
    api<ScheduleBlock[]>(`/api/schedule/dates/${selectedDate}/time-slots`)
      .then(setBlocks)
      .catch((apiError) => setError(readApiError(apiError)));
  }, [selectedDate]);

  return (
    <section className="screen">
      <div className="section-heading">
        <div>
          <h2>{mode === "camper" ? "Camper Signup Schedule" : "Counselor Staffing Schedule"}</h2>
          <p>Select a date, then open a schedule block. The assignment tools stay scoped to that block.</p>
        </div>
        <select className="date-select" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}>
          {dates.map((date) => (
            <option key={date} value={date}>
              {formatDate(date)}
            </option>
          ))}
        </select>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="schedule-grid">
        {blocks.map((block) => (
          <button key={block.id} className="schedule-card" onClick={() => onOpenBlock(block, mode)}>
            <div>
              <h3>{block.displayTitle || block.label}</h3>
              <span>{block.label}</span>
            </div>
            <strong>
              {block.startTime}-{block.endTime}
            </strong>
            {block.description ? <p>{block.description}</p> : null}
            <small>{block.offeringCount} offerings</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function CamperAssignmentScreen({
  slot,
  offerings,
  loading,
  userId,
  onBack,
  onLive,
  onError,
  onChanged
}: {
  slot: ScheduleBlock;
  offerings: Offering[];
  loading: boolean;
  userId?: number;
  onBack: () => void;
  onLive: () => void;
  onError: (message: string) => void;
  onChanged: () => void;
}) {
  return (
    <section className="screen">
      <BlockHeader slot={slot} title="Camper Signup" onBack={onBack}>
        <button className="secondary-action" onClick={onLive}>
          <Radio size={17} />
          Live Board
        </button>
      </BlockHeader>
      <OfferingGrid loading={loading} offerings={offerings}>
        {(offering) => <CamperOfferingPanel offering={offering} userId={userId} onError={onError} onChanged={onChanged} />}
      </OfferingGrid>
    </section>
  );
}

function CamperOfferingPanel({ offering, userId, onError, onChanged }: { offering: Offering; userId?: number; onError: (message: string) => void; onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Camper[]>([]);
  const [busy, setBusy] = useState(false);

  async function search(nextQuery: string) {
    setQuery(nextQuery);
    setResults(await api<Camper[]>(`/api/campers/search?offeringId=${offering.id}&q=${encodeURIComponent(nextQuery)}`));
  }

  async function assign(camperId: number) {
    if (!userId) {
      onError("No counselor user is available.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/assignments", {
        method: "POST",
        body: JSON.stringify({ camperId, offeringId: offering.id, createdByUserId: userId })
      });
      setQuery("");
      setResults([]);
      onChanged();
    } catch (apiError) {
      onError(readApiError(apiError));
    } finally {
      setBusy(false);
    }
  }

  async function remove(assignmentId: number) {
    setBusy(true);
    try {
      await api(`/api/assignments/${assignmentId}`, { method: "DELETE" });
      onChanged();
    } catch (apiError) {
      onError(readApiError(apiError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="offering-card">
      <OfferingHeader offering={offering} mode="camper" />
      <Roster rows={offering.assignments.map((assignment) => ({ id: assignment.id, name: assignment.camper.name }))} onRemove={remove} busy={busy} emptyText="No campers assigned" />
      <SearchBox value={query} onChange={search} placeholder="Search eligible campers" disabled={busy || offering.camperCapacityRemaining <= 0} />
      {results.length > 0 ? (
        <div className="result-list">
          {results.map((camper) => (
            <button key={camper.id} onClick={() => assign(camper.id)} disabled={busy}>
              <UserPlus size={16} />
              {camper.name}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function LiveBoard({ slot, offerings, loading, onBack }: { slot: ScheduleBlock; offerings: Offering[]; loading: boolean; onBack: () => void }) {
  return (
    <section className="screen">
      <BlockHeader slot={slot} title="Live Board" onBack={onBack} />
      <OfferingGrid loading={loading} offerings={offerings}>
        {(offering) => (
          <article className="offering-card live-card">
            <OfferingHeader offering={offering} mode="camper" />
            <div className="live-roster">
              {offering.assignments.length === 0 ? <span className="muted">Open</span> : offering.assignments.map((assignment) => <span key={assignment.id}>{assignment.camper.name}</span>)}
            </div>
          </article>
        )}
      </OfferingGrid>
    </section>
  );
}

function StaffingScreen({
  slot,
  offerings,
  loading,
  userId,
  onBack,
  onError,
  onChanged
}: {
  slot: ScheduleBlock;
  offerings: Offering[];
  loading: boolean;
  userId?: number;
  onBack: () => void;
  onError: (message: string) => void;
  onChanged: () => void;
}) {
  return (
    <section className="screen">
      <BlockHeader slot={slot} title="Counselor Staffing" onBack={onBack} />
      <OfferingGrid loading={loading} offerings={offerings}>
        {(offering) => <CounselorOfferingPanel offering={offering} userId={userId} onError={onError} onChanged={onChanged} />}
      </OfferingGrid>
    </section>
  );
}

function CounselorOfferingPanel({ offering, userId, onError, onChanged }: { offering: Offering; userId?: number; onError: (message: string) => void; onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Counselor[]>([]);
  const [busy, setBusy] = useState(false);

  async function search(nextQuery: string) {
    setQuery(nextQuery);
    setResults(await api<Counselor[]>(`/api/counselors/search?offeringId=${offering.id}&q=${encodeURIComponent(nextQuery)}`));
  }

  async function assign(counselorId: number) {
    if (!userId) {
      onError("No admin user is available.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/counselor-assignments", {
        method: "POST",
        body: JSON.stringify({ counselorId, offeringId: offering.id, createdByUserId: userId })
      });
      setQuery("");
      setResults([]);
      onChanged();
    } catch (apiError) {
      onError(readApiError(apiError));
    } finally {
      setBusy(false);
    }
  }

  async function remove(assignmentId: number) {
    setBusy(true);
    try {
      await api(`/api/counselor-assignments/${assignmentId}`, { method: "DELETE" });
      onChanged();
    } catch (apiError) {
      onError(readApiError(apiError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="offering-card">
      <OfferingHeader offering={offering} mode="counselor" />
      <Roster rows={offering.counselorAssignments.map((assignment) => ({ id: assignment.id, name: assignment.counselor.name }))} onRemove={remove} busy={busy} emptyText="No staff assigned" />
      <SearchBox value={query} onChange={search} placeholder="Search available counselors" disabled={busy || offering.counselorCapacityRemaining <= 0} />
      {results.length > 0 ? (
        <div className="result-list">
          {results.map((counselor) => (
            <button key={counselor.id} onClick={() => assign(counselor.id)} disabled={busy}>
              <Users size={16} />
              {counselor.name}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function ExportScreen() {
  return (
    <section className="screen export-screen">
      <div className="section-heading">
        <div>
          <h2>CSV Export</h2>
          <p>Exports the full camper schedule grouped by date, schedule block, and activity offering. Counselor names are included when staffed.</p>
        </div>
      </div>
      <div className="export-panel">
        <a className="primary-link" href="/api/export/schedule.csv">
          <Download size={18} />
          Download Schedule CSV
        </a>
      </div>
    </section>
  );
}

function DataImportScreen() {
  const [data, setData] = useState<DataSnapshot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<Camper[]>("/api/campers"),
      api<Counselor[]>("/api/counselors"),
      api<ActivityRecord[]>("/api/activities"),
      api<TimeSlot[]>("/api/time-slots"),
      api<Offering[]>("/api/offerings"),
      api<CamperRule[]>("/api/camper-activity-rules")
    ])
      .then(([campers, counselors, activities, timeSlots, offerings, rules]) => setData({ campers, counselors, activities, timeSlots, offerings, rules }))
      .catch((apiError) => setError(readApiError(apiError)));
  }, []);

  if (error) {
    return <div className="error-banner">{error}</div>;
  }

  if (!data) {
    return <div className="screen">Loading setup data</div>;
  }

  return (
    <section className="screen data-screen">
      <div className="section-heading">
        <div>
          <h2>Canonical CSV Setup</h2>
          <p>Camp setup comes from strict CSV templates in data/templates. Filled CSVs go in data/import and load with npm run load:csv.</p>
        </div>
      </div>
      <div className="import-note">
        <Database size={20} />
        <span>The loader validates every file before writing. If any row fails, the database is not modified.</span>
      </div>
      <DataTable title="Expected CSV Files" rows={csvTemplates.map((name) => [name])} />
      <DataTable title="Campers" rows={data.campers.map((row) => [row.externalId ?? "", row.name, row.active ? "active" : "inactive"])} />
      <DataTable title="Counselors" rows={data.counselors.map((row) => [row.externalId ?? "", row.name, row.active ? "active" : "inactive"])} />
      <DataTable title="Activities" rows={data.activities.map((row) => [row.externalId ?? "", row.name, row.activityFamily, `campers ${row.defaultCamperCapacity}`, `staff ${row.defaultCounselorCapacity}`])} />
      <DataTable title="Schedule Blocks" rows={data.timeSlots.map((row) => [row.externalId ?? "", formatDate(row.date), row.displayTitle ?? row.label, `${row.startTime}-${row.endTime}`])} />
      <DataTable title="Offerings" rows={data.offerings.map((row) => [row.externalId ?? "", row.timeSlot.displayTitle ?? row.timeSlot.label, row.activity.name, `campers ${row.camperCapacity}`, `staff ${row.counselorCapacity}`, row.location ?? ""])} />
      <DataTable title="Camper Activity Rules" rows={data.rules.map((row) => [row.externalId ?? "", row.camper.name, row.activityFamily, row.ruleType, row.rawValue, row.notes ?? ""])} />
    </section>
  );
}

function BlockHeader({ slot, title, onBack, children }: { slot: TimeSlot; title: string; onBack: () => void; children?: ReactNode }) {
  return (
    <div className="block-header">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={18} />
        Back
      </button>
      <div>
        <h2>{title}: {slot.displayTitle || slot.label}</h2>
        <p>
          {formatDate(slot.date)} | {slot.label} | {slot.startTime}-{slot.endTime}
        </p>
        {slot.description ? <p>{slot.description}</p> : null}
      </div>
      <div className="view-actions">{children}</div>
    </div>
  );
}

function OfferingGrid({ loading, offerings, children }: { loading: boolean; offerings: Offering[]; children: (offering: Offering) => ReactNode }) {
  if (loading) {
    return <div className="status-line">Loading offerings</div>;
  }

  return <div className="offering-grid">{offerings.map((offering) => children(offering))}</div>;
}

function OfferingHeader({ offering, mode }: { offering: Offering; mode: "camper" | "counselor" }) {
  const used = mode === "camper" ? offering.camperCapacityUsed : offering.counselorCapacityUsed;
  const capacity = mode === "camper" ? offering.camperCapacity : offering.counselorCapacity;
  const remaining = mode === "camper" ? offering.camperCapacityRemaining : offering.counselorCapacityRemaining;
  const label = mode === "camper" ? "camper" : "staff";

  return (
    <div className="offering-head">
      <div>
        <h3>{offering.activity.name}</h3>
        <span>
          {used}/{capacity} {label} used | {remaining} open
        </span>
        {offering.location ? <small>{offering.location}</small> : null}
        {offering.notes ? <small>{offering.notes}</small> : null}
      </div>
      <CapacityMeter used={used} capacity={capacity} />
    </div>
  );
}

function CapacityMeter({ used, capacity }: { used: number; capacity: number }) {
  const percent = capacity === 0 ? 100 : Math.min(100, Math.round((used / capacity) * 100));
  return (
    <div className="meter" aria-label={`${used} of ${capacity} used`}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function Roster({ rows, onRemove, busy, emptyText }: { rows: Array<{ id: number; name: string }>; onRemove: (id: number) => void; busy: boolean; emptyText: string }) {
  if (rows.length === 0) {
    return <p className="empty">{emptyText}</p>;
  }

  return (
    <ul className="roster">
      {rows.map((row) => (
        <li key={row.id}>
          <span>{row.name}</span>
          <button aria-label={`Remove ${row.name}`} onClick={() => onRemove(row.id)} disabled={busy}>
            <Trash2 size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function SearchBox({ value, onChange, placeholder, disabled }: { value: string; onChange: (value: string) => void; placeholder: string; disabled?: boolean }) {
  return (
    <label className="search-box">
      <Search size={16} />
      <input value={value} onChange={(event) => onChange(event.target.value)} onFocus={() => onChange(value)} placeholder={placeholder} disabled={disabled} />
    </label>
  );
}

function DataTable({ title, rows }: { title: string; rows: string[][] }) {
  const visibleRows = rows.slice(0, 12);
  return (
    <section className="data-table">
      <h3>
        {title} <span>{rows.length}</span>
      </h3>
      <div>
        {visibleRows.map((row, index) => (
          <p key={`${title}-${index}`}>
            {row.map((cell, cellIndex) => (
              <span key={`${title}-${index}-${cellIndex}`}>{cell}</span>
            ))}
          </p>
        ))}
        {rows.length > visibleRows.length ? <p className="muted">Showing {visibleRows.length} of {rows.length}</p> : null}
      </div>
    </section>
  );
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload as T;
}

function readApiError(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
