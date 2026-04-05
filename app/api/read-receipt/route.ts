import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64 || !mimeType) {
      return Response.json(
        { error: "La imagen es obligatoria." },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-5.4-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
Analiza esta imagen de un ticket, factura simple o screenshot de compra.

Extrae la información y responde únicamente en JSON válido con esta estructura exacta:

{
  "description": "texto corto",
  "amount": 0,
  "category": "Comida | Transporte | Ocio | Estudio | Salidas | Suscripciones | Salud | Mascota | Otros",
  "expenseType": "Necesario | Discrecional",
  "antExpense": false,
  "reason": "explicación breve"
}

Reglas:
- Si no logras identificar con certeza el monto, usa 0.
- "description" debe ser breve y útil.
- "expenseType" debe ser "Necesario" si parece esencial y "Discrecional" si parece prescindible.
- "antExpense" debe ser true si parece gasto pequeño, frecuente, impulsivo o acumulable.
- Devuelve únicamente JSON válido.
              `.trim(),
            },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${imageBase64}`,
              detail: "auto",
            },
          ],
        },
      ],
    });

    const textOutput = response.output_text?.trim() || "{}";
    const parsed = JSON.parse(textOutput);

    return Response.json(parsed);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "No se pudo leer la imagen." },
      { status: 500 }
    );
  }
}