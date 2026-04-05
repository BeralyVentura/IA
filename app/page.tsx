"use client";

import { ChangeEvent, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

type Expense = {
  id: number;
  amount: number;
  description: string;
  category: string;
  expenseType: "Necesario" | "Discrecional";
  antExpense: boolean;
  reason?: string;
  date: string;
};

type AnalysisResponse = {
  overallStatus: string;
  riskLevel: "Bajo" | "Medio" | "Alto";
  topCategory: string;
  discretionaryInsight: string;
  estimatedSavings: string;
  recommendations: {
    title: string;
    description: string;
  }[];
};

const PIE_COLORS = [
  "#0f172a",
  "#334155",
  "#475569",
  "#64748b",
  "#94a3b8",
  "#cbd5e1",
  "#1e293b",
  "#7c8aa0",
];

export default function HomePage() {
  const [budget, setBudget] = useState<number>(300);
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [classifyingExpense, setClassifyingExpense] = useState<boolean>(false);
  const [readingImage, setReadingImage] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);

  const totalSpent = useMemo(() => {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);

  const remaining = useMemo(() => {
    return budget - totalSpent;
  }, [budget, totalSpent]);

  const percentageUsed = useMemo(() => {
    if (budget <= 0) return 0;
    return Math.min((totalSpent / budget) * 100, 100);
  }, [budget, totalSpent]);

  const groupedByCategory = useMemo(() => {
    const grouped: Record<string, number> = {};

    for (const expense of expenses) {
      grouped[expense.category] = (grouped[expense.category] || 0) + expense.amount;
    }

    return Object.entries(grouped)
      .map(([category, total]) => ({
        category,
        total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  const discretionaryTotal = useMemo(() => {
    return expenses
      .filter((expense) => expense.expenseType === "Discrecional")
      .reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);

  const necessaryTotal = useMemo(() => {
    return expenses
      .filter((expense) => expense.expenseType === "Necesario")
      .reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);

  const expenseTypeData = useMemo(() => {
    return [
      { name: "Necesario", total: necessaryTotal },
      { name: "Discrecional", total: discretionaryTotal },
    ];
  }, [necessaryTotal, discretionaryTotal]);

  const budgetProgressData = useMemo(() => {
    return [
      { name: "Gastado", total: totalSpent },
      { name: "Disponible", total: remaining > 0 ? remaining : 0 },
    ];
  }, [totalSpent, remaining]);

  const addExpenseWithAI = async () => {
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0 || !description.trim()) {
      return;
    }

    try {
      setClassifyingExpense(true);

      const response = await fetch("/api/classify-expense", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: numericAmount,
          description: description.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo clasificar el gasto.");
      }

      const data = await response.json();

      const newExpense: Expense = {
        id: Date.now(),
        amount: numericAmount,
        description: description.trim(),
        category: data.category || "Otros",
        expenseType: data.expenseType || "Discrecional",
        antExpense: Boolean(data.antExpense),
        reason: data.reason || "",
        date: expenseDate,
      };

      setExpenses((prev) => [newExpense, ...prev]);
      setAmount("");
      setDescription("");
      setAnalysis(null);
    } catch (error) {
      console.error(error);
      alert("Ocurrió un error al clasificar el gasto con IA.");
    } finally {
      setClassifyingExpense(false);
    }
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setReadingImage(true);

      const base64 = await fileToBase64(file);
      const pureBase64 = base64.split(",")[1];

      const response = await fetch("/api/read-receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64: pureBase64,
          mimeType: file.type,
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo leer la imagen.");
      }

      const data = await response.json();

      setAmount(String(data.amount || ""));
      setDescription(data.description || "");
    } catch (error) {
      console.error(error);
      alert("Ocurrió un error al leer la imagen con IA.");
    } finally {
      setReadingImage(false);
      event.target.value = "";
    }
  };

  const analyzeWithAI = async () => {
    if (expenses.length === 0) return;

    try {
      setLoading(true);
      setAnalysis(null);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          budget,
          expenses,
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo analizar la información.");
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (error) {
      console.error(error);
      alert("Ocurrió un error al generar el análisis con IA.");
    } finally {
      setLoading(false);
    }
  };

  const deleteExpense = (id: number) => {
    setExpenses((prev) => prev.filter((expense) => expense.id !== id));
    setAnalysis(null);
  };

  const getRiskStyles = (riskLevel?: string) => {
    switch (riskLevel) {
      case "Alto":
        return "bg-red-100 text-red-700 border-red-200";
      case "Medio":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "Bajo":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold text-slate-900">Fynko</h1>
          <p className="text-slate-600">
            Asistente financiero con IA para estudiantes universitarios.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm md:col-span-1">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">
              Configuración inicial
            </h2>

            <label className="mb-2 block text-sm font-medium text-slate-700">
              Presupuesto mensual
            </label>
            <input
              type="number"
              min="0"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
            />

            <p className="mt-3 text-sm text-slate-500">
              Define cuánto dinero tienes disponible este mes.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm md:col-span-2">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">
              Registrar gasto con IA
            </h2>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Monto
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej. 4.50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Descripción del gasto
                </label>
                <input
                  type="text"
                  placeholder="Ej. Almuerzo en la U, Uber, Spotify"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Fecha
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              <button
                onClick={addExpenseWithAI}
                disabled={classifyingExpense}
                className="rounded-xl bg-slate-900 px-5 py-3 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {classifyingExpense ? "Clasificando gasto..." : "Agregar gasto con IA"}
              </button>

              <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-700 transition hover:bg-slate-100">
                {readingImage ? "Leyendo foto..." : "Subir foto de ticket"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            <p className="mt-3 text-sm text-slate-500">
              La IA puede leer una descripción manual o ayudarte a extraer datos desde una foto.
            </p>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Total gastado</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              ${totalSpent.toFixed(2)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Dinero restante</p>
            <p
              className={`mt-2 text-3xl font-bold ${
                remaining < 0 ? "text-red-600" : "text-slate-900"
              }`}
            >
              ${remaining.toFixed(2)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Presupuesto consumido</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {percentageUsed.toFixed(0)}%
            </p>
            <div className="mt-4 h-3 w-full rounded-full bg-slate-200">
              <div
                className="h-3 rounded-full bg-slate-900 transition-all"
                style={{ width: `${percentageUsed}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Cantidad de gastos</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{expenses.length}</p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm xl:col-span-1">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">
              Distribución por categorías
            </h2>
            {groupedByCategory.length === 0 ? (
              <p className="text-slate-500">Aún no hay gastos registrados.</p>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={groupedByCategory}
                      dataKey="total"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ category, percent }) =>
                        `${category} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {groupedByCategory.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.category}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm xl:col-span-1">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">
              Necesario vs discrecional
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseTypeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#0f172a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm xl:col-span-1">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">
              Estado del presupuesto
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetProgressData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#334155" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">
              Resumen de tipos de gasto
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Gasto necesario</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  ${necessaryTotal.toFixed(2)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Gasto discrecional</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  ${discretionaryTotal.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">
              Historial de gastos
            </h2>

            {expenses.length === 0 ? (
              <p className="text-slate-500">Todavía no has agregado gastos.</p>
            ) : (
              <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-slate-900">
                        ${expense.amount.toFixed(2)}
                      </span>
                      <span className="text-sm text-slate-600">{expense.category}</span>
                    </div>

                    <p className="mt-2 text-sm text-slate-600">{expense.description}</p>
                    <p className="mt-1 text-xs text-slate-400">{expense.date}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-700">
                        {expense.category}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          expense.expenseType === "Necesario"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {expense.expenseType}
                      </span>
                    </div>

                    {expense.reason && (
                      <p className="mt-2 text-xs text-slate-500">{expense.reason}</p>
                    )}

                    <button
                      onClick={() => deleteExpense(expense.id)}
                      className="mt-3 text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      Eliminar gasto
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Diagnóstico automático con IA
              </h2>
              <p className="text-slate-600">
                La IA analiza el comportamiento financiero y genera recomendaciones automáticas.
              </p>
            </div>

            <button
              onClick={analyzeWithAI}
              disabled={loading || expenses.length === 0}
              className="rounded-xl bg-slate-900 px-5 py-3 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? "Analizando..." : "Analizar mis gastos"}
            </button>
          </div>

          {!analysis ? (
            <div className="mt-6 rounded-2xl bg-slate-50 p-5">
              <p className="text-slate-500">
                Cuando registres gastos, aquí aparecerá el diagnóstico financiero generado por IA.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Estado general</p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {analysis.overallStatus}
                  </p>
                </div>

                <div
                  className={`rounded-2xl border p-4 ${getRiskStyles(
                    analysis.riskLevel
                  )}`}
                >
                  <p className="text-sm">Nivel de riesgo</p>
                  <p className="mt-2 text-xl font-bold">{analysis.riskLevel}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Categoría con mayor impacto</p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {analysis.topCategory}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Ahorro estimado posible</p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {analysis.estimatedSavings}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-slate-900">
                  Lectura del gasto discrecional
                </h3>
                <p className="mt-2 text-slate-600">
                  {analysis.discretionaryInsight}
                </p>
              </div>

              <div>
                <h3 className="mb-4 text-lg font-semibold text-slate-900">
                  Recomendaciones automáticas
                </h3>

                <div className="grid gap-4 md:grid-cols-3">
                  {analysis.recommendations?.map((recommendation, index) => (
                    <div
                      key={`${recommendation.title}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm"
                    >
                      <div className="mb-3 inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                        Consejo {index + 1}
                      </div>
                      <h4 className="text-base font-semibold text-slate-900">
                        {recommendation.title}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {recommendation.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = (error) => reject(error);
  });
}