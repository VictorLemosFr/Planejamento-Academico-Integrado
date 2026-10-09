import type { Scenario, Simulation, SimulationRequest } from "./types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, options);
  } catch {
    throw new Error(
      "Não foi possível conectar ao sistema. Verifique a conexão e tente novamente.",
    );
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      typeof error?.detail === "string"
        ? error.detail
        : "Não foi possível carregar os dados. Tente novamente.",
    );
  }
  return response.json() as Promise<T>;
}

export const getScenarios = () => request<Scenario[]>("/scenarios");
export const simulate = (payload: SimulationRequest) =>
  request<Simulation>("/simulations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
