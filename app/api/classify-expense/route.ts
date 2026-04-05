import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { amount, description } = await req.json();

    if (!amount || !description) {
      return Response.json(
        { error: "Monto y descripción son obligatorios." },
        { status: 400 }
      );
    }

    const prompt = `
Eres un clasificador financiero para estudiantes universitarios.

Analiza este gasto:
Monto: $${Number(amount).toFixed(2)}
Descripción: ${description}

Debes responder únicamente en JSON válido con esta estructura exacta:

{
  "category": "Comida | Transporte | Ocio | Estudio | Salidas | Suscripciones | Salud | Mascota | Otros",
  "expenseType": "Necesario | Discrecional",
  "antExpense": true,
  "reason": "explicación breve y clara"
}

Reglas:
- "category" debe ser la categoría más probable.
- "expenseType" debe ser "Necesario" si parece esencial y "Discrecional" si es prescindible o no esencial.
- "antExpense" debe ser true si parece un gasto pequeño, frecuente, impulsivo o acumulable.
- "reason" debe explicar brevemente la clasificación.
- Devuelve únicamente JSON válido, sin markdown, sin comillas triples, sin texto adicional.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Eres un sistema que clasifica gastos personales y responde solo con JSON válido.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    return Response.json(parsed);
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "No se pudo clasificar el gasto." },
      { status: 500 }
    );
  }
}