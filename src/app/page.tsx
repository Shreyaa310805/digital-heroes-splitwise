"use client";
import { useState, useId } from "react";
// ─── Types ────────────────────────────────────────────────────────────────────
interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  splitAmong: string[];
}
interface Transaction {
  from: string;
  to: string;
  amount: number;
}
// ─── Greedy minimum-transactions algorithm ────────────────────────────────────
function computeMinTransactions(
  people: string[],
  expenses: Expense[]
): Transaction[] {
  const balances: Record<string, number> = {};
  people.forEach((p) => (balances[p] = 0));
  expenses.forEach((expense) => {
    if (!expense.paidBy || expense.splitAmong.length === 0) return;
    const share = expense.amount / expense.splitAmong.length;
    balances[expense.paidBy] = (balances[expense.paidBy] ?? 0) + expense.amount;
    expense.splitAmong.forEach((person) => {
      balances[person] = (balances[person] ?? 0) - share;
    });
  });
  const debtors: { name: string; amount: number }[] = [];
  const creditors: { name: string; amount: number }[] = [];
  Object.entries(balances).forEach(([name, balance]) => {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded < -0.001) debtors.push({ name, amount: -rounded });
    else if (rounded > 0.001) creditors.push({ name, amount: rounded });
  });
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);
  const transactions: Transaction[] = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);
    transactions.push({
      from: debtor.name,
      to: creditor.name,
      amount: Math.round(amount * 100) / 100,
    });
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount < 0.001) i++;
    if (creditor.amount < 0.001) j++;
  }
  return transactions;
}
// ─── Avatar helper ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "from-violet-500 to-purple-600",
  "from-pink-500 to-rose-600",
  "from-cyan-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-fuchsia-500 to-pink-600",
];
function avatarGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "w-10 h-10 text-base" : size === "md" ? "w-8 h-8 text-sm" : "w-7 h-7 text-xs";
  return (
    <span
      className={`${sz} rounded-full bg-gradient-to-br ${avatarGradient(name)} flex items-center justify-center font-bold text-white shrink-0 shadow-md`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
// ─── Main Component ────────────────────────────────────────────────────────────
export default function SplitBillApp() {
  const uid = useId();
  const [people, setPeople] = useState<string[]>([]);
  const [newPerson, setNewPerson] = useState("");
  const [personError, setPersonError] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState({
    description: "",
    amount: "",
    paidBy: "",
    splitAmong: [] as string[],
  });
  const [formError, setFormError] = useState("");
  // ── People actions ──────────────────────────────────────────────────────────
  function addPerson() {
    const name = newPerson.trim();
    if (!name) { setPersonError("Name cannot be empty."); return; }
    if (people.map((p) => p.toLowerCase()).includes(name.toLowerCase())) {
      setPersonError("This person is already added."); return;
    }
    setPeople((prev) => [...prev, name]);
    setNewPerson("");
    setPersonError("");
  }
  function removePerson(name: string) {
    setPeople((prev) => prev.filter((p) => p !== name));
    setExpenses((prev) =>
      prev.map((e) => ({
        ...e,
        splitAmong: e.splitAmong.filter((p) => p !== name),
        paidBy: e.paidBy === name ? "" : e.paidBy,
      }))
    );
    setForm((prev) => ({
      ...prev,
      splitAmong: prev.splitAmong.filter((p) => p !== name),
      paidBy: prev.paidBy === name ? "" : prev.paidBy,
    }));
  }
  // ── Expense actions ─────────────────────────────────────────────────────────
  function toggleSplit(name: string) {
    setForm((prev) => ({
      ...prev,
      splitAmong: prev.splitAmong.includes(name)
        ? prev.splitAmong.filter((p) => p !== name)
        : [...prev.splitAmong, name],
    }));
  }
  function selectAll() {
    setForm((prev) => ({ ...prev, splitAmong: [...people] }));
  }
  function clearAll() {
    setForm((prev) => ({ ...prev, splitAmong: [] }));
  }
  function addExpense() {
    const amount = parseFloat(form.amount);
    if (!form.description.trim()) { setFormError("Please enter a description."); return; }
    if (isNaN(amount) || amount <= 0) { setFormError("Please enter a valid amount."); return; }
    if (!form.paidBy) { setFormError("Please select who paid."); return; }
    if (form.splitAmong.length === 0) { setFormError("Please select at least one person to split with."); return; }
    setExpenses((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        description: form.description.trim(),
        amount,
        paidBy: form.paidBy,
        splitAmong: form.splitAmong,
      },
    ]);
    setForm((prev) => ({ ...prev, description: "", amount: "" }));
    setFormError("");
  }
  function removeExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }
  // ── Results ─────────────────────────────────────────────────────────────────
  const transactions = computeMinTransactions(people, expenses);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  // ── Net balances for summary card ───────────────────────────────────────────
  const balanceSummary: { name: string; net: number }[] = people.map((p) => {
    let net = 0;
    expenses.forEach((e) => {
      if (!e.paidBy || e.splitAmong.length === 0) return;
      if (e.paidBy === p) net += e.amount;
      if (e.splitAmong.includes(p)) net -= e.amount / e.splitAmong.length;
    });
    return { name: p, net: Math.round(net * 100) / 100 };
  });
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080b14] text-white" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[100px]" />
        <div className="absolute -bottom-40 left-1/3 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[100px]" />
      </div>
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <header className="mb-10">
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Branding */}
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 shadow-lg shadow-violet-500/30">
                  <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-violet-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                    SplitWise
                  </h1>
                  <p className="text-sm text-white/50 mt-0.5">Smart bill splitting made effortless</p>
                </div>
              </div>
              {/* Credentials + CTA */}
              <div className="flex flex-col gap-3 sm:items-end">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-600 text-sm font-bold shadow-md">
                    SG
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white leading-tight">Shreyaa G</p>
                    <p className="text-xs text-violet-300/80">shreyaagiridhar31@gmail.com</p>
                  </div>
                </div>
                <a
                  id="digital-heroes-btn"
                  href="https://digitalheroesco.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/40 transition-all duration-200 hover:scale-105 hover:shadow-purple-500/60 hover:brightness-110 active:scale-95"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Built for Digital Heroes
                </a>
              </div>
            </div>
          </div>
        </header>
        {/* ── Stats Bar ───────────────────────────────────────────────────────── */}
        {(people.length > 0 || expenses.length > 0) && (
          <div className="mb-6 grid grid-cols-3 gap-3">
            {[
              { label: "People", value: people.length, icon: "👥" },
              { label: "Expenses", value: expenses.length, icon: "🧾" },
              { label: "Total Spent", value: `₹${totalSpent.toFixed(2)}`, icon: "💰" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 text-center transition-all duration-200 hover:border-violet-500/30 hover:bg-white/8">
                <div className="text-xl mb-1">{stat.icon}</div>
                <div className="text-lg font-bold text-white">{stat.value}</div>
                <div className="text-xs text-white/40 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            {/* Add People */}
            <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                <h2 className="text-base font-semibold text-white/90">People</h2>
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  id={`${uid}-person-input`}
                  type="text"
                  value={newPerson}
                  onChange={(e) => { setNewPerson(e.target.value); setPersonError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && addPerson()}
                  placeholder="Enter a name…"
                  className="flex-1 rounded-xl border border-white/10 bg-white/8 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-all duration-200 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
                />
                <button
                  id={`${uid}-add-person-btn`}
                  onClick={addPerson}
                  className="flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:scale-105 active:scale-95 shadow-md shadow-violet-500/20"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </button>
              </div>
              {personError && (
                <p className="text-xs text-rose-400 mb-3 flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {personError}
                </p>
              )}
              {people.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 py-8 text-center">
                  <div className="text-3xl mb-2">👤</div>
                  <p className="text-sm text-white/30">No people added yet</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {people.map((person) => (
                    <li
                      key={person}
                      className="flex items-center justify-between rounded-xl border border-white/8 bg-white/5 px-4 py-2.5 transition-all duration-150 hover:border-white/15 hover:bg-white/8 group"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={person} />
                        <span className="text-sm font-medium text-white/90">{person}</span>
                      </div>
                      <button
                        onClick={() => removePerson(person)}
                        className="rounded-lg p-1.5 text-white/20 transition-all hover:bg-rose-500/20 hover:text-rose-400 opacity-0 group-hover:opacity-100"
                        aria-label={`Remove ${person}`}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {/* Add Expense */}
            <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/20 text-pink-300">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                </span>
                <h2 className="text-base font-semibold text-white/90">Add Expense</h2>
              </div>
              {people.length < 2 ? (
                <div className="rounded-xl border border-dashed border-white/10 py-8 text-center">
                  <div className="text-3xl mb-2">✋</div>
                  <p className="text-sm text-white/30">Add at least 2 people first</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Description */}
                  <div>
                    <label htmlFor={`${uid}-desc`} className="block text-xs font-medium text-white/50 mb-1.5">Description</label>
                    <input
                      id={`${uid}-desc`}
                      type="text"
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && addExpense()}
                      placeholder="e.g. Dinner at restaurant"
                      className="w-full rounded-xl border border-white/10 bg-white/8 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>
                  {/* Amount */}
                  <div>
                    <label htmlFor={`${uid}-amount`} className="block text-xs font-medium text-white/50 mb-1.5">Amount (₹)</label>
                    <input
                      id={`${uid}-amount`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && addExpense()}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-white/10 bg-white/8 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>
                  {/* Paid By */}
                  <div>
                    <label htmlFor={`${uid}-paid-by`} className="block text-xs font-medium text-white/50 mb-1.5">Paid by</label>
                    <select
                      id={`${uid}-paid-by`}
                      value={form.paidBy}
                      onChange={(e) => setForm((p) => ({ ...p, paidBy: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-[#0f1220] px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 appearance-none cursor-pointer"
                    >
                      <option value="" disabled>Select person…</option>
                      {people.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  {/* Split Among */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-white/50">Split among</span>
                      <div className="flex gap-2 text-xs">
                        <button onClick={selectAll} className="text-violet-400 hover:text-violet-300 transition-colors">All</button>
                        <span className="text-white/20">·</span>
                        <button onClick={clearAll} className="text-white/30 hover:text-white/50 transition-colors">None</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {people.map((person) => {
                        const checked = form.splitAmong.includes(person);
                        return (
                          <label
                            key={person}
                            htmlFor={`${uid}-split-${person}`}
                            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 cursor-pointer transition-all duration-150 select-none ${
                              checked
                                ? "border-violet-500/50 bg-violet-500/15"
                                : "border-white/8 bg-white/5 hover:border-white/15 hover:bg-white/8"
                            }`}
                          >
                            <input
                              id={`${uid}-split-${person}`}
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSplit(person)}
                              className="sr-only"
                            />
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${checked ? "border-violet-500 bg-violet-500" : "border-white/20 bg-white/5"}`}>
                              {checked && (
                                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <Avatar name={person} size="sm" />
                            <span className="text-xs font-medium text-white/80 truncate">{person}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  {formError && (
                    <p className="text-xs text-rose-400 flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      {formError}
                    </p>
                  )}
                  <button
                    id={`${uid}-add-expense-btn`}
                    onClick={addExpense}
                    className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Add Expense
                  </button>
                </div>
              )}
            </section>
          </div>
          {/* ── RIGHT COLUMN ─────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            {/* Expenses List */}
            <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </span>
                <h2 className="text-base font-semibold text-white/90">Expenses</h2>
                {expenses.length > 0 && (
                  <span className="ml-auto text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 px-2.5 py-0.5">
                    {expenses.length}
                  </span>
                )}
              </div>
              {expenses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
                  <div className="text-3xl mb-2">🧾</div>
                  <p className="text-sm text-white/30">No expenses added yet</p>
                </div>
              ) : (
                <ul className="space-y-3 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                  {expenses.map((expense) => {
                    const perPerson = expense.splitAmong.length > 0
                      ? expense.amount / expense.splitAmong.length
                      : 0;
                    return (
                      <li
                        key={expense.id}
                        className="rounded-xl border border-white/8 bg-white/5 p-4 transition-all hover:border-white/15 group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{expense.description}</p>
                            <p className="text-xs text-white/40 mt-0.5">
                              Paid by <span className="text-violet-300 font-medium">{expense.paidBy}</span>
                              {" · "}₹{perPerson.toFixed(2)} each
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {expense.splitAmong.map((p) => (
                                <span key={p} className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/60">
                                  <Avatar name={p} size="sm" />
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-base font-bold text-white">₹{expense.amount.toFixed(2)}</span>
                            <button
                              onClick={() => removeExpense(expense.id)}
                              className="rounded-lg p-1 text-white/20 hover:bg-rose-500/20 hover:text-rose-400 transition-all opacity-0 group-hover:opacity-100"
                              aria-label="Remove expense"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            {/* Balance Summary */}
            {people.length > 0 && expenses.length > 0 && (
              <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                    </svg>
                  </span>
                  <h2 className="text-base font-semibold text-white/90">Net Balances</h2>
                </div>
                <ul className="space-y-2">
                  {balanceSummary.map(({ name, net }) => (
                    <li key={name} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={name} size="sm" />
                        <span className="text-sm text-white/70">{name}</span>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${net > 0.001 ? "text-emerald-400" : net < -0.001 ? "text-rose-400" : "text-white/30"}`}>
                        {net > 0.001 ? `+₹${net.toFixed(2)}` : net < -0.001 ? `-₹${Math.abs(net).toFixed(2)}` : "Settled"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {/* Settlement Transactions */}
            <section className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-900/20 to-purple-900/10 backdrop-blur-xl p-6 shadow-xl shadow-violet-500/10">
              <div className="flex items-center gap-3 mb-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </span>
                <h2 className="text-base font-semibold text-white/90">Settlements</h2>
                {transactions.length > 0 && (
                  <span className="ml-auto text-xs font-semibold rounded-full bg-violet-500/20 text-violet-300 px-2.5 py-0.5">
                    {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {transactions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-violet-500/20 py-10 text-center">
                  {expenses.length === 0 ? (
                    <>
                      <div className="text-3xl mb-2">⚡</div>
                      <p className="text-sm text-white/30">Add expenses to see settlements</p>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl mb-2">🎉</div>
                      <p className="text-sm text-emerald-400 font-medium">Everyone is settled up!</p>
                    </>
                  )}
                </div>
              ) : (
                <ul className="space-y-3">
                  {transactions.map((tx, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-3 rounded-xl border border-violet-500/15 bg-violet-500/8 px-4 py-3 transition-all hover:border-violet-500/30 hover:bg-violet-500/12"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Avatar name={tx.from} size="md" />
                        <span className="text-sm font-medium text-white/80 truncate">{tx.from}</span>
                      </div>
                      <div className="flex flex-col items-center shrink-0">
                        <span className="text-base font-bold text-violet-300">₹{tx.amount.toFixed(2)}</span>
                        <svg className="h-4 w-4 text-violet-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>
                      <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                        <span className="text-sm font-medium text-white/80 truncate">{tx.to}</span>
                        <Avatar name={tx.to} size="md" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {transactions.length > 0 && (
                <p className="mt-4 text-center text-xs text-white/30">
                  Minimum transactions via greedy balance matching
                </p>
              )}
            </section>
          </div>
        </div>
        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <footer className="mt-10 text-center text-xs text-white/20">
          <p>Built with Next.js · React 19 · Tailwind CSS 4</p>
          <p className="mt-1">Made with ❤️ for Digital Heroes</p>
        </footer>
      </div>
    </div>
  );
}
