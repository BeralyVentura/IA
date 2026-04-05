import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Expense = {
  id: number;
  amount: number;
  description: string;
  category: string;
  expenseType: "Necesario" | "Discrecional";
  antExpense: boolean;
  reason?: string;
  date?: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const budget = Number(body.budget);
    const expenses: Expense[] = body.expenses ?? [];

    if (!Array.isArray(expenses) || expenses.length === 0) {
      return Response.json(
        { error: "No hay gastos para analizar." },
        { status: 400 }
      );
    }

    const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const remaining = budget - totalSpent;
    const percentageUsed = budget > 0 ? (totalSpent / budget) * 100 : 0;

    const grouped: Record<string, number> = {};
    for (const expense of expenses) {
      grouped[expense.category] = (grouped[expense.category] || 0) + expense.amount;
    }

    const discretionaryTotal = expenses
      .filter((expense) => expense.expenseType === "Discrecional")
      .reduce((sum, expense) => sum + expense.amount, 0);

    const necessaryTotal = expenses
      .filter((expense) => expense.expenseType === "Necesario")
      .reduce((sum, expense) => sum + expense.amount, 0);

    const categorySummary = Object.entries(grouped)
      .map(([category, total]) => `${category}: $${total.toFixed(2)}`)
      .join(", ");

    const expensesText = expenses
      .map(
        (expense) =>
          `- $${expense.amount.toFixed(2)} | ${expense.category} | ${expense.expenseType} | ${expense.description || "Sin descripción"}`
      )
      .join("\n");

    const prompt = `
Eres un asesor financiero para estudiantes universitarios.
Debes analizar la información y responder únicamente en JSON válido.

Datos:
- Presupuesto mensual: $${budget.toFixed(2)}
- Total gastado: $${totalSpent.toFixed(2)}
- Dinero restante: $${remaining.toFixed(2)}
- Porcentaje consumido: ${percentageUsed.toFixed(1)}%
- Total necesario: $${necessaryTotal.toFixed(2)}
- Total discrecional: $${discretionaryTotal.toFixed(2)}

Distribución por categorías:
${categorySummary}

Lista de gastos:
${expensesText}

Devuelve únicamente JSON válido con esta estructura exacta:

{
  "overallStatus": "texto corto",
  "riskLevel": "Bajo | Medio | Alto",
  "topCategory": "texto corto",
  "discretionaryInsight": "texto corto",
  "estimatedSavings": "texto corto",
  "recommendations": [
    {
      "title": "texto corto",
      "description": "texto breve y accionable"
    },
    {
      "title": "texto corto",
      "description": "texto breve y accionable"
    },
    {
      "title": "texto corto",
      "description": "texto breve y accionable"
    }
  ]
}

Criterios:
- overallStatus: resumen claro del estado financiero.
- riskLevel: Bajo, Medio o Alto según el ritmo de gasto.
- topCategory: cuál categoría impacta más y por qué.
- discretionaryInsight: explica si el gasto discrecional está alto o razonable.
- estimatedSavings: ahorro estimado posible si reduce los gastos más prescindibles.
- recommendations: exactamente 3 recomendaciones concretas, simples y accionables.
- No uses lenguaje técnico complejo.
- No devuelvas markdown.
- No agregues texto fuera del JSON.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Eres un asesor financiero especializado en hábitos de gasto de estudiantes universitarios y respondes solo JSON válido.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.5,
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    return Response.json(parsed);
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Ocurrió un error al analizar los gastos." },
      { status: 500 }
    );
  }
}